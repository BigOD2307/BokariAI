import { NextRequest } from 'next/server';

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel - default voice

export async function POST(req: NextRequest) {
  // No hardcoded key fallback (a leaked key lived here): fail fast with a
  // clear 503 so the client can hide voice output. Rotate the exposed key
  // in the ElevenLabs dashboard.
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'VOICE_UNAVAILABLE' }, { status: 503 });
  }
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
      });
    }

    const trimmedText = text.slice(0, 5000);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmedText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[Bokari TTS] ElevenLabs error:', err);
      return new Response(JSON.stringify({ error: 'TTS generation failed' }), {
        status: 500,
      });
    }

    return new Response(res.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('[Bokari TTS] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
