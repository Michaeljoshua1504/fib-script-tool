import { useState, useRef, useCallback } from 'react'

const FIELD_DEFS = [
  { id: 'fTitle', label: 'Case title', type: 'text', group: 'Beat 1 · Cold open', placeholder: 'FIB-0XX — short case name' },
  { id: 'fDate', label: 'Date & location', type: 'text', group: 'Beat 1 · Cold open', placeholder: 'Month Year, location' },
  { id: 'fNodes', label: 'Chain nodes (one per line: Label: description)', type: 'textarea', group: 'Beat 2 · Normal operations', placeholder: 'Supplier: ...\nManufacturer: ...\nRegulator: ...' },
  { id: 'fShock', label: 'What broke, and which nodes it hit', type: 'textarea', group: 'Beat 3 · The shock' },
  { id: 'fDecision', label: 'The decision actually taken', type: 'textarea', group: 'Beats 4 & 5 · Two reactions, the decision beat' },
  { id: 'fDecisionMaker', label: 'Who made / defends this call (role or name)', type: 'text', group: 'Beats 4 & 5 · Two reactions, the decision beat', placeholder: 'e.g. Leadership' },
  { id: 'fRisk', label: 'The risk or trade-off that got overlooked or skipped', type: 'textarea', group: 'Beats 4 & 5 · Two reactions, the decision beat' },
  { id: 'fRiskRaiser', label: 'Who would raise that risk (role or name)', type: 'text', group: 'Beats 4 & 5 · Two reactions, the decision beat', placeholder: 'e.g. Engineering' },
  { id: 'fOutcome', label: 'The real outcome, with every number and date', type: 'textarea', group: 'Beat 6 · Fallout' },
  { id: 'fLesson', label: "The one fact that proves the point, if there is one", type: 'textarea', group: 'Beat 7 · Lesson line (optional)', placeholder: "e.g. which documented decision was marked 'not done'" },
]
const GROUP_ORDER = [
  'Beat 1 · Cold open', 'Beat 2 · Normal operations', 'Beat 3 · The shock',
  'Beats 4 & 5 · Two reactions, the decision beat', 'Beat 6 · Fallout', 'Beat 7 · Lesson line (optional)',
]
const GROUP_TAG_CLASS = { 0: 'c1', 1: 'c2', 2: 'c3', 3: 'c4', 4: 'c2', 5: 'c1' }
const EMPTY_FIELDS = Object.fromEntries(FIELD_DEFS.map((f) => [f.id, '']))
const PANEL_ACCENTS = ['--disruption', '--improvement', '--accent-yellow']

const SKETCH_LABELS = [
  'Establishing shot', 'Chain map — see above', 'The break',
  'Two-shot — reaction', 'Your turn: the fork', 'Aftermath', 'Closing shot',
]

const SKETCH_SVGS = [
  `<svg viewBox="0 0 140 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="34" width="46" height="34"/><path d="M18 34 L41 18 L64 34"/><rect x="30" y="46" width="8" height="8"/><rect x="46" y="46" width="8" height="8"/><path d="M90 14 L78 40 L92 40 L80 66" stroke="var(--panel-accent)" stroke-width="3"/></svg>`,
  `<svg viewBox="0 0 140 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="20" cy="40" r="10"/><circle cx="70" cy="40" r="10"/><circle cx="120" cy="40" r="10"/><path d="M32 40 H58"/><path d="M52 34 L58 40 L52 46"/><path d="M82 40 H108"/><path d="M102 34 L108 40 L102 46"/></svg>`,
  `<svg viewBox="0 0 140 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M70 12 L124 68 H16 Z"/><path d="M70 30 V50" stroke="var(--panel-accent)" stroke-width="3"/><circle cx="70" cy="58" r="2" fill="var(--panel-accent)" stroke="none"/></svg>`,
  `<svg viewBox="0 0 140 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="42" height="18" rx="5" stroke="var(--panel-accent)"/><path d="M18 26 L14 34 L26 26" stroke="var(--panel-accent)"/><rect x="92" y="8" width="42" height="18" rx="5" stroke="var(--panel-accent)"/><path d="M122 26 L126 34 L114 26" stroke="var(--panel-accent)"/><circle cx="28" cy="52" r="9"/><path d="M28 61 V74 M18 68 L28 72 L38 68"/><circle cx="112" cy="52" r="9"/><path d="M112 61 V74 M102 68 L112 72 L122 68"/></svg>`,
  null,
  `<svg viewBox="0 0 140 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20 H130 M10 20 V70" stroke="var(--hairline-strong)"/><path d="M16 28 L46 40 L70 34 L100 60 L128 66" stroke="var(--panel-accent)" stroke-width="3"/><circle cx="128" cy="66" r="3" fill="var(--panel-accent)" stroke="none"/></svg>`,
  `<svg viewBox="0 0 140 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="70" cy="34" r="22"/><path d="M60 56 H80 M62 64 H78 M64 70 H76"/><path d="M70 6 V14 M48 12 L54 18 M92 12 L86 18" stroke="var(--panel-accent)" stroke-width="3"/></svg>`,
]

