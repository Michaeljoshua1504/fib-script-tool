// Vercel serverless function — POST /api/generate
// Body: { fields } for a full 7-beat script, or { fields, beatNum } to redraft one beat only.
// Builds the prompt server-side and calls the model, so keys never reach the browser.
//
// Provider: Gemini by default (GEMINI_API_KEY). Set SCRIPT_PROVIDER=anthropic to use
// Claude instead (ANTHROPIC_API_KEY). Override the model with GEMINI_TEXT_MODEL.
//
// Accuracy: low temperature, a system instruction, a format example, and a server-side
// check of the output (headings, speakers, every number traced back to the input).
// If the check fails the model is asked once to fix its own draft.

import { checkAuth } from './_auth.js';

const GEMINI_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
const ANTHROPIC_MODEL = 'claude-sonnet-5-5';

const BEAT_DEFS = [
  { num: 1, title: 'Cold open', rule: "using CASE TITLE and DATE & LOCATION: one date/location line, then one establishing-shot scene description." },
  { num: 2, title: 'Normal operations', rule: "using CHAIN NODES exactly as given: a bullet list, one line per node listed, in the order given. Do not add, remove, merge, or rename nodes." },
  { num: 3, title: 'The shock', rule: "using THE SHOCK: a short narrator paragraph." },
  { num: 4, title: 'Two reactions', rule: "using DECISION, DECISION MAKER, RISK, and RISK RAISER. Exactly two panels. Panel 1: the speaker named in DECISION MAKER states the content of DECISION (paraphrased, punchy, comic dialogue). Panel 2: the speaker named in RISK RAISER raises the content of RISK (paraphrased), and the DECISION MAKER gives one short in-character reply defending the choice. Use these two labels exactly as given, never swapped, never a third speaker." },
  { num: 5, title: 'The decision beat', rule: "one short line framed as a direct question to the reader, built from the tension between DECISION and RISK." },
  { num: 6, title: 'Fallout', rule: "using OUTCOME: a short narrator paragraph, every number and date kept exactly as given." },
  { num: 7, title: 'Lesson line', rule: "if LESSON FACT is given, state it directly as the closing line, rephrased for punch but adding no claim, cause, ranking, or consequence beyond what LESSON FACT itself says; otherwise draw one short closing line stated only from facts in OUTCOME, with the same restriction. Never add a causal or superlative claim (\"this was the one that cost the most\", \"this is why it failed\") unless that exact claim is stated in the given fields." },
];

const SYSTEM = `You are a meticulous scriptwriter for the "Future Industry in a Box" project at Hof University, which teaches supply-chain concepts through short illustrated case comics. You work only from the case data you are given. Accuracy matters more than flair: you never add a number, date, name, cause, ranking, or outcome that is not in the given fields, and you never change a figure. You follow the requested output format exactly, with no preamble and no closing remarks.`;

const FORMAT_EXAMPLE = `FORMAT EXAMPLE (shape only — do not reuse its content):
## 1. Cold open
**1 January 2000, Springfield.**
A quiet factory floor at dawn.

## 2. Normal operations
- Supplier: ships parts weekly
- Maker: assembles the product

## 4. Two reactions
**Maker:** We keep shipping.
**Engineer:** Not until it's tested.
**Maker:** The deadline stands.`;

function fieldsBlock(fields) {
  const v = (id) => ((fields && fields[id]) || '').trim() || '[not given]';
  return `FIELDS:
CASE TITLE: ${v('fTitle')}
DATE & LOCATION: ${v('fDate')}
CHAIN NODES:
${v('fNodes')}
THE SHOCK: ${v('fShock')}
DECISION: ${v('fDecision')}
DECISION MAKER: ${v('fDecisionMaker')}
RISK: ${v('fRisk')}
RISK RAISER: ${v('fRiskRaiser')}
OUTCOME: ${v('fOutcome')}
LESSON FACT: ${v('fLesson')}
`;
}

function buildFullPrompt(fields) {
  const beatList = BEAT_DEFS.map((b) => `${b.num}. ${b.title} — ${b.rule}`).join('\n');
  return `Produce a comic script using EXACTLY this 7-beat structure, in this order. Each field below feeds the beat(s) named in the rules.

${beatList}

STRICT RULES:
- Use only the field contents given below. Never invent a number, date, name, or outcome not present in them. Keep every number, currency amount, percentage, and date exactly as written.
- If a required field is empty and the beat truly cannot be written without it, write exactly: [missing: what's needed] for that beat only — never for beat 4's in-character reply line, which may be dramatized wording as long as it states no invented fact.
- Dialogue lines: short and punchy, comic style, under 20 words each, 2–4 lines per panel maximum.
- Output ONLY in this exact markdown shape, nothing before or after: "## 1. Cold open" style heading per beat (all seven, numbered 1–7); dialogue as "**Speaker:** line text"; the node list in beat 2 as "- Label: description"; plain paragraphs for narrator lines. No preamble, no closing remarks outside the 7 beats.

${FORMAT_EXAMPLE}

${fieldsBlock(fields)}`;
}

