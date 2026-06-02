/**
 * @module api/multimodal
 * @description POST endpoint for image / pdf upload + vision analysis.
 *   Accepts multipart/form-data with:
 *     - file:    the binary attachment
 *     - prompt:  optional text prompt (default: French "describe in detail")
 *   Returns { attachment, vision } on success.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { NextResponse } from 'next/server';
import { analyseImage } from '@/lib/agents/multimodal/router';
import {
  fileToAttachment,
  MultipartUploadError,
} from '@/lib/uploads/multimodal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PROMPT = "D\u00e9cris cette image en d\u00e9tail.";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const prompt = (formData.get('prompt') as string | null) ?? DEFAULT_PROMPT;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const attachment = await fileToAttachment(file);

    if (attachment.kind !== 'image') {
      return NextResponse.json({
        attachment,
        vision: null,
        message: 'PDF support will be added in Sprint 2 stretch goals.',
      });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 },
      );
    }

    const vision = await analyseImage(attachment, prompt, apiKey);

    return NextResponse.json({ attachment, vision });
  } catch (err) {
    if (err instanceof MultipartUploadError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