const EXAMPLE_014 = {
  fTitle: 'FIB-014 — Samsung Galaxy Note 7 Battery Fires and Recall (2016)',
  fDate: 'August–October 2016, South Korea / global',
  fNodes: `Samsung SDI: primary battery supplier, Samsung subsidiary
ATL (Amperex Technology Limited): backup battery supplier, Hong Kong
Samsung Electronics: OEM and designer of the Galaxy Note 7
Wireless carriers and retailers: AT&T, Verizon, T-Mobile, Sprint, Best Buy, Samsung.com
Regulators and aviation authorities: CPSC, FAA, EASA`,
  fShock: `Within days of the August 2016 launch, Note 7 devices began overheating and catching fire while charging. The battery cavity was designed too small for the desired capacity, leaving insufficient manufacturing tolerance for either supplier. Samsung SDI's batteries had insufficient insulation tape at the positive electrode corner, causing short-circuits under compression. 92 US reports were filed within weeks, including 26 burns and 55 property damage events including car fires.`,
  fDecision: `First recall: 2.5 million units recalled globally. Samsung switches replacement battery production to ATL, a second supplier, without extended qualification under the Note 7's real chassis constraints, to ship fast before the holiday season and stay ahead of the iPhone 7.`,
  fDecisionMaker: 'Leadership',
  fRisk: `Independent third-party safety certification of the ATL batteries under real Note 7 operating conditions was never obtained before restarting sales — this step was explicitly skipped.`,
  fRiskRaiser: 'Engineering',
  fOutcome: `Three weeks after the ATL-battery replacements shipped, those units caught fire too, through a different defect (welding burrs and missing insulation tape in a different location). On October 11, 2016, Samsung permanently discontinued the Galaxy Note 7, after 3.1 million units were recalled in total. A global airline ban followed, first from cabin use, then from checked luggage. Samsung achieved a 96% global return rate within three months. Total cost: at least $5.3 billion, with about $17 billion in market capitalisation lost. Samsung recovered the following year with the Galaxy S8, launched on a new 8-point battery safety protocol, which went on to sell strongly.`,
  fLesson: `Of the 14 documented decisions for this case, the one explicitly marked "not done" is independent certification of the backup supplier before shipping.`,
}

const EXAMPLE_010 = {
  fTitle: 'FIB-010 — Cisco Systems $2.25B Inventory Write-Down (2001): Demand-Signal Distortion and the Bullwhip Effect',
  fDate: '2000–2001 (write-down announced May 2001), United States / global',
  fNodes: `End customers (telecoms/dot-coms): the ultimate buyers whose demand signals started the chain
Cisco Systems (OEM): manufactures networking infrastructure — routers, switches, optical equipment
Contract manufacturers (global): build Cisco's hardware
Component suppliers (chips, boards, optical): supply parts to contract manufacturers
Raw material suppliers: supply materials to component suppliers
Cisco warehouses / inventory: where the finished and in-process stock accumulated`,
  fShock: `The dot-com bubble collapsed in 2000–2001. Cisco's entire customer base — telecom and dot-com companies — simultaneously stopped spending, and orders placed under speculative and double-ordering conditions were cancelled en masse. Cisco was left holding $2.25 billion of custom-built inventory, built against demand signals inflated by shortage gaming, double-ordering, and speculative ordering across the supply chain. Cisco's own ERP could see incoming orders and warehouse stock, but had no visibility into the $2.25 billion being built in contract manufacturers' pipelines against those inflated orders.`,
  fDecision: `Halt production the moment demand anomalies appeared, write off the $2.25 billion of stranded inventory, and cut more than 8,000 jobs to match the collapsed demand — while publicly attributing the disaster to the dot-com crash as unforeseeable, a "100-year flood."`,
  fDecisionMaker: 'Leadership',
  fRisk: `Cisco had no system to detect or correct for shortage gaming, double-ordering, or speculative ordering anywhere in its supply chain — each tier operated on its own local forecast, with near-zero visibility into real end-customer demand, so the inflated signal was amplified at every step with nothing to catch it.`,
  fRiskRaiser: 'Supply Chain',
  fOutcome: `The $2.25 billion inventory write-down drove Cisco's first quarterly loss in more than 11 years — a $2.69 billion loss. The stock fell from $82 to $13. More than 8,000 jobs were cut. Most of the written-off inventory was custom-built with no resale value and was scrapped and destroyed. Cisco went on to build an e-hub giving all supply-chain tiers a shared, real-time demand and inventory view, and adopted Collaborative Planning, Forecasting and Replenishment (CPFR) with its contract manufacturers to share real demand data instead of forecasts.`,
  fLesson: `The case's own root-cause analysis states it directly: Cisco had no system to detect or correct for double-ordering, shortage gaming, or speculative ordering anywhere in its supply chain before the crash.`,
}

