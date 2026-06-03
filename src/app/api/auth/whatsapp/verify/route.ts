import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp, OtpError } from '@/lib/auth/whatsapp/otp-store';
import {
  createOrGetPhoneUser,
  mintSession,
  setSessionCookie,
} from '@/lib/auth/whatsapp/jwt';
import { parsePhoneNumber } from 'libphonenumber-js';
import { getDefaultCountry } from '@/lib/auth/country';

const Body = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().length(6),
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
      { ok: false, error: 'INVALID_BODY', message: 'Phone and 6-digit code required' },
      { status: 400 },
    );
  }

  let e164: string;
  try {
    const country = parsed.country ?? getDefaultCountry();
    e164 = parsePhoneNumber(parsed.phone, country as any).number;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_PHONE', message: 'Numéro invalide' },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await verifyOtp(e164, parsed.code);
  } catch (err) {
    if (err instanceof OtpError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'INTERNAL', message: 'Erreur interne' },
      { status: 500 },
    );
  }

  const user = await createOrGetPhoneUser(e164);
  const session = mintSession(user.id, e164);
  await setSessionCookie(session);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      phone: e164,
      email: user.email,
      isNew: user.isNew,
    },
    expiresAt: session.expiresAt,
  });
}
