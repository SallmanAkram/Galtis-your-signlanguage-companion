import { GoogleGenAI } from '@google/genai';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawContentType = req.headers.get('content-type') || 'audio/webm';
    const mimeType = rawContentType.split(';')[0].trim() || 'audio/webm';

    const arrayBuffer = await req.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ error: 'Empty audio buffer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return new Response(
        JSON.stringify({
          text: '',
          warning: 'GEMINI_API_KEY is not configured in Netlify environment variables for AI audio transcription.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: 'Transcribe this spoken audio clip into English text for American Sign Language (ASL) translation. Return ONLY the verbatim transcribed words or sentence, with no commentary, formatting, or extra punctuation.',
            },
          ],
        },
      ],
    });

    const transcribedText = response.text ? response.text.trim() : '';
    return new Response(JSON.stringify({ text: transcribedText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Netlify Transcribe Error]:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Transcription failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
