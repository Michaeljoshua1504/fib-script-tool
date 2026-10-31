// Vercel serverless function — POST /api/generate
// Body: { fields } for a full 7-beat script, or { fields, beatNum } to redraft one beat only.
// Builds the prompt server-side and calls the Anthropic API, so the key never reaches the browser.

const BEAT_DEFS = [
  { num: 1, title: 'Cold open', rule: "using CASE TITLE and DATE & LOCATION: one date/location line, then one establishing-shot scene description." },
  { num: 2, title: 'Normal operations', rule: "using CHAIN NODES exactly as given: a bullet list, one line per node listed, in the order given. Do not add, remove, merge, or rename nodes." },
  { num: 3, title: 'The shock', rule: "using THE SHOCK: a short narrator paragraph." },
  { num: 4, title: 'Two reactions', rule: "using DECISION, DECISION MAKER, RISK, and RISK RAISER. Exactly two panels. Panel 1: the speaker named in DECISION MAKER states the content of DECISION (paraphrased, punchy, comic dialogue). Panel 2: the speaker named in RISK RAISER raises the content of RISK (paraphrased), and the DECISION MAKER gives one short in-character reply defending the choice. Use these two labels exactly as given, never swapped, never a third speaker." },
  { num: 5, title: 'The decision beat', rule: "one short line framed as a direct question to the reader, built from the tension between DECISION and RISK." },
  { num: 6, title: 'Fallout', rule: "using OUTCOME: a short narrator paragraph, every number and date kept exactly as given." },
  { num: 7, title: 'Lesson line', rule: "if LESSON FACT is given, state it directly as the closing line, rephrased for punch but adding no claim, cause, ranking, or consequence beyond what LESSON FACT itself says; otherwise draw one short closing line stated only from facts in OUTCOME, with the same restriction. Never add a causal or superlative claim (\"this was the one that cost the most\", \"this is why it failed\") unless that exact claim is stated in the given fields." },
];

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
  return `You are drafting a comic script for the "Future Industry in a Box" project at Hof University, which teaches supply-chain concepts through short illustrated case comics. You are given the case data pre-sorted into labeled fields, each field feeding exactly one beat below. Produce a script using EXACTLY this 7-beat structure, in this order:

${beatList}

STRICT RULES:
- Use only the field contents given below. Never invent a number, date, name, or outcome not present in them.
- If a required field is empty and the beat truly cannot be written without it, write exactly: [missing: what's needed] for that beat only — never for beat 4's in-character reply line, which may be dramatized wording as long as it states no invented fact.
- Dialogue lines: short and punchy, comic style, under 20 words each, 2–4 lines per panel maximum.
- Output ONLY in this exact markdown shape, nothing before or after: "## 1. Cold open" style heading per beat; dialogue as "**Speaker:** line text"; the node list in beat 2 as "- Label: description"; plain paragraphs for narrator lines. No preamble, no closing remarks outside the 7 beats.

${fieldsBlock(fields)}`;
}

function buildBeatPrompt(fields, beatNum) {
  const def = BEAT_DEFS[beatNum - 1];
  const missingNote = beatNum === 4
    ? " — except the in-character reply line in panel 2, which may be dramatized wording as long as it states no invented fact."
    : ".";
  return `You are redrafting ONE beat of a 7-beat comic script for the "Future Industry in a Box" project at Hof University. Use the same labeled case fields below. Produce ONLY beat ${def.num}, following this rule exactly:

${def.num}. ${def.title} — ${def.rule}

STRICT RULES:
- Use only the field contents given below. Never invent a number, date, name, or outcome not present in them.
- If this beat truly cannot be written without a missing field, write exactly: [missing: what's needed]${missingNote}
- Dialogue lines (if any): short and punchy, comic style, under 20 words each, 2–4 lines per panel maximum.
- Output ONLY the markdown for this one beat, nothing before or after: a "## ${def.num}. ${def.title}" heading, then its body using these conventions: dialogue as "**Speaker:** line text", node lists as "- Label: description", plain paragraphs for narrator lines. No preamble, no extra commentary.

${fieldsBlock(fields)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in Vercel project settings.' });
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

  const prompt = beatNum ? buildBeatPrompt(fields, beatNum) : buildFullPrompt(fields);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: beatNum ? 600 : 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(502).json({ error: 'The Anthropic API returned an error.', detail });
      return;
    }

    const data = await upstream.json();
    const text = (data.content || []).map((block) => block.text || '').join('');
    const truncated = data.stop_reason === 'max_tokens';

    res.status(200).json({ text, truncated });
  } catch (err) {
    res.status(500).json({ error: 'Server error calling Anthropic.', detail: String(err) });
  }
}
