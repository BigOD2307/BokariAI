import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createOtp,
  generateOtpCode,
  getOtpStatus,
  OtpError,
} from '@/lib/auth/whatsapp/otp-store';
import { sendOtp, WhatsAppConfigError, WhatsAppTemplateError, WhatsAppNetworkError, WhatsAppRateLimitError } from '@/lib/auth/whatsapp/meta-client';
import { checkRate } from '@/lib/auth/rate-limit';
import { getDefaultCountry } from '@/lib/auth/country';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const Body = z.object({
  phone: z.string().min(8).max(20),
  country: z.string().length(2).optional(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let parsed;
  try {
    const json = await request.json();
    parsed = Body.parse(json);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_BODY', message: 'Phone number is required' },
      { status: 400 },
    );
  }

  let e164: string;
  try {
    const country = parsed.country ?? getDefaultCountry();
    if (!isValidPhoneNumber(parsed.phone, country as any)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_PHONE', message: 'Numéro de téléphone invalide' },
        { status: 400 },
      );
    }
    e164 = parsePhoneNumber(parsed.phone, country as any).number;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_PHONE', message: 'Numéro de téléphone invalide' },
      { status: 400 },
    );
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipLimit = checkRate(`otp:ip:${ip}`, 30, 3600);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMITED', message: 'Trop de tentatives. Réessaie plus tard.' },
      { status: 429 },
    );
  }

  const status = await getOtpStatus(e164);
  if (status) {
    const cooldownMs = status.lastSentAt + 30_000 - Date.now();
    if (cooldownMs > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'COOLDOWN',
          message: 'Un code a déjà été envoyé. Patiente 30 secondes.',
          cooldownSeconds: Math.ceil(cooldownMs / 1000),
        },
        { status: 429 },
      );
    }
  }

  const code = generateOtpCode();
  try {
    await createOtp({ phone: e164, code, ttlSeconds: 300 });
  } catch (err) {
    if (err instanceof OtpError && err.code === 'RATE_LIMITED') {
      return NextResponse.json(
        { ok: false, error: 'RATE_LIMITED', message: err.message },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'INTERNAL', message: 'Erreur interne' },
      { status: 500 },
    );
  }

  try {
    await sendOtp(e164, code, 'fr');
  } catch (err) {
    if (
      err instanceof WhatsAppConfigError ||
      err instanceof WhatsAppTemplateError ||
      err instanceof WhatsAppNetworkError ||
      err instanceof WhatsAppRateLimitError
    ) {
      return NextResponse.json(
        { ok: false, error: 'WHATSAPP_FAILED', message: 'Impossible d\'envoyer le code WhatsApp' },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'INTERNAL', message: 'Erreur interne' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    phone: e164,
    ttl: 300,
    message: 'Code envoyé sur WhatsApp',
  });
}
