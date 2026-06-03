import { NextResponse } from 'next/server';
import { incrementViewCount, logShareView } from '@/lib/auth/shares';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const referrer = request.headers.get('referer') ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;
  const country =
    request.headers.get('cf-ipcountry') ??
    request.headers.get('x-vercel-ip-country') ??
    null;
  try {
    await logShareView(id, { referrer: referrer ?? undefined, country: country ?? undefined, userAgent: userAgent ?? undefined });
    const newCount = await incrementViewCount(id);
    return NextResponse.json({ ok: true, viewCount: newCount }, { status: 200 });
  } catch (err) {
    console.error('[api/shares/view] error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