const EXAMPLE_001 = {
  fTitle: 'FIB-001 — Philips Albuquerque RF-Chip Fire (2000): Nokia vs. Ericsson',
  fDate: '17 March 2000, Albuquerque, New Mexico, USA',
  fNodes: `Philips Fab 22 (Albuquerque): sole supplier of RF/ASIC chips, served ~30 customers, ~40% of output to Nokia and Ericsson combined
Nokia (Espoo, manufacturer): #1 handset maker in 2000, ~30.6% market share
Ericsson (Stockholm, manufacturer): #3 handset maker in 2000, ~9.7% market share, single-sourced from Philips
Logistics (JIT inbound): lean, no buffer stock
Customers: operators, retailers and consumers in the 2000 GSM market`,
  fShock: `On 17 March 2000 at 8 PM, a lightning strike/power surge ignited a fire in a Philips Albuquerque clean room. The fire itself lasted only about 10 minutes, but smoke, soot and water contaminated the clean room and destroyed almost the entire RF-chip stock. Philips first told both customers it expected to be running again in about a week; the real recovery took months. Ericsson was single-sourced from this plant with no buffer stock.`,
  fDecision: `Nokia escalated immediately: got Philips' top management on the phone for daily updates, sent engineers on-site, and — once they learned the real damage was months not a week — moved fast to lock up Philips' other fabs and spare US and Japanese capacity, redesigning their chips to accept alternate suppliers.`,
  fDecisionMaker: 'Nokia',
  fRisk: `Ericsson took Philips' one-week estimate at face value and made no contingency moves. It was single-sourced from the same plant with no buffer stock, and by the time it recognised the real scale of the problem, Nokia had already booked all the available spare capacity worldwide.`,
  fRiskRaiser: 'Ericsson',
  fOutcome: `Nokia's early escalation meant only minor delays — it kept shipping and grew market share. Ericsson lost about $400 million directly, came up roughly 7 million phones short, delayed its T36 launch, and lost market share. In October 2001 Ericsson exited standalone handset manufacturing, moving phones into the Sony Ericsson joint venture. Philips itself lost about $40 million and closed the Albuquerque plant in 2003.`,
  fLesson: `In the case's own scored ranking of response options (out of 5), Nokia's actual strategy — escalate and demand daily updates from day one — scored highest at 4.0, ahead of every other option including waiting.`,
}

