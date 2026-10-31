// Vercel serverless function — POST /api/generate-image
// Body: { prompt } for a ready-made image prompt (character reference), or
//       { scene: { title, body }, caseTitle, date, cast: [names] } to illustrate one script beat.
//
// For a scene, a text model first turns the beat into a precise visual prompt that shows only
// what the beat says (no invented facts), then the image is generated.
//
// Image provider (IMAGE_PROVIDER):
//   pollinations (default) — free, no key needed
//   gemini                 — needs GEMINI_API_KEY on a billed Google project (no free API quota)
// The scene-to-prompt step uses GEMINI_API_KEY if present (free), else a plain fallback prompt.

import { checkAuth } from './_auth.js';

const STYLE = 'Flat-color editorial comic illustration, bold clean outlines, muted professional palette, simple readable composition, wide landscape panel. No text, no letters, no logos, no captions, no speech bubbles, no real named people — representative figures only.';

const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';

function plain(md) {
  return (md || '').replace(/\*\*(.+?):\*\*/g, '$1 says:').replace(/^[-#]+\s*/gm, '').replace(/\*/g, '').trim();
}

function fallbackPrompt({ scene, caseTitle, date, cast }) {
  return `Comic panel for a supply-chain case study (${caseTitle || 'a supply-chain case'}${date ? ', ' + date : ''}). Scene: ${plain(scene.body).slice(0, 500)}${cast?.length ? ` Characters: ${cast.join(', ')}.` : ''} ${STYLE}`;
}

async function sceneToPrompt(input) {
  if (!process.env.GEMINI_API_KEY) return fallbackPrompt(input);
  const { scene, caseTitle, date, cast } = input;
  const ask = `Write ONE image-generation prompt (max 90 words) illustrating this single comic panel of a real supply-chain case study.

CASE: ${caseTitle || 'n/a'}${date ? ' — ' + date : ''}
PANEL TITLE: ${scene.title}
PANEL TEXT:
${plain(scene.body)}
${cast?.length ? `CHARACTERS (draw as generic business people, label nothing): ${cast.join(', ')}` : ''}

Rules: depict only what the panel text says — the setting, objects, and actions. Do not invent events, numbers, or outcomes. For a chain/list of companies, show a simple left-to-right flow of buildings or boxes. For a question to the reader, show two paths diverging. Never ask for text, letters, numbers, logos, or speech bubbles in the image. Output only the prompt.`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: ask }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 2000 } }),
    });
    if (!r.ok) return fallbackPrompt(input);
    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    return text.length > 60 ? `${text} ${STYLE}` : fallbackPrompt(input);
  } catch {
    return fallbackPrompt(input);
  }
}

async function viaPollinations(prompt) {
  const seed = Math.floor(Math.random() * 1e6);
  const key = process.env.POLLINATIONS_API_KEY;
  const base = key ? 'https://gen.pollinations.ai/image' : 'https://image.pollinations.ai/prompt';
  const url = `${base}/${encodeURIComponent(prompt.slice(0, 1500))}?width=1024&height=640&model=flux&nologo=true&seed=${seed}`;
  const r = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(55000) });
  if (r.status === 402 || r.status === 429 || r.status === 503) {
    const wait = (await r.text()).match(/Retry after (\d+)s/)?.[1];
    throw Object.assign(new Error(`The free image service is busy or limited to about one image per 45 seconds. ${wait ? `Try again in ${wait} seconds.` : 'Try again shortly.'} (A free Pollinations key removes most of this limit.)`), { upstream: true });
  }
  if (!r.ok) throw Object.assign(new Error(`The Pollinations image service returned an error (${r.status}). Try again in a moment.`), { upstream: true, detail: (await r.text()).slice(0, 300) });
  const type = r.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw Object.assign(new Error('The image service did not return an image. Try again.'), { upstream: true });
  return { mimeType: type.split(';')[0], data: Buffer.from(await r.arrayBuffer()).toString('base64') };
}

async function viaCloudflare(prompt) {
  const { CLOUDFLARE_ACCOUNT_ID: id, CLOUDFLARE_API_TOKEN: token } = process.env;
  if (!id || !token) throw new Error('Server is missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN.');
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }),
    signal: AbortSignal.timeout(55000),
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 400);
    const friendly = r.status === 401 || r.status === 403 ? 'Cloudflare rejected the token — check CLOUDFLARE_API_TOKEN and its Workers AI permission.' : r.status === 429 ? 'Cloudflare free allowance reached for now. Try again later.' : `The Cloudflare image service returned an error (${r.status}).`;
    throw Object.assign(new Error(friendly), { upstream: true, detail });
  }
  const data = await r.json();
  const b64 = data?.result?.image;
  if (!b64) throw Object.assign(new Error('Cloudflare returned no image.'), { upstream: true, detail: JSON.stringify(data).slice(0, 300) });
  return { mimeType: 'image/jpeg', data: b64 };
}

async function viaGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Server is missing GEMINI_API_KEY. Set it in Vercel project settings.');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
  });
  if (!r.ok) throw Object.assign(new Error('The Gemini image API returned an error (image models need a billed Google project).'), { upstream: true, detail: await r.text() });
  const data = await r.json();
  const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
  const inline = part?.inlineData || part?.inline_data;
  if (!inline) throw Object.assign(new Error('No image was returned — the model may have declined this prompt.'), { upstream: true });
  return { mimeType: inline.mimeType || inline.mime_type || 'image/png', data: inline.data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!checkAuth(req, res)) return;

  const { prompt, scene, caseTitle, date, cast } = req.body || {};
  const hasScene = scene && typeof scene.body === 'string';
  if (!hasScene && (!prompt || typeof prompt !== 'string')) {
    res.status(400).json({ error: 'Missing prompt or scene' });
    return;
  }
  if ((prompt || '').length > 2000 || (hasScene && scene.body.length > 4000)) {
    res.status(400).json({ error: 'Input too long.' });
    return;
  }

  try {
    const finalPrompt = hasScene
      ? await sceneToPrompt({ scene: { title: String(scene.title || ''), body: scene.body }, caseTitle: String(caseTitle || ''), date: String(date || ''), cast: Array.isArray(cast) ? cast.map(String).slice(0, 4) : [] })
      : prompt;
    const provider = (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase();
    const image = provider === 'cloudflare' ? await viaCloudflare(finalPrompt)
      : provider === 'gemini' ? await viaGemini(finalPrompt)
      : await viaPollinations(finalPrompt);
    res.status(200).json({ ...image, prompt: finalPrompt });
  } catch (err) {
    if (err.upstream) res.status(502).json({ error: err.message, detail: err.detail });
    else res.status(500).json({ error: err.message || 'Server error generating the image.', detail: String(err) });
  }
}
