import { NextResponse } from 'next/server';
import { verifyWebhookSignature, loadMetaConfig } from '@/lib/auth/whatsapp/meta-client';

export const runtime = 'nodejs';

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title: string }>;
}

interface MetaPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: MetaStatus[];
        messages?: Array<{ from: string; type: string }>;
      };
    }>;
  }>;
}

const logStatus = (status: MetaStatus): void => {
  if (status.status === 'failed' && status.errors) {
    console.error('[whatsapp-webhook] delivery failed', {
      messageId: status.id,
      errors: status.errors,
    });
  }
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && challenge) {
    const expected = process.env.META_WHATSAPP_VERIFY_TOKEN ?? '';
    if (token === expected) {
      return new NextResponse(challenge, { status: 200 });
    }
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const config = (() => {
    try {
      return loadMetaConfig();
    } catch {
      return null;
    }
  })();
  if (!config) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const raw = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const valid = verifyWebhookSignature(raw, signature, config.appSecret);
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'INVALID_SIGNATURE' }, { status: 401 });
  }
  let payload: MetaPayload;
  try {
    payload = JSON.parse(raw) as MetaPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        logStatus(status);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
