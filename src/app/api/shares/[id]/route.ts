import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getShareById, revokeShare } from '@/lib/auth/shares';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const share = await getShareById(id);
  if (!share) {
    return NextResponse.json({ message: 'Share not found' }, { status: 404 });
  }
  return NextResponse.json({ share }, { status: 200 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const revoked = await revokeShare(id, user.id);
  if (!revoked) {
    return NextResponse.json(
      { message: 'Share not found or already revoked' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