function buildBeatPrompt(fields, beatNum) {
  const def = BEAT_DEFS[beatNum - 1];
  const missingNote = beatNum === 4
    ? " — except the in-character reply line in panel 2, which may be dramatized wording as long as it states no invented fact."
    : ".";
  return `Redraft ONE beat of a 7-beat comic script. Use the same labeled case fields below. Produce ONLY beat ${def.num}, following this rule exactly:

${def.num}. ${def.title} — ${def.rule}

STRICT RULES:
- Use only the field contents given below. Never invent a number, date, name, or outcome not present in them. Keep every number, currency amount, percentage, and date exactly as written.
- If this beat truly cannot be written without a missing field, write exactly: [missing: what's needed]${missingNote}
- Dialogue lines (if any): short and punchy, comic style, under 20 words each, 2–4 lines per panel maximum.
- Output ONLY the markdown for this one beat, nothing before or after: a "## ${def.num}. ${def.title}" heading, then its body using these conventions: dialogue as "**Speaker:** line text", node lists as "- Label: description", plain paragraphs for narrator lines. No preamble, no extra commentary.

${fieldsBlock(fields)}`;
}

// ---------- model calls ----------

async function callGemini(messages, maxTokens) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw Object.assign(new Error('The Gemini API returned an error.'), { detail: await res.text(), upstream: true });
  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw Object.assign(new Error('Gemini returned no text (it may have blocked the prompt).'), { detail: JSON.stringify(data.promptFeedback || cand?.finishReason || ''), upstream: true });
  return { text, truncated: cand?.finishReason === 'MAX_TOKENS' };
}

async function callAnthropic(messages, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      system: SYSTEM,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  if (!res.ok) throw Object.assign(new Error('The Anthropic API returned an error.'), { detail: await res.text(), upstream: true });
  const data = await res.json();
  return { text: (data.content || []).map((b) => b.text || '').join(''), truncated: data.stop_reason === 'max_tokens' };
}

// ---------- output checks ----------

function numberTokens(s) {
  return (s.match(/\d[\d,.]*\d|\d/g) || []).map((t) => t.replace(/,/g, '').replace(/\.$/, ''));
}

/** Returns a list of human-readable problems with the model's output. */
function validate(text, fields, beatNum) {
  const problems = [];
  const body = text.split('\n').filter((l) => !l.trim().startsWith('## ')).join('\n');

  const headings = (text.match(/^## .+$/gm) || []).length;
  if (!beatNum && headings !== 7) problems.push(`expected 7 "## " beat headings but found ${headings}`);
  if (beatNum && headings < 1) problems.push('missing the "## " beat heading');

  // Every number in the output must appear somewhere in the input fields.
  const allowed = new Set(numberTokens(Object.values(fields).filter((v) => typeof v === 'string').join('\n')));
  const stray = [...new Set(numberTokens(body))].filter((n) => !allowed.has(n));
  if (stray.length) problems.push(`numbers not found in the given fields: ${stray.join(', ')}`);

  // Beat 4 may only be spoken by the two named characters.
  const dm = (fields.fDecisionMaker || '').trim().toLowerCase();
  const rr = (fields.fRiskRaiser || '').trim().toLowerCase();
  if (dm && rr && (!beatNum || beatNum === 4)) {
    const beat4 = beatNum === 4 ? text : (text.split(/^## 4\./m)[1] || '').split(/^## 5\./m)[0];
    const speakers = [...beat4.matchAll(/^\*\*(.+?):\*\*/gm)].map((m) => m[1].trim().toLowerCase());
    const wrong = [...new Set(speakers.filter((s) => s !== dm && s !== rr))];
    if (wrong.length) problems.push(`beat 4 uses speakers other than "${fields.fDecisionMaker}" and "${fields.fRiskRaiser}": ${wrong.join(', ')}`);
  }
  return problems;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!checkAuth(req, res)) return;

  const provider = (process.env.SCRIPT_PROVIDER || 'gemini').toLowerCase();
  const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
  if (!process.env[keyName]) {
    res.status(500).json({ error: `Server is missing ${keyName}. Set it in Vercel project settings.` });
    return;
  }

  const { fields, beatNum } = req.body || {};
  if (!fields || typeof fields !== 'object') {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  if (beatNum !== undefined && (typeof beatNum !== 'number' || beatNum < 1 || beatNum > 7)) {
    res.status(400).json({ error: 'beatNum must be a number from 1 to 7' });
    return;
  }
  if (Object.values(fields).some((v) => typeof v === 'string' && v.length > 4000)) {
    res.status(400).json({ error: 'A field is too long (max 4000 characters).' });
    return;
  }

  const prompt = beatNum ? buildBeatPrompt(fields, beatNum) : buildFullPrompt(fields);
  const maxTokens = beatNum ? 1500 : 6000;
  const call = provider === 'anthropic' ? callAnthropic : callGemini;

  try {
    let messages = [{ role: 'user', text: prompt }];
    let result = await call(messages, maxTokens);
    let problems = validate(result.text, fields, beatNum);

    if (problems.length) {
      // One self-correction pass: show the model its own draft and the specific problems.
      messages = [
        ...messages,
        { role: 'assistant', text: result.text },
        { role: 'user', text: `Your draft has these problems:\n- ${problems.join('\n- ')}\n\nRewrite it fixing every problem. Remove or correct anything not supported by the fields. Output only the corrected markdown in the same format.` },
      ];
      const retry = await call(messages, maxTokens);
      const retryProblems = validate(retry.text, fields, beatNum);
      if (retryProblems.length <= problems.length) { result = retry; problems = retryProblems; }
    }

    res.status(200).json({ text: result.text, truncated: result.truncated, warnings: problems });
  } catch (err) {
    if (err.upstream) {
      res.status(502).json({ error: err.message, detail: err.detail });
    } else {
      res.status(500).json({ error: 'Server error generating the script.', detail: String(err) });
    }
  }
}
