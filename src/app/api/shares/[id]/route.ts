import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth/require';
import { getShareById, revokeShare } from '@/lib/auth/shares';

export const dynamic = 'force-dynamic';

// Owner-only: the row includes chatId/userId, which must never reach an
// unauthenticated visitor (see the note in PublicChatView's response type) —
// the public share view goes through GET /api/p/[slug] instead, which never
// returns these fields. 404 (not 403/401) whether the share doesn't exist or
// just isn't the caller's, matching the anti-enumeration pattern used
// throughout the chats/shares domains.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const caller = await getCaller(request);
  const share = await getShareById(id);
  if (!share || !caller || share.userId !== caller.userId) {
    return NextResponse.json({ message: 'Share not found' }, { status: 404 });
  }
  return NextResponse.json({ share }, { status: 200 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const caller = await getCaller(request);
  if (!caller) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const revoked = await revokeShare(id, caller.userId);
  if (!revoked) {
    return NextResponse.json(
      { message: 'Share not found or already revoked' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