function parseBeats(markdown) {
  const lines = markdown.split('\n')
  const beats = []
  let current = null
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (trimmed.startsWith('## ')) {
      if (current) beats.push(current)
      current = { title: trimmed.slice(3).trim(), body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + raw
    }
  }
  if (current) beats.push(current)
  const fallbackTitles = ['1. Cold open', '2. Normal operations', '3. The shock', '4. Two reactions', '5. The decision beat', '6. Fallout', '7. Lesson line']
  while (beats.length < 7) beats.push({ title: fallbackTitles[beats.length], body: '' })
  return beats.slice(0, 7)
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function shortLabel(s) {
  s = (s || '—').trim()
  return s.length > 16 ? s.slice(0, 15) + '…' : s
}

function initials(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?'
}

function firstSentence(text) {
  const clean = (text || '').replace(/\*\*(.+?):\*\*/g, '$1:').replace(/\n/g, ' ').trim()
  const m = clean.match(/^[^.!?]*[.!?]/)
  let s = m ? m[0].trim() : clean.slice(0, 90)
  if (s.length > 95) s = s.slice(0, 92).trim() + '…'
  return s || '—'
}

function buildDecisionDiagram(dm, rr) {
  const a = escapeHtml(shortLabel(dm))
  const b = escapeHtml(shortLabel(rr))
  return `<svg viewBox="0 0 280 136" width="100%" style="height:auto;display:block;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <text x="140" y="12" text-anchor="middle" font-size="9" stroke="none" fill="var(--muted)">The shock</text>
    <circle cx="140" cy="18" r="3" fill="currentColor" stroke="none"/>
    <path d="M140 21 V36"/>
    <path d="M140 36 H60 V52" stroke="var(--panel-accent)"/>
    <path d="M140 36 H220 V52" stroke="var(--panel-accent)"/>
    <rect x="18" y="52" width="84" height="28" rx="6" stroke="var(--panel-accent)"/>
    <rect x="178" y="52" width="84" height="28" rx="6" stroke="var(--panel-accent)"/>
    <text x="60" y="70" text-anchor="middle" font-size="10" font-weight="700" stroke="none" fill="currentColor">${a}</text>
    <text x="220" y="70" text-anchor="middle" font-size="10" font-weight="700" stroke="none" fill="currentColor">${b}</text>
    <path d="M60 80 V96 H140 V110"/>
    <path d="M220 80 V96 H140 V110"/>
    <circle cx="140" cy="114" r="3" fill="currentColor" stroke="none"/>
    <text x="140" y="130" text-anchor="middle" font-size="9" stroke="none" fill="var(--muted)">Real outcome</text>
  </svg>`
}

function characterPrompt(name, verb, caseTitle, where) {
  const title = (caseTitle || 'a supply-chain case').replace(/^FIB-\d+\s*—\s*/, '')
  return `Character reference illustration for a supply-chain comic panel series. Character: "${name}", the side that ${verb}. Case context: ${title}${where ? ', ' + where : ''}. Style: clean editorial comic illustration, a consistent, reusable character design to reuse across every panel they appear in, professional business setting, no logos or text in the image, no real named individuals — a representative figure only.`
}

/** Markdown-lite -> array of React nodes (no dangerouslySetInnerHTML). */
function renderBeatBody(md) {
  const lines = (md || '').split('\n')
  const out = []
  let listBuf = null
  let key = 0
  const flushList = () => {
    if (listBuf) { out.push(<ul key={`ul-${key++}`}>{listBuf}</ul>); listBuf = null }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('- ')) {
      if (!listBuf) listBuf = []
      listBuf.push(<li key={`li-${key++}`}>{line.slice(2)}</li>)
      continue
    }
    flushList()
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/)
    if (m) {
      out.push(<div className="line" key={`dl-${key++}`}><span className="speaker">{m[1]}:</span> {m[2]}</div>)
      continue
    }
    if (line.length > 0) out.push(<p key={`p-${key++}`}>{line}</p>)
  }
  flushList()
  return out
}

function parseNodeLines(fNodes) {
  return fNodes.split('\n').map((l) => l.trim()).filter(Boolean)
}
function splitNodeLine(line) {
  const idx = line.indexOf(':')
  if (idx === -1) return { label: line, desc: '' }
  return { label: line.slice(0, idx).trim(), desc: line.slice(idx + 1).trim() }
}

