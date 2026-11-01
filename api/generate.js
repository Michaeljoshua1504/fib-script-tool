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
  { num: 1, title: 'Cold open', rule: "using CASE TITLE, DATE & LOCATION and CHAIN NODES. Line 1: the date and location exactly as given, in bold. Line 2: ONE sentence describing a purely visual, neutral establishing shot of the place or industry BEFORE anything goes wrong (what a camera would see: the type of site, equipment, people at work). It must not state or imply any event, trend, or condition — no words like growing, booming, thriving, crisis, escalating, tension — and must not add any name, number, or place that is not in the fields." },
  { num: 2, title: 'Normal operations', rule: "using CHAIN NODES exactly as given: a bullet list, one line per node listed, in the order given. Do not add, remove, merge, or rename nodes." },
  { num: 3, title: 'The shock', rule: "using THE SHOCK: a narrator caption of 2–4 sentences (at most 85 words) that condenses THE SHOCK. Keep what broke, when it happened, the cause exactly as THE SHOCK states it, and every figure that measures the damage or scale, exactly as written. Do not copy the whole field; leave out only secondary detail; add nothing." },
  { num: 4, title: 'Two reactions', rule: "using DECISION, DECISION MAKER, RISK, and RISK RAISER. Exactly two panels. Panel 1: the speaker named in DECISION MAKER states the content of DECISION (paraphrased, punchy, comic dialogue). Panel 2: the speaker named in RISK RAISER raises the content of RISK (paraphrased), and the DECISION MAKER gives one short in-character reply defending the choice. Use these two labels exactly as given, never swapped, never a third speaker." },
  { num: 5, title: 'The decision beat', rule: "ONE question to the reader (at most 28 words) asked at the moment of decision, before the outcome is known. Present the two real options neutrally, each as an ACTION the reader could take: option A is what the DECISION MAKER did; option B is the alternative action the RISK points to (the check, certification, verification, contingency or visibility that was missing) — never a description of the existing problem. Do not hint which is right. Do not mention any result from OUTCOME, and do not use loaded words (e.g. reckless, rush, bypass) unless they appear in the fields. Start with something like \"What would you do\" or \"Would you\"." },
  { num: 6, title: 'Fallout', rule: "using OUTCOME: a narrator caption of 3–5 sentences (at most 110 words) that condenses OUTCOME in its original order. Keep EVERY number, percentage, currency amount and date from OUTCOME exactly as written; drop only secondary wording. Add no cause, judgement or consequence that OUTCOME does not state." },
  { num: 7, title: 'Lesson line', rule: "if LESSON FACT is given, state it directly as the closing line, rephrased for punch but adding no claim, cause, ranking, or consequence beyond what LESSON FACT itself says; otherwise draw one short closing line stated only from facts in OUTCOME, with the same restriction. Never add a causal or superlative claim (\"this was the one that cost the most\", \"this is why it failed\") unless that exact claim is stated in the given fields." },
];

