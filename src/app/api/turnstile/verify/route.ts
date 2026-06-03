import { NextResponse } from 'next/server';
import { z } from 'zod';

const Body = z.object({
  token: z.string().min(10),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let parsed;
  try {
    const json = await request.json();
    parsed = Body.parse(json);
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: true, verified: false, skipped: true });
  }
  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', parsed.token);
  try {
    const resp = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: form,
      },
    );
    const data = (await resp.json()) as { success: boolean };
    return NextResponse.json({ ok: true, verified: data.success === true });
  } catch {
    return NextResponse.json({ ok: false, verified: false }, { status: 502 });
  }
}
