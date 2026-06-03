import { NextResponse } from 'next/server';
import { getGuestSession, incrementGuestQueries } from '@/lib/auth/guest';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getGuestSession();
  return NextResponse.json({
    ok: true,
    session,
  });
}

export async function POST() {
  const session = await incrementGuestQueries();
  return NextResponse.json({
    ok: true,
    session,
  });
}