const SYSTEM = `You are a meticulous scriptwriter for the "Future Industry in a Box" project at Hof University, which teaches supply-chain concepts through short illustrated case comics. You work only from the case data you are given. Accuracy matters more than flair: you never add a number, date, name, cause, ranking, or outcome that is not in the given fields, and you never change a figure. You follow the requested output format exactly, with no preamble and no closing remarks. You ALWAYS write the entire script in English — narration, dialogue, and headings — even if some or all of the case data is in another language; translate it into English and keep proper nouns (company and place names) as given.`;

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
- Write everything in English only (translate the case data if it is not in English; keep names of companies and places).
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
- Write everything in English only (translate the case data if it is not in English; keep names of companies and places).
- Use only the field contents given below. Never invent a number, date, name, or outcome not present in them. Keep every number, currency amount, percentage, and date exactly as written.
- If this beat truly cannot be written without a missing field, write exactly: [missing: what's needed]${missingNote}
- Dialogue lines (if any): short and punchy, comic style, under 20 words each, 2–4 lines per panel maximum.
- Output ONLY the markdown for this one beat, nothing before or after: a "## ${def.num}. ${def.title}" heading, then its body using these conventions: dialogue as "**Speaker:** line text", node lists as "- Label: description", plain paragraphs for narrator lines. No preamble, no extra commentary.

${fieldsBlock(fields)}`;
}

// ---------- model calls ----------

async function callGemini(messages, maxTokens, opts = {}) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system || SYSTEM }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
        generationConfig: { temperature: opts.json ? 0 : 0.3, maxOutputTokens: maxTokens, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
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

async function callAnthropic(messages, maxTokens, opts = {}) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature: opts.json ? 0 : 0.3,
      system: opts.system || SYSTEM,
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

const EN_WORDS = new Set('the and of to in is was for that on with it at by his her their they we you are were has have had be as from this which an'.split(' '));
const OTHER_WORDS = new Set('der die das und nicht ist wir ein eine mit von zu den im auf für sie es sich auch war wird le la les des et est pour que dans une el los las y por con una del se su lo nous vous ils sont avec'.split(' '));

/** Cheap check that the text is English: counts common English vs German/French/Spanish function words. */
function looksNonEnglish(text) {
  const words = text.toLowerCase().match(/[a-zäöüßéèàçñ]+/g) || [];
  let en = 0, other = 0;
  for (const w of words) { if (EN_WORDS.has(w)) en++; else if (OTHER_WORDS.has(w)) other++; }
  return other >= 3 && other > en * 0.5;
}

/** Returns a list of human-readable problems with the model's output. */
function validate(text, fields, beatNum) {
  const problems = [];
  const body = text.split('\n').filter((l) => !l.trim().startsWith('## ')).join('\n');

  if (looksNonEnglish(body)) problems.push('the script is not written in English — rewrite everything in English');

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

// ---------- stricter checks and the fact-check pass ----------

/** Text of beat n ("## n. ..." up to the next "## "), or the whole text when only one beat was generated. */
function sectionOf(text, n, singleBeat) {
  if (singleBeat) return text;
  const m = text.split(new RegExp(`^## ${n}\\.`, 'm'))[1];
  return m ? m.split(/^## /m)[0] : '';
}
const wordCount = (s) => (s.match(/\S+/g) || []).length;
const SCENE_BANNED = /\b(grow(ing|th)|boom(ing)?|thriv(e|ing)|crisis|escalat\w*|tension|bustling|humming|rapid\w*|booming|chaos|panic|turmoil)\b/i;

/** Rules a script must meet beyond the number/speaker/language checks. */
function validateBeats(text, fields, beatNum) {
  const problems = [];
  const single = Boolean(beatNum);
  const want = (n) => !single || beatNum === n;

  if (want(1)) {
    const scene = sectionOf(text, 1, single).split('\n').filter((l) => l.trim() && !l.trim().startsWith('## ') && !l.trim().startsWith('**')).join(' ');
    const hit = scene.match(SCENE_BANNED);
    if (hit) problems.push(`beat 1 establishing shot must be neutral and visual; remove the word "${hit[0]}"`);
  }
  for (const [n, fieldId, label, maxWords] of [[3, 'fShock', 'THE SHOCK', 105], [6, 'fOutcome', 'OUTCOME', 130]]) {
    if (!want(n)) continue;
    const sec = sectionOf(text, n, single).split('\n').filter((l) => !l.trim().startsWith('## ')).join('\n');
    if (wordCount(sec) > maxWords) problems.push(`beat ${n} is too long (${wordCount(sec)} words, max ${maxWords}); condense it`);
    const have = new Set(numberTokens(sec));
    const lost = [...new Set(numberTokens(fields[fieldId] || ''))].filter((x) => !have.has(x));
    if (lost.length) problems.push(`beat ${n} leaves out figures from ${label}: ${lost.join(', ')}`);
  }
  if (want(5)) {
    const sec = sectionOf(text, 5, single).split('\n').filter((l) => l.trim() && !l.trim().startsWith('## ')).join(' ');
    if (!sec.includes('?')) problems.push('beat 5 must be a question to the reader');
    if (wordCount(sec) > 34) problems.push(`beat 5 is too long (${wordCount(sec)} words, max 28)`);
  }
  return problems;
}

function parseJson(s) {
  try { return JSON.parse(s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()); } catch { return null; }
}

const CHECKER_SYSTEM = 'You are a strict, literal fact-checker for comic scripts. You only report clear, specific problems and never praise.';

/** Asks the model to compare the script with the source fields and list unsupported or distorted statements. */
async function factCheck(call, fields, script) {
  const prompt = `Compare this comic SCRIPT with the SOURCE FIELDS it was written from. List every statement in the script that is a problem:
- "unsupported": states a fact, cause, event, name, number, ranking or consequence that the fields do not state. In beat 1 the only allowed scene detail is a neutral visual of the place/industry; anything that asserts an event, trend or condition is unsupported.
- "altered": changes or distorts something the fields state (a number, date, order of events, who did what).
- "role": in beat 4 a speaker says something that contradicts their field (the DECISION MAKER voices DECISION; the RISK RAISER voices RISK) or adds a justification the fields do not give.
- "leading": beat 5 hints which option is right, reveals the outcome, or uses loaded words not in the fields.
Report only clear problems. If the script is faithful, return an empty list.
Return JSON only: {"issues":[{"beat":1,"type":"unsupported","quote":"exact words from the script","problem":"one short sentence"}]}

${fieldsBlock(fields)}
SCRIPT:
${script}`;
  const r = await call([{ role: 'user', text: prompt }], 2000, { system: CHECKER_SYSTEM, json: true });
  const parsed = parseJson(r.text);
  return Array.isArray(parsed?.issues) ? parsed.issues.filter((i) => i && i.quote && i.problem) : [];
}

const describeIssue = (i) => `beat ${i.beat ?? '?'} (${i.type || 'issue'}): "${String(i.quote).slice(0, 140)}" — ${i.problem}`;

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
    const check = (text) => [...validate(text, fields, beatNum), ...validateBeats(text, fields, beatNum)];
    let messages = [{ role: 'user', text: prompt }];
    let result = await call(messages, maxTokens);
    let problems = check(result.text);

    if (problems.length) {
      // Self-correction pass: show the model its own draft and the specific problems.
      messages = [
        ...messages,
        { role: 'assistant', text: result.text },
        { role: 'user', text: `Your draft has these problems:
- ${problems.join('\n- ')}

Rewrite it fixing every problem. Remove or correct anything not supported by the fields. Output only the corrected markdown in the same format.` },
      ];
      const retry = await call(messages, maxTokens);
      const retryProblems = check(retry.text);
      if (retryProblems.length <= problems.length) { result = retry; problems = retryProblems; }
    }

    // Fact-check pass: a second, literal read of the script against the fields; flagged statements are rewritten.
    let remaining = [];
    if (process.env.SCRIPT_VERIFY !== '0') {
      try {
        const issues = await factCheck(call, fields, result.text);
        remaining = issues;
        if (issues.length) {
          const fixed = await call([
            { role: 'user', text: prompt },
            { role: 'assistant', text: result.text },
            { role: 'user', text: `A fact-checker found these problems:
- ${issues.map(describeIssue).join('\n- ')}

Fix every one: remove or rewrite each flagged statement so that it is supported by the fields. Change nothing else. Output the complete corrected script in the same markdown format.` },
          ], maxTokens);
          const fixedProblems = check(fixed.text);
          if (fixedProblems.length <= problems.length) {
            result = fixed;
            problems = fixedProblems;
            remaining = await factCheck(call, fields, fixed.text);
          }
        }
      } catch { /* the fact-check is best-effort; keep the script we have */ }
    }
    const warnings = [...problems, ...remaining.map((i) => 'fact-check: ' + describeIssue(i))];

    res.status(200).json({ text: result.text, truncated: result.truncated, warnings });
  } catch (err) {
    if (err.upstream) {
      res.status(502).json({ error: err.message, detail: err.detail });
    } else {
      res.status(500).json({ error: 'Server error generating the script.', detail: String(err) });
    }
  }
}
