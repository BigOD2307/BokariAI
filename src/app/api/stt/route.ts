import { NextRequest } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '[REDACTED]';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;
    // Dynamic language: default French, but accept a `language_code` form field
    // (or `lang`) so the Wolof / Bambara / Hausa transcript path can pick a
    // language. ElevenLabs scribe_v1 takes an ISO-639 code; we pass the first
    // two chars and fall back to 'fr'.
    const rawLang =
      (formData.get('language_code') as string | null) ||
      (formData.get('lang') as string | null) ||
      'fr';
    const languageCode = (rawLang || 'fr').toString().slice(0, 2) || 'fr';

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'Audio file is required' }), {
        status: 400,
      });
    }

    const elevenLabsForm = new FormData();
    elevenLabsForm.append('audio', audioFile, 'audio.webm');
    elevenLabsForm.append('model_id', 'scribe_v1');
    elevenLabsForm.append('language_code', languageCode);

    const res = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: elevenLabsForm,
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[Bokari STT] ElevenLabs error:', err);
      return new Response(JSON.stringify({ error: 'STT transcription failed' }), {
        status: 500,
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify({ text: data.text || '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Bokari STT] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
