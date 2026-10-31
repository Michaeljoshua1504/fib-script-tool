// Vercel serverless function — POST /api/generate-image
// Calls the Gemini API to generate a character reference image from a text prompt.
// Separate from api/generate.js: this needs its own key (GEMINI_API_KEY), its own
// billing, and is a different provider from the Anthropic calls used elsewhere.
//
// IMPORTANT — verify before relying on this: Gemini's image-capable model name
// changes as new versions ship, and documentation was inconsistent at the time
// this was written. Before deploying, check console accounts and the current
// model list at https://ai.google.dev (or Google AI Studio) and update MODEL
// below if it has changed.
const MODEL = 'gemini-2.5-flash-image';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Set it in Vercel project settings.' });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(502).json({ error: 'The Gemini API returned an error. Check the model name in MODEL is still current.', detail });
      return;
    }

    const data = await upstream.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    // Handle both camelCase and snake_case response keys — documentation disagreed
    // on which this account's API version returns.
    const imagePart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;

    if (!inline) {
      res.status(502).json({ error: 'No image was returned — the model may have declined this prompt, or MODEL needs updating.' });
      return;
    }

    res.status(200).json({
      mimeType: inline.mimeType || inline.mime_type || 'image/png',
      data: inline.data,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error calling Gemini.', detail: String(err) });
  }
}