async function callApi(fields, beatNum) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(beatNum ? { fields, beatNum } : { fields }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

async function callImageApi(prompt) {
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

/** Textarea that grows to fit its content instead of scrolling internally. */
function AutoGrowTextarea({ value, onChange, className }) {
  const ref = useRef(null)
  const grow = (el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }
  return (
    <textarea
      ref={(el) => { ref.current = el; grow(el) }}
      className={className}
      value={value}
      onChange={(e) => { onChange(e); grow(e.target) }}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  )
}

// ---------- Fields form ----------

function FieldsForm({ fields, setField, onLoadExample, onGenerate, busy, error, scriptBeats, onOpenCase, onCopy, copied }) {
  return (
    <div className="wrap narrow">
      <div className="hero-band">
        <div className="eyebrow">Production tool</div>
        <h1>Fields in. Script out.</h1>
        <p className="deck">Each field below feeds one specific beat — fill them from the case's existing dashboard data. No guessing about who says what: you assign the two voices in beat 4 directly, so the script can't mix up which side argued what.</p>
      </div>

      {GROUP_ORDER.map((group, gi) => (
        <div className="card" key={group}>
          <span className={`card-tag ${GROUP_TAG_CLASS[gi]}`}>{group}</span>
          {FIELD_DEFS.filter((f) => f.group === group).map((f) => (
            <div className="field" key={f.id}>
              <label className="field-label" htmlFor={f.id}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={f.id} value={fields[f.id]} placeholder={f.placeholder} onChange={(e) => setField(f.id, e.target.value)} />
              ) : (
                <input type="text" id={f.id} value={fields[f.id]} placeholder={f.placeholder} onChange={(e) => setField(f.id, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="controls">
        <button type="button" className="ghost" onClick={() => onLoadExample(EXAMPLE_014)} disabled={busy}>Load FIB-014 example</button>
        <button type="button" className="ghost" onClick={() => onLoadExample(EXAMPLE_010)} disabled={busy}>Load FIB-010 example</button>
        <button type="button" className="ghost" onClick={() => onLoadExample(EXAMPLE_001)} disabled={busy}>Load FIB-001 example</button>
        <button type="button" className="primary" onClick={onGenerate} disabled={busy}>{busy ? 'Thinking…' : 'Generate script'}</button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {scriptBeats && (
        <div className="output visible">
          <div>
            {scriptBeats.map((b, i) => (
              <div key={i}><h3>{b.title}</h3>{renderBeatBody(b.body)}</div>
            ))}
          </div>
          <div className="output-actions">
            <button type="button" className="ghost" onClick={onCopy}>{copied ? 'Copied' : 'Copy script'}</button>
            <button type="button" className="primary" onClick={onOpenCase}>Open case page →</button>
          </div>
        </div>
      )}

      <p className="footer-note">Built for the Future Industry in a Box case catalog. Each field maps to one beat, so the script can't invent facts or mix up who said what — it can only assemble what you gave it.</p>
    </div>
  )
}

// ---------- Case page ----------

function FlowRow({ fields, editable, onEditNode }) {
  const lines = parseNodeLines(fields.fNodes)
  return (
    <div className="flow-row">
      {lines.map((line, i) => {
        const { label, desc } = splitNodeLine(line)
        return (
          <div key={i} style={{ display: 'contents' }}>
            <div className="flow-node" onClick={editable ? () => onEditNode(i, lines) : undefined}>
              <div className="n-label">{label}</div>
              <div className="n-desc">{desc}</div>
            </div>
            {i < lines.length - 1 && <div className="flow-arrow">→</div>}
          </div>
        )
      })}
    </div>
  )
}

function CastCard({ color, name, roleLabel, promptText, imageState, onGenerateImage, onCopyPrompt, copied }) {
  return (
    <div className="cast-card">
      <div className="cast-avatar" style={{ background: color }}>{initials(name)}</div>
      <div className="cast-info">
        <div className="cast-name">{name}</div>
        <div className="cast-role">{roleLabel}</div>
      </div>
      {promptText && (
        <>
          <button type="button" className="ghost small prompt-btn" onClick={onCopyPrompt}>
            {copied ? 'Copied — paste into Gemini/DALL·E/etc.' : 'Copy character prompt'}
          </button>
          <button type="button" className="ghost small prompt-btn" onClick={onGenerateImage} disabled={imageState?.busy}>
            {imageState?.busy ? 'Generating…' : 'Generate reference image'}
          </button>
          {imageState?.error && <div className="error-box" style={{ width: '100%' }}>{imageState.error}</div>}
          {imageState?.dataUrl && (
            <img src={imageState.dataUrl} alt={`${name} reference`} className="cast-image" />
          )}
        </>
      )}
    </div>
  )
}

function CasePage({ fields, setField, scriptBeats, setScriptBeats, onBack, onOpenLearner, regenAll, busy, status, error }) {
  const [editingNode, setEditingNode] = useState(null)
  const [editingPanel, setEditingPanel] = useState(null)
  const [panelBusy, setPanelBusy] = useState(null)
  const [panelError, setPanelError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedChar, setCopiedChar] = useState(null)
  const [images, setImages] = useState({ dm: null, rr: null }) // { busy, error, dataUrl }

  const handleEditNode = (i, lines) => setEditingNode({ index: i, value: lines[i] })
  const saveNode = () => {
    const lines = parseNodeLines(fields.fNodes)
    lines[editingNode.index] = editingNode.value.trim()
    setField('fNodes', lines.join('\n'))
    setEditingNode(null)
  }

  const redoPanel = async (i) => {
    setPanelError('')
    setPanelBusy(i)
    try {
      const result = await callApi(fields, i + 1)
      const parsed = parseBeats(result.text)
      const newBeat = parsed[0] && parsed[0].body.trim() ? parsed[0] : { title: scriptBeats[i].title, body: result.text }
      const next = [...scriptBeats]
      next[i] = { title: scriptBeats[i].title, body: newBeat.body }
      setScriptBeats(next)
    } catch (e) {
      setPanelError(e.message || 'Could not redo this panel. Try again.')
    } finally {
      setPanelBusy(null)
    }
  }

  const saveEditedPanel = (i, text) => {
    const next = [...scriptBeats]
    next[i] = { ...next[i], body: text }
    setScriptBeats(next)
    setEditingPanel(null)
  }

  const copyScript = async () => {
    const text = scriptBeats.map((b) => `${b.title}\n${b.body}`).join('\n\n')
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  const dm = fields.fDecisionMaker.trim() || 'Decision maker'
  const rr = fields.fRiskRaiser.trim() || 'Risk raiser'
  const dmPrompt = characterPrompt(dm, 'makes and defends the decision', fields.fTitle, fields.fDate)
  const rrPrompt = characterPrompt(rr, 'raises the overlooked risk', fields.fTitle, fields.fDate)

  const copyPrompt = async (key, text) => {
    try { await navigator.clipboard.writeText(text); setCopiedChar(key); setTimeout(() => setCopiedChar(null), 2000) } catch {}
  }

  const generateImage = async (key, text) => {
    setImages((s) => ({ ...s, [key]: { busy: true, error: '', dataUrl: s[key]?.dataUrl } }))
    try {
      const result = await callImageApi(text)
      setImages((s) => ({ ...s, [key]: { busy: false, error: '', dataUrl: `data:${result.mimeType};base64,${result.data}` } }))
    } catch (e) {
      setImages((s) => ({ ...s, [key]: { busy: false, error: e.message || 'Could not generate an image.', dataUrl: s[key]?.dataUrl } }))
    }
  }

  const sceneChars = [
    'Narrator only', 'No characters — diagram panel', 'Narrator only',
    `${shortLabel(dm)} + ${shortLabel(rr)}`, 'Narrator, direct to reader', 'Narrator only', 'Narrator only',
  ]

  return (
    <div className="wrap">
      <div className="case-topbar"><button type="button" className="back-link" onClick={onBack}>← Back to fields</button></div>

      <div className="case-header">
        <div className="two-col">
          <div><label className="field-label">Case title</label><input type="text" value={fields.fTitle} onChange={(e) => setField('fTitle', e.target.value)} /></div>
          <div><label className="field-label">Date &amp; location</label><input type="text" value={fields.fDate} onChange={(e) => setField('fDate', e.target.value)} /></div>
        </div>
      </div>

      <div className="section-label">Chain — click a node to edit it</div>
      {editingNode ? (
        <div className="flow-row">
          <textarea autoFocus className="flow-node" style={{ minHeight: 56, fontSize: 12 }} value={editingNode.value}
            onChange={(e) => setEditingNode({ ...editingNode, value: e.target.value })} onBlur={saveNode} />
        </div>
      ) : (
        <FlowRow fields={fields} editable onEditNode={handleEditNode} />
      )}

      <div className="section-label">Case facts — click any field to edit it directly</div>
      <div className="facts-grid">
        <div className="fact-card"><div className="fact-label">Decision</div><AutoGrowTextarea value={fields.fDecision} onChange={(e) => setField('fDecision', e.target.value)} /></div>
        <div className="fact-card"><div className="fact-label">Decision maker</div><input type="text" value={fields.fDecisionMaker} onChange={(e) => setField('fDecisionMaker', e.target.value)} /></div>
        <div className="fact-card"><div className="fact-label">Risk / overlooked trade-off</div><AutoGrowTextarea value={fields.fRisk} onChange={(e) => setField('fRisk', e.target.value)} /></div>
        <div className="fact-card"><div className="fact-label">Risk raiser</div><input type="text" value={fields.fRiskRaiser} onChange={(e) => setField('fRiskRaiser', e.target.value)} /></div>
        <div className="fact-card"><div className="fact-label">Outcome</div><AutoGrowTextarea value={fields.fOutcome} onChange={(e) => setField('fOutcome', e.target.value)} /></div>
        <div className="fact-card"><div className="fact-label">Lesson fact</div><AutoGrowTextarea value={fields.fLesson} onChange={(e) => setField('fLesson', e.target.value)} /></div>
      </div>

      <div className="section-label">Cast &amp; scene list — what an illustrator needs to know</div>
      <div className="cast-grid">
        <CastCard color="var(--disruption)" name={dm} roleLabel="Speaking role — makes the call" promptText={dmPrompt}
          imageState={images.dm} copied={copiedChar === 'dm'}
          onCopyPrompt={() => copyPrompt('dm', dmPrompt)} onGenerateImage={() => generateImage('dm', dmPrompt)} />
        <CastCard color="var(--improvement)" name={rr} roleLabel="Speaking role — raises the risk" promptText={rrPrompt}
          imageState={images.rr} copied={copiedChar === 'rr'}
          onCopyPrompt={() => copyPrompt('rr', rrPrompt)} onGenerateImage={() => generateImage('rr', rrPrompt)} />
        <div className="cast-card">
          <div className="cast-avatar" style={{ background: 'var(--muted)' }}>N</div>
          <div className="cast-info"><div className="cast-name">Narrator</div><div className="cast-role">Unseen voice — captions only, no art needed</div></div>
        </div>
      </div>

      <div className="scene-list">
        {scriptBeats.map((beat, i) => (
          <div className="scene-row" key={i}>
            <div className="scene-panel">#{i + 1}</div>
            <div><div className="scene-meta">{SKETCH_LABELS[i]}</div><div className="scene-chars">{sceneChars[i]}</div></div>
            <div>{firstSentence(beat.body)}</div>
          </div>
        ))}
      </div>

      <div className="section-label storyboard-label">Storyboard</div>
      <div className="panel-grid">
        {scriptBeats.map((beat, i) => (
          <div className="storyboard-step" style={{ '--panel-accent': `var(${PANEL_ACCENTS[i % PANEL_ACCENTS.length]})` }} key={i}>
            <div className="panel-card">
              <div className="panel-num-badge">#{i + 1}</div>
              <div className="panel-title">{beat.title}</div>
              <div
                className={i === 4 ? 'sketch-box diagram' : 'sketch-box'}
                dangerouslySetInnerHTML={{
                  __html: `${i === 4 ? buildDecisionDiagram(dm, rr) : SKETCH_SVGS[i]}<span class="sketch-label">${escapeHtml(SKETCH_LABELS[i])}</span>`,
                }}
              />
              {editingPanel === i ? (
                <textarea autoFocus className="panel-edit-area" defaultValue={beat.body.trim()}
                  onBlur={(e) => saveEditedPanel(i, e.target.value)} />
              ) : (
                <div className="panel-body" style={{ cursor: 'text' }} onClick={() => setEditingPanel(i)}>{renderBeatBody(beat.body)}</div>
              )}
              {panelBusy === i && <div className="panel-busy-note">Redoing this panel…</div>}
              <div className="panel-actions">
                <button type="button" className="ghost small" onClick={() => setEditingPanel(i)}>Edit text</button>
                <button type="button" className="ghost small" disabled={panelBusy !== null} onClick={() => redoPanel(i)}>Redo this panel</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="controls" style={{ marginTop: 24 }}>
        <button type="button" className="primary" onClick={onOpenLearner}>Preview as learner page →</button>
        <button type="button" className="ghost" onClick={regenAll} disabled={busy}>Regenerate entire script</button>
        <button type="button" className="ghost" onClick={copyScript}>{copied ? 'Copied' : 'Copy full script'}</button>
      </div>
      {status && <div className="status">{status}</div>}
      {(error || panelError) && <div className="error-box">{error || panelError}</div>}
    </div>
  )
}

// ---------- Learner preview ----------

function buildLearnerSteps() {
  return [
    { kind: 'intro', label: 'Before the disruption', beatIndex: 0, accent: '--improvement' },
    { kind: 'beat', label: 'The shock', beatIndex: 2, accent: '--disruption' },
    { kind: 'predict', label: 'Your turn', accent: '--accent-yellow' },
    { kind: 'beat', label: 'What really happened', beatIndex: 3, accent: '--disruption' },
    { kind: 'beat', label: 'Fallout', beatIndex: 5, accent: '--improvement' },
    { kind: 'lesson', label: 'The lesson', beatIndex: 6, accent: '--accent-yellow' },
  ]
}

function LearnerPreview({ fields, scriptBeats, onBack }) {
  const steps = useState(buildLearnerSteps)[0]
  const [stepIndex, setStepIndex] = useState(0)
  const [choice, setChoice] = useState(null)
  const step = steps[stepIndex]

  const next = () => {
    if (stepIndex === steps.length - 1) { setStepIndex(0); setChoice(null) }
    else setStepIndex(stepIndex + 1)
    window.scrollTo(0, 0)
  }
  const back = () => { if (stepIndex > 0) { setStepIndex(stepIndex - 1); window.scrollTo(0, 0) } }

  return (
    <div className="wrap narrow">
      <div className="case-topbar"><button type="button" className="back-link" onClick={onBack}>← Back to case page</button></div>
      <div className="hero-band">
        <div className="eyebrow">Learner preview — generated, not hand-built</div>
        <h1>{fields.fTitle || 'Untitled case'}</h1>
        <p className="deck">{fields.fDate}</p>
      </div>

      <div className="progress-row">
        {steps.map((s, i) => (
          <div key={i} className={`progress-dot${i < stepIndex ? ' done' : ''}${i === stepIndex ? ' current' : ''}`} />
        ))}
      </div>

      <div className="learner-step-card" style={{ '--panel-accent': `var(${step.accent || '--ink'})` }}>
        <div className="learner-step-label">Step {stepIndex + 1} of {steps.length} · {step.label}</div>

        {step.kind === 'intro' && (<>
          <FlowRow fields={fields} editable={false} />
          <div className="panel-body">{renderBeatBody(scriptBeats[step.beatIndex].body)}</div>
        </>)}

        {step.kind === 'beat' && (
          <div className="panel-body">{renderBeatBody(scriptBeats[step.beatIndex].body)}</div>
        )}

        {step.kind === 'predict' && (<>
          <div className="panel-body">{renderBeatBody(scriptBeats[4].body)}</div>
          <div className="predict-choices">
            <button type="button" className={`predict-choice${choice === 'A' ? ' selected' : ''}`} onClick={() => setChoice('A')}>
              <div className="pc-tag">Option A</div><div className="pc-label">{fields.fDecisionMaker || 'Act now'}</div>
            </button>
            <button type="button" className={`predict-choice${choice === 'B' ? ' selected' : ''}`} onClick={() => setChoice('B')}>
              <div className="pc-tag">Option B</div><div className="pc-label">{fields.fRiskRaiser || 'Hold and verify'}</div>
            </button>
          </div>
        </>)}

        {step.kind === 'lesson' && (<>
          <div className="panel-body">{renderBeatBody(scriptBeats[step.beatIndex].body)}</div>
          {choice && (
            <div className="recap-line">
              {choice === 'A'
                ? `You went with ${fields.fDecisionMaker || 'Option A'}'s instinct — and that's exactly who acted in this case.`
                : `You leaned toward ${fields.fRiskRaiser || 'Option B'}'s caution — but in this case, ${fields.fDecisionMaker || 'the other side'} was the one who actually moved.`}
            </div>
          )}
        </>)}
      </div>

      <div className="controls">
        <button type="button" className="ghost" onClick={back} disabled={stepIndex === 0}>← Back</button>
        <button type="button" className="primary" onClick={next} disabled={step.kind === 'predict' && !choice}>
          {step.kind === 'predict' && !choice ? 'Pick one to continue' : stepIndex === steps.length - 1 ? 'Restart ↻' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

// ---------- App ----------

export default function App() {
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [view, setView] = useState('form') // 'form' | 'case' | 'learner'
  const [scriptBeats, setScriptBeats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const setField = (id, value) => setFields((f) => ({ ...f, [id]: value }))
  const loadExample = (data) => setFields({ ...EMPTY_FIELDS, ...data })
  const hasAnyInput = () => Object.values(fields).some((v) => v.trim().length > 0)

  const generateFull = useCallback(async () => {
    setError('')
    if (!hasAnyInput()) { setError('Fill in the fields first — or click one of the "Load example" buttons to try it.'); return false }
    setBusy(true); setStatus('Thinking…')
    try {
      const result = await callApi(fields)
      setScriptBeats(parseBeats(result.text))
      setStatus(result.truncated ? 'Done — cut short, try trimming a field.' : 'Done.')
      return true
    } catch (e) {
      setError(e.message || 'Something went wrong generating the script. Try again.')
      setStatus('')
      return false
    } finally {
      setBusy(false)
    }
  }, [fields])

  const openCase = async () => {
    if (!scriptBeats) { const ok = await generateFull(); if (!ok) return }
    setView('case')
  }

  const regenAll = async () => {
    setStatus('Regenerating the full script…')
    const ok = await generateFull()
    setStatus(ok ? 'Done.' : '')
  }

  const copyScript = async () => {
    const text = scriptBeats.map((b) => `${b.title}\n${b.body}`).join('\n\n')
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  if (view === 'case' && scriptBeats) {
    return (
      <CasePage
        fields={fields} setField={setField}
        scriptBeats={scriptBeats} setScriptBeats={setScriptBeats}
        onBack={() => setView('form')}
        onOpenLearner={() => setView('learner')}
        regenAll={regenAll} busy={busy} status={status} error={error}
      />
    )
  }

  if (view === 'learner' && scriptBeats) {
    return <LearnerPreview fields={fields} scriptBeats={scriptBeats} onBack={() => setView('case')} />
  }

  return (
    <FieldsForm
      fields={fields} setField={setField} onLoadExample={loadExample}
      onGenerate={generateFull} busy={busy} error={error}
      scriptBeats={scriptBeats} onOpenCase={openCase}
      onCopy={copyScript} copied={copied}
    />
  )
}
