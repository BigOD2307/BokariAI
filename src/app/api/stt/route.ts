import { NextRequest } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '[REDACTED]';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'Audio file is required' }), {
        status: 400,
      });
    }

    const elevenLabsForm = new FormData();
    elevenLabsForm.append('audio', audioFile, 'audio.webm');
    elevenLabsForm.append('model_id', 'scribe_v1');
    elevenLabsForm.append('language_code', 'fr');

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
