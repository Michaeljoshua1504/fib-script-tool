import { useState, useRef, useCallback, useEffect } from 'react'
import Library from './Library.jsx'
import { saveImages, savedForCase, downloadImage, downloadZip, fmtDateTime } from './storage.js'

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
  'Establishing shot', 'Chain map — in order', 'The break',
  'Two-shot — reaction', 'Your turn: the fork', 'Aftermath', 'Closing shot',
]

// icon for the decision-fork panel (it has no illustration slot of its own)
const FORK_SVG = `<svg viewBox="0 0 140 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="70" cy="12" r="6"/><path d="M70 18 V30 M70 30 H30 V46 M70 30 H110 V46"/><rect x="14" y="46" width="32" height="16" rx="5" stroke="var(--panel-accent)"/><rect x="94" y="46" width="32" height="16" rx="5" stroke="var(--panel-accent)"/><path d="M30 62 V70 H70 M110 62 V70 H70" /></svg>`

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
      listBuf.push(<li key={`li-${key++}`}>{line.slice(2).replaceAll('**', '')}</li>)
      continue
    }
    flushList()
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/)
    if (m) {
      out.push(<div className="line" key={`dl-${key++}`}><span className="speaker">{m[1]}:</span> {m[2]}</div>)
      continue
    }
    if (line.length > 0) out.push(<p key={`p-${key++}`}>{line.replaceAll('**', '')}</p>)
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

const PW_KEY = 'fib-app-password'
const getPassword = () => { try { return sessionStorage.getItem(PW_KEY) || '' } catch { return '' } }
const setPassword = (v) => { try { sessionStorage.setItem(PW_KEY, v) } catch {} }
const apiHeaders = () => ({ 'Content-Type': 'application/json', 'x-app-password': getPassword() })

async function callApi(fields, beatNum) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(beatNum ? { fields, beatNum } : { fields }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

async function callImageApi(payload) {
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(typeof payload === 'string' ? { prompt: payload } : payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json()
}

/** Textarea that grows to fit its content instead of scrolling internally. */
function AutoGrowTextarea({ value, onChange, className, ...rest }) {
  const ref = useRef(null)
  const grow = (el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }
  useEffect(() => { document.fonts?.ready.then(() => grow(ref.current)) }, [])
  return (
    <textarea
      ref={(el) => { ref.current = el; grow(el) }}
      {...rest}
      className={className}
      rows={1}
      value={value}
      onChange={(e) => { onChange(e); grow(e.target) }}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  )
}

// ---------- Fields form ----------

function FieldsForm({ fields, setField, onLoadExample, onGenerate, busy, error, scriptBeats, onOpenCase, onCopy, copied, onOpenLibrary }) {
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
                <AutoGrowTextarea id={f.id} value={fields[f.id]} placeholder={f.placeholder} onChange={(e) => setField(f.id, e.target.value)} />
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
        <button type="button" className="ghost" onClick={onOpenLibrary}>Saved library</button>
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

/** Chain of nodes in a balanced grid, numbered in order. Pass onSelect to make the nodes clickable. */
function FlowRow({ fields, onSelect, selected, maxCols = 5 }) {
  const lines = parseNodeLines(fields.fNodes)
  const rows = Math.max(1, Math.ceil(lines.length / maxCols))
  const cols = Math.max(1, Math.ceil(lines.length / rows)) // e.g. 6 nodes -> 3 + 3, 7 -> 4 + 3, 5 -> one row of 5
  return (
    <div className="flow-row" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {lines.map((line, i) => {
        const { label, desc } = splitNodeLine(line)
        const hasNext = i < lines.length - 1 && i % cols !== cols - 1
        const cls = `flow-node tone-${i % 7}${onSelect ? ' clickable' : ''}${selected === i ? ' selected' : ''}${hasNext ? ' has-next' : ''}`
        return (
          <div
            key={i}
            className={cls}
            onClick={onSelect ? () => onSelect(i) : undefined}
            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i) } } : undefined}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
          >
            <div className="n-step">{i + 1}</div>
            <div className="n-label">{label}</div>
            <div className="n-desc">{desc}</div>
          </div>
        )
      })}
    </div>
  )
}

/** Interactive decision flowchart: shock → two reactions → real outcome. Click any box to read its text. */
function DecisionFork({ fields }) {
  const [open, setOpen] = useState(null)
  const dm = fields.fDecisionMaker.trim() || 'Decision maker'
  const rr = fields.fRiskRaiser.trim() || 'Risk raiser'
  const toggle = (k) => setOpen(open === k ? null : k)
  const detail = {
    shock: { tag: 'The shock', text: fields.fShock },
    dm: { tag: `${dm} — the decision taken`, text: fields.fDecision },
    rr: { tag: `${rr} — the risk raised`, text: fields.fRisk },
    out: { tag: 'The real outcome', text: fields.fOutcome },
  }[open]
  const Box = ({ k, cls, children }) => (
    <button type="button" className={`fork-node ${cls} ${{ shock: 'tone-6', dm: 'tone-2', rr: 'tone-3', out: '' }[k]}${open === k ? ' on' : ''}`} onClick={() => toggle(k)} aria-pressed={open === k}>{children}</button>
  )
  return (
    <div className="fork">
      <Box k="shock" cls="shock">The shock</Box>
      <div className="fork-stem" />
      <div className="fork-branches">
        <div className="fork-col"><Box k="dm" cls="dm"><span className="fork-tag">Decision</span>{dm}</Box></div>
        <div className="fork-col"><Box k="rr" cls="rr"><span className="fork-tag">Risk raised</span>{rr}</Box></div>
      </div>
      <div className="fork-stem" />
      <Box k="out" cls="out">Real outcome</Box>
      <div className="fork-hint">{open ? '' : 'Click any box to read what happened.'}</div>
      {detail && (
        <div className="fork-detail">
          <div className="fork-detail-tag">{detail.tag}</div>
          {detail.text.trim() || 'Not given.'}
        </div>
      )}
    </div>
  )
}

function CastCard({ color, name, roleLabel, promptText, imageState, onGenerateImage, onCopyPrompt, copied, onSave, onDownload, savedText }) {
  return (
    <div className="cast-card">
      <div className="cast-avatar" style={{ background: color }}>{initials(name)}</div>
      <div className="cast-info">
        <div className="cast-name">{name}</div>
        <div className="cast-role">{roleLabel}</div>
      </div>
      {imageState?.dataUrl && <img src={imageState.dataUrl} alt={`${name} reference`} className="cast-image" />}
      {imageState?.dataUrl && (
        <div className="save-row">
          <button type="button" className="small primary-soft" onClick={onSave}>{savedText ? 'Saved ✓' : 'Save'}</button>
          <button type="button" className="ghost small" onClick={onDownload}>Download</button>
          {savedText && <span className="saved-note">{savedText}</span>}
        </div>
      )}
      {promptText && (
        <>
          <button type="button" className="ghost small prompt-btn" onClick={onGenerateImage} disabled={imageState?.busy}>
            {imageState?.busy ? 'Generating…' : imageState?.dataUrl ? 'Regenerate reference image' : 'Generate reference image'}
          </button>
          <button type="button" className="ghost small prompt-btn" onClick={onCopyPrompt}>
            {copied ? 'Copied — paste into any image generator' : 'Copy character prompt'}
          </button>
          {imageState?.error && <div className="error-box" style={{ width: '100%' }}>{imageState.error}</div>}
        </>
      )}
    </div>
  )
}

/** Split a beat's markdown into dialogue lines, bullets and narration. */
function beatItems(body) {
  const items = []
  for (const raw of (body || '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/)
    if (m) items.push({ type: 'say', speaker: m[1], text: m[2] })
    else if (line.startsWith('- ')) items.push({ type: 'li', text: line.slice(2).replaceAll('**', '') })
    else items.push({ type: 'text', text: line.replaceAll('**', '') })
  }
  return items
}

/** Full-screen reader: steps through the storyboard panel by panel, revealing dialogue one line at a time. */
function StoryPlayer({ beats, images, fields, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const items = beatItems(beats[idx].body)
  const sayCount = items.filter((x) => x.type === 'say').length
  const [shown, setShown] = useState(Math.min(1, sayCount))
  const dm = (fields.fDecisionMaker || '').trim().toLowerCase()
  const rr = (fields.fRiskRaiser || '').trim().toLowerCase()

  const goto = (i, all) => {
    const c = beatItems(beats[i].body).filter((x) => x.type === 'say').length
    setIdx(i)
    setShown(all ? c : Math.min(1, c))
  }
  const next = () => {
    if (shown < sayCount) setShown(shown + 1)
    else if (idx < beats.length - 1) goto(idx + 1, false)
  }
  const prev = () => {
    if (shown > Math.min(1, sayCount)) setShown(shown - 1)
    else if (idx > 0) goto(idx - 1, true)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const img = images[idx]?.dataUrl
  let say = 0
  const atEnd = idx === beats.length - 1 && shown >= sayCount

  return (
    <div className="player" role="dialog" aria-label="Storyboard reader" style={{ '--panel-accent': `var(${PANEL_ACCENTS[idx % PANEL_ACCENTS.length]})` }}>
      <div className="player-bar">
        <div className="player-count">Panel {idx + 1} of {beats.length}</div>
        <div className="player-dots">
          {beats.map((_, i) => (
            <button key={i} type="button" aria-label={`Go to panel ${i + 1}`} className={`player-dot${i === idx ? ' current' : ''}${i < idx ? ' done' : ''}`} onClick={() => goto(i, false)} />
          ))}
        </div>
        <button type="button" className="ghost small" onClick={onClose}>Close ✕</button>
      </div>

      <div className="player-stage" onClick={next}>
        <div className="player-title">{beats[idx].title}</div>
        <div className="player-media" onClick={(e) => e.stopPropagation()}>
          {idx === 1 && <FlowRow fields={fields} />}
          {idx === 4 && <DecisionFork fields={fields} />}
          {!DIAGRAM_BEATS.includes(idx) && (img
            ? <img src={img} alt={`Illustration for ${beats[idx].title}`} />
            : <div className="player-noimg"><span dangerouslySetInnerHTML={{ __html: SKETCH_SVGS[idx] || '' }} /><span>{SKETCH_LABELS[idx]} — no illustration drawn yet</span></div>)}
        </div>
        <div className="player-text">
          {items.map((it, k) => {
            if (it.type === 'li') return idx === 1 ? null : <div className="player-li" key={k}>{it.text}</div>
            if (it.type === 'text') return <p className="player-narration" key={k}>{it.text}</p>
            const n = say++
            if (n >= shown) return null
            const right = it.speaker.trim().toLowerCase() === rr
            const mine = it.speaker.trim().toLowerCase() === dm
            return (
              <div className={`bubble-row ${right ? 'right' : 'left'}`} key={k}>
                <div className="bubble-avatar" style={{ background: right ? 'var(--improvement)' : mine ? 'var(--disruption)' : 'var(--muted)' }}>{initials(it.speaker)}</div>
                <div className="bubble"><span className="bubble-speaker">{it.speaker}</span>{it.text}</div>
              </div>
            )
          })}
        </div>
        {shown < sayCount && <div className="player-hint">Click anywhere or press → to reveal the next line</div>}
      </div>

      <div className="player-nav">
        <button type="button" className="ghost" onClick={prev} disabled={idx === 0 && shown <= Math.min(1, sayCount)}>← Back</button>
        <div className="player-keys">← → keys · Esc to close</div>
        {atEnd
          ? <button type="button" className="primary" onClick={onClose}>Finish</button>
          : <button type="button" className="primary" onClick={next}>{shown < sayCount ? 'Next line →' : 'Next panel →'}</button>}
      </div>
    </div>
  )
}

const CASE_TABS = [
  ['storyboard', 'Storyboard'],
  ['flow', 'Flowcharts'],
  ['cast', 'Cast & scenes'],
  ['facts', 'Case facts'],
]
// Beats drawn as a diagram instead of an illustration.
const DIAGRAM_BEATS = [1, 4]

function CasePage({ fields, setField, scriptBeats, setScriptBeats, onBack, onOpenLearner, regenAll, busy, status, error, store, onOpenLibrary }) {
  const [tab, setTab] = useState('storyboard')
  const [selectedNode, setSelectedNode] = useState(null)
  const [editingPanel, setEditingPanel] = useState(null)
  const [panelBusy, setPanelBusy] = useState(null)
  const [panelError, setPanelError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedChar, setCopiedChar] = useState(null)
  // images live in the parent so they survive going to the learner preview and back
  const { images, setImages, panelImages, setPanelImages } = store // images: { dm, rr }; panelImages: index -> { busy, error, dataUrl }
  const [bulk, setBulk] = useState(null) // { done, total }
  const [editDraft, setEditDraft] = useState('')
  const [player, setPlayer] = useState(null) // index the reader opens at, or null
  const openEdit = (i) => { setEditDraft(scriptBeats[i].body.trim()); setEditingPanel(i) }

  const dm = fields.fDecisionMaker.trim() || 'Decision maker'
  const rr = fields.fRiskRaiser.trim() || 'Risk raiser'
  const dmPrompt = characterPrompt(dm, 'makes and defends the decision', fields.fTitle, fields.fDate)
  const rrPrompt = characterPrompt(rr, 'raises the overlooked risk', fields.fTitle, fields.fDate)
  const nodeLines = parseNodeLines(fields.fNodes)
  const drawable = scriptBeats.filter((_, i) => !DIAGRAM_BEATS.includes(i)).length
  const drawn = scriptBeats.filter((_, i) => !DIAGRAM_BEATS.includes(i) && panelImages[i]?.dataUrl).length
  const jumpTo = (i) => {
    const el = document.getElementById(`panel-${i}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 1400)
  }

  const saveNode = (index, label, desc) => {
    const lines = parseNodeLines(fields.fNodes)
    lines[index] = desc.trim() ? `${label.trim()}: ${desc.trim()}` : label.trim()
    setField('fNodes', lines.join('\n'))
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
      if (result.warnings?.length) setPanelError(`Check this panel against your fields: ${result.warnings.join('; ')}.`)
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

  const generatePanelImage = async (i) => {
    const prev = panelImages[i]?.dataUrl
    setPanelImages((s) => ({ ...s, [i]: { busy: true, error: '', dataUrl: prev } }))
    try {
      const result = await callImageApi({
        scene: { title: scriptBeats[i].title, body: scriptBeats[i].body },
        caseTitle: fields.fTitle, date: fields.fDate, cast: [dm, rr],
      })
      setPanelImages((s) => ({ ...s, [i]: { busy: false, error: '', dataUrl: `data:${result.mimeType};base64,${result.data}` } }))
      return true
    } catch (e) {
      setPanelImages((s) => ({ ...s, [i]: { busy: false, error: e.message || 'Could not generate an image.', dataUrl: prev } }))
      return false
    }
  }

  const generateAll = async () => {
    const panelIdx = scriptBeats.map((_, i) => i).filter((i) => !DIAGRAM_BEATS.includes(i))
    const total = panelIdx.length + 2
    let done = 0
    setBulk({ done, total })
    const tick = () => setBulk({ done: ++done, total })
    await generateImage('dm', dmPrompt); tick()
    await generateImage('rr', rrPrompt); tick()
    const failed = []
    for (const i of panelIdx) { if (!(await generatePanelImage(i))) failed.push(i); tick() }
    for (const i of failed) { await new Promise((r) => setTimeout(r, 2000)); await generatePanelImage(i) } // one more try for any that failed
    setBulk(null)
  }

  const sceneChars = [
    'Narrator only', 'No characters — diagram panel', 'Narrator only',
    `${shortLabel(dm)} + ${shortLabel(rr)}`, 'Narrator, direct to reader', 'Narrator only', 'Narrator only',
  ]
  const anyBusy = bulk !== null || Object.values(panelImages).some((p) => p?.busy) || images.dm?.busy || images.rr?.busy

  // ----- saving and downloading images -----
  const caseTitle = fields.fTitle || 'Untitled case'
  const [saved, setSaved] = useState({}) // slot -> { savedAt, dataUrl } for this case's folder
  const [notice, setNotice] = useState(null)
  const refreshSaved = () => savedForCase(caseTitle).then(setSaved).catch(() => setSaved({}))
  useEffect(() => { refreshSaved() }, [caseTitle])
  const say = (msg, isError) => { setNotice({ msg, isError }); setTimeout(() => setNotice(null), 6000) }
  const panelLabel = (i) => `panel-${String(i + 1).padStart(2, '0')}-${scriptBeats[i].title.replace(/^\d+\.\s*/, '')}`
  const slotItems = () => {
    const out = []
    if (images.dm?.dataUrl) out.push({ slot: 'dm', label: `character-${dm}`, dataUrl: images.dm.dataUrl })
    if (images.rr?.dataUrl) out.push({ slot: 'rr', label: `character-${rr}`, dataUrl: images.rr.dataUrl })
    scriptBeats.forEach((_, i) => { if (panelImages[i]?.dataUrl) out.push({ slot: `p${i}`, label: panelLabel(i), dataUrl: panelImages[i].dataUrl }) })
    return out
  }
  const oneItem = (slot) => slotItems().filter((x) => x.slot === slot)
  const saveItems = async (items) => {
    if (!items.length) return say('Draw an image first.', true)
    try {
      await saveImages({ title: caseTitle, fields, beats: scriptBeats }, items)
      await refreshSaved()
      say(`Saved ${items.length} image${items.length === 1 ? '' : 's'} to the folder “${caseTitle}” on ${fmtDateTime(Date.now())}.`)
    } catch (e) { say(e.message || 'Could not save.', true) }
  }
  const downloadItems = (items) => {
    if (!items.length) return say('Draw an image first.', true)
    if (items.length === 1) downloadImage(caseTitle, items[0].label, items[0].dataUrl)
    else downloadZip(caseTitle, items)
  }
  const savedText = (slot, dataUrl) => { const s = saved[slot]; return dataUrl && s && s.dataUrl === dataUrl ? `Saved ${fmtDateTime(s.savedAt)}` : null }

  const castCards = (
    <div className="cast-grid">
      <CastCard color="var(--disruption)" name={dm} roleLabel="Speaking role — makes the call" promptText={dmPrompt}
        imageState={images.dm} copied={copiedChar === 'dm'}
        savedText={savedText('dm', images.dm?.dataUrl)} onSave={() => saveItems(oneItem('dm'))} onDownload={() => downloadItems(oneItem('dm'))}
        onCopyPrompt={() => copyPrompt('dm', dmPrompt)} onGenerateImage={() => generateImage('dm', dmPrompt)} />
      <CastCard color="var(--improvement)" name={rr} roleLabel="Speaking role — raises the risk" promptText={rrPrompt}
        imageState={images.rr} copied={copiedChar === 'rr'}
        savedText={savedText('rr', images.rr?.dataUrl)} onSave={() => saveItems(oneItem('rr'))} onDownload={() => downloadItems(oneItem('rr'))}
        onCopyPrompt={() => copyPrompt('rr', rrPrompt)} onGenerateImage={() => generateImage('rr', rrPrompt)} />
      <div className="cast-card">
        <div className="cast-avatar" style={{ background: 'var(--muted)' }}>N</div>
        <div className="cast-info"><div className="cast-name">Narrator</div><div className="cast-role">Unseen voice — captions only, no art needed</div></div>
      </div>
    </div>
  )

  return (
    <div className="wrap wide">
      {player !== null && <StoryPlayer beats={scriptBeats} images={panelImages} fields={fields} startIndex={player} onClose={() => setPlayer(null)} />}
      <div className="case-topbar">
        <button type="button" className="back-link" onClick={onBack}>← Back to fields</button>
        <button type="button" className="back-link" onClick={onOpenLibrary}>Saved library →</button>
      </div>

      <div className="case-hero">
        <div className="hero-ribbon" aria-hidden="true"><span>Comic</span></div>
        <div className="eyebrow">Case storyboard</div>
        <AutoGrowTextarea className="case-title-input" value={fields.fTitle} onChange={(e) => setField('fTitle', e.target.value)} />
        <AutoGrowTextarea className="case-date-input" value={fields.fDate} onChange={(e) => setField('fDate', e.target.value)} />
        <div className="hero-chips">
          <span className="chip"><span className="dot" style={{ background: 'var(--disruption)' }} />Decision: {dm}</span>
          <span className="chip"><span className="dot" style={{ background: 'var(--improvement)' }} />Risk raised by: {rr}</span>
          <span className="chip"><span className="dot" style={{ background: '#6B3FD1' }} />{scriptBeats.length} panels</span>
          <span className="chip"><span className="dot" style={{ background: '#2A4FD6' }} />{nodeLines.length} chain nodes</span>
          <span className="chip"><span className="dot" style={{ background: '#B01FA0' }} />{drawn} of {drawable} illustrations drawn</span>
        </div>
      </div>

      <div className="tabbar" role="tablist">
        {CASE_TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}><span className={`tab-dot td-${id}`} />{label}</button>
        ))}
      </div>

      {tab === 'storyboard' && (
        <>
          <div className="bulk-bar">
            <div>
              <div className="bulk-title">Reference images &amp; illustrations</div>
              <div className="bulk-sub">{bulk ? `Drawing… ${bulk.done} of ${bulk.total} done` : 'Draw both characters and every story panel in one go, or use the buttons on each panel.'}</div>
            </div>
            <div className="bulk-actions">
              <button type="button" className="ghost" onClick={() => setPlayer(0)}>▶ Play storyboard</button>
              <button type="button" className="primary" onClick={generateAll} disabled={anyBusy}>{bulk ? 'Drawing…' : 'Generate all images'}</button>
            </div>
          </div>
          {bulk && <div className="bulk-progress"><div style={{ width: `${(bulk.done / bulk.total) * 100}%` }} /></div>}

          <div className="save-bar">
            <span className="save-bar-label">{slotItems().length} image{slotItems().length === 1 ? '' : 's'} drawn</span>
            <button type="button" className="small primary-soft" disabled={slotItems().length === 0} onClick={() => saveItems(slotItems())}>Save all to folder</button>
            <button type="button" className="ghost small" disabled={slotItems().length === 0} onClick={() => downloadItems(slotItems())}>Download all (.zip)</button>
            <button type="button" className="ghost small" onClick={onOpenLibrary}>Saved library →</button>
          </div>
          {notice && <div className={notice.isError ? 'error-box' : 'notice-box'}>{notice.msg}</div>}

          <div className="jump-row">
            <span className="jump-label">Jump to panel</span>
            {scriptBeats.map((b, i) => (
              <button key={i} type="button" className={`jump-chip tone-${i % 7}${panelImages[i]?.dataUrl ? ' done' : ''}`} title={b.title} aria-label={`Go to panel ${i + 1}: ${b.title}`} onClick={() => jumpTo(i)}>{i + 1}</button>
            ))}
          </div>

          <div className="section-label" style={{ marginTop: 22 }}>Cast — reference images</div>
          {castCards}

          <div className="board">
            {scriptBeats.map((beat, i) => {
              const img = panelImages[i]
              return (
                <div id={`panel-${i}`} className={`board-panel tone-${i % 7}${i === 0 || i === 1 || i === 4 ? ' full' : ''}`} key={i}>
                  <div className="panel-card">
                    <div className="panel-ribbon" aria-hidden="true"><span>#{i + 1}</span></div>
                    <div className="panel-head">
                      <div className="panel-icon" dangerouslySetInnerHTML={{ __html: SKETCH_SVGS[i] || FORK_SVG }} />
                      <div>
                        <div className="panel-title">{beat.title}</div>
                        <div className="panel-sub">{SKETCH_LABELS[i]}</div>
                      </div>
                    </div>

                    {i === 1 && <div className="sketch-box diagram"><FlowRow fields={fields} /><span className="sketch-label">{SKETCH_LABELS[i]}</span></div>}
                    {i === 4 && <div className="sketch-box diagram"><DecisionFork fields={fields} /></div>}
                    {!DIAGRAM_BEATS.includes(i) && (
                      img?.dataUrl
                        ? <img src={img.dataUrl} alt={`Illustration for ${beat.title}`} className="panel-image" onClick={() => setPlayer(i)} title="Click to open in the reader" />
                        : (
                          <button type="button" className={`panel-placeholder${img?.busy ? ' busy' : ''}`} disabled={img?.busy || bulk !== null} onClick={() => generatePanelImage(i)}>
                            <span className="ph-icon" dangerouslySetInnerHTML={{ __html: SKETCH_SVGS[i] || '' }} />
                            <span className="ph-text">{img?.busy ? 'Drawing the scene…' : 'Click to draw this scene'}</span>
                          </button>
                        )
                    )}
                    {img?.error && <div className="error-box" style={{ marginBottom: 10 }}>{img.error}</div>}
                    {savedText(`p${i}`, img?.dataUrl) && <div className="saved-note panel-saved">✓ {savedText(`p${i}`, img?.dataUrl)}</div>}

                    {editingPanel === i ? (
                      <AutoGrowTextarea autoFocus className="panel-edit-area" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onBlur={() => saveEditedPanel(i, editDraft)} />
                    ) : (
                      i === 1
                        ? <div className="panel-note">The nodes above come from your chain field. Use “Edit text” to change the written list.</div>
                        : <div className="panel-body" style={{ cursor: 'text' }} onClick={() => openEdit(i)}>{renderBeatBody(beat.body)}</div>
                    )}
                    {panelBusy === i && <div className="panel-busy-note">Redoing this panel…</div>}
                    <div className="panel-actions">
                      {!DIAGRAM_BEATS.includes(i) && (
                        <button type="button" className="small primary-soft" disabled={img?.busy || bulk !== null} onClick={() => generatePanelImage(i)}>
                          {img?.busy ? 'Drawing…' : img?.dataUrl ? 'Redraw illustration' : 'Generate illustration'}
                        </button>
                      )}
                      {img?.dataUrl && (
                        <>
                          <button type="button" className="ghost small" onClick={() => saveItems(oneItem(`p${i}`))}>{savedText(`p${i}`, img.dataUrl) ? 'Saved ✓' : 'Save'}</button>
                          <button type="button" className="ghost small" onClick={() => downloadItems(oneItem(`p${i}`))}>Download</button>
                        </>
                      )}
                      <button type="button" className="ghost small" onClick={() => openEdit(i)}>Edit text</button>
                      <button type="button" className="ghost small" onClick={() => setPlayer(i)}>▶ Present from here</button>
                      <button type="button" className="ghost small" disabled={panelBusy !== null} onClick={() => redoPanel(i)}>Redo this panel</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'flow' && (
        <>
          <div className="section-label">Supply chain — click a node to read or edit it</div>
          <FlowRow fields={fields} onSelect={setSelectedNode} selected={selectedNode} />
          {selectedNode !== null && nodeLines[selectedNode] !== undefined && (() => {
            const { label, desc } = splitNodeLine(nodeLines[selectedNode])
            return (
              <div className="node-editor">
                <label className="field-label">Node name</label>
                <input type="text" value={label} onChange={(e) => saveNode(selectedNode, e.target.value, desc)} />
                <label className="field-label" style={{ marginTop: 10 }}>What it does</label>
                <AutoGrowTextarea value={desc} onChange={(e) => saveNode(selectedNode, label, e.target.value)} />
              </div>
            )
          })()}

          <div className="section-label">Decision flow — click a box to read it</div>
          <div className="fork-wrap"><DecisionFork fields={fields} /></div>
        </>
      )}

      {tab === 'cast' && (
        <>
          <div className="section-label">Cast — what an illustrator needs to know</div>
          {castCards}
          <div className="section-label">Scene list</div>
          <div className="scene-list">
            {scriptBeats.map((beat, i) => (
              <div className="scene-row" key={i}>
                <div className="scene-panel">#{i + 1}</div>
                <div><div className="scene-meta">{SKETCH_LABELS[i]}</div><div className="scene-chars">{sceneChars[i]}</div></div>
                <div>{firstSentence(beat.body)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'facts' && (
        <>
          <div className="section-label">Case facts — click any field to edit it directly</div>
          <div className="facts-grid">
            <div className="fact-card"><div className="fact-label">Decision</div><AutoGrowTextarea value={fields.fDecision} onChange={(e) => setField('fDecision', e.target.value)} /></div>
            <div className="fact-card"><div className="fact-label">Decision maker</div><input type="text" value={fields.fDecisionMaker} onChange={(e) => setField('fDecisionMaker', e.target.value)} /></div>
            <div className="fact-card"><div className="fact-label">Risk / overlooked trade-off</div><AutoGrowTextarea value={fields.fRisk} onChange={(e) => setField('fRisk', e.target.value)} /></div>
            <div className="fact-card"><div className="fact-label">Risk raiser</div><input type="text" value={fields.fRiskRaiser} onChange={(e) => setField('fRiskRaiser', e.target.value)} /></div>
            <div className="fact-card"><div className="fact-label">Outcome</div><AutoGrowTextarea value={fields.fOutcome} onChange={(e) => setField('fOutcome', e.target.value)} /></div>
            <div className="fact-card"><div className="fact-label">Lesson fact</div><AutoGrowTextarea value={fields.fLesson} onChange={(e) => setField('fLesson', e.target.value)} /></div>
          </div>
        </>
      )}

      <div className="controls" style={{ marginTop: 28 }}>
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
          <FlowRow fields={fields} maxCols={3} />
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

function Tool() {
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [view, setView] = useState('form') // 'form' | 'case' | 'learner' | 'library'
  const [scriptBeats, setScriptBeats] = useState(null)
  const [images, setImages] = useState({ dm: null, rr: null }) // character reference images
  const [panelImages, setPanelImages] = useState({}) // panel index -> { busy, error, dataUrl }
  const [libFrom, setLibFrom] = useState('form')
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
      setImages({ dm: null, rr: null }) // a new script means the old pictures no longer match
      setPanelImages({})
      const warn = result.warnings?.length ? ` Check against your fields: ${result.warnings.join('; ')}.` : ''
      setStatus((result.truncated ? 'Done — cut short, try trimming a field.' : 'Done.') + warn)
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

  const openLibrary = (from) => { setLibFrom(from); setView('library') }
  // reopen a saved story: its fields, script and saved images
  const openSaved = (rec) => {
    setFields({ ...EMPTY_FIELDS, ...rec.fields })
    setScriptBeats(rec.beats)
    const chars = { dm: null, rr: null }
    const panels = {}
    for (const im of rec.images) {
      if (im.slot === 'dm' || im.slot === 'rr') chars[im.slot] = { dataUrl: im.dataUrl }
      else if (/^p\d+$/.test(im.slot)) panels[Number(im.slot.slice(1))] = { dataUrl: im.dataUrl }
    }
    setImages(chars)
    setPanelImages(panels)
    setView('case')
  }

  if (view === 'library') {
    return <Library onBack={() => setView(libFrom === 'case' && scriptBeats ? 'case' : 'form')} onOpenStory={openSaved} />
  }

  if (view === 'case' && scriptBeats) {
    return (
      <CasePage
        store={{ images, setImages, panelImages, setPanelImages }} onOpenLibrary={() => openLibrary('case')}
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
      onCopy={copyScript} copied={copied} onOpenLibrary={() => openLibrary('form')}
    />
  )
}

// ---------- Password gate ----------

async function checkPassword() {
  const res = await fetch('/api/auth', { method: 'POST', headers: apiHeaders(), body: '{}' })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, error: body.error }
}

function Gate() {
  const [gate, setGate] = useState('checking') // 'checking' | 'locked' | 'open' | 'error'
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    checkPassword()
      .then((r) => {
        if (r.ok) setGate('open')
        else if (r.status === 401) setGate('locked')
        else { setMessage(r.error || `Server problem (${r.status}).`); setGate('error') }
      })
      .catch(() => { setMessage('Could not reach the server.'); setGate('error') })
  }, [])

  const unlock = async (e) => {
    e.preventDefault()
    setWorking(true); setMessage('')
    setPassword(input)
    try {
      const r = await checkPassword()
      if (r.ok) setGate('open')
      else setMessage(r.status === 401 ? 'Wrong password.' : r.error || 'Could not check the password.')
    } catch { setMessage('Could not reach the server.') }
    setWorking(false)
  }

  if (gate === 'open') return <Tool />
  if (gate === 'checking') return <div className="wrap narrow"><p className="status">Loading…</p></div>
  if (gate === 'error') return <div className="wrap narrow"><div className="error-box">{message}</div></div>
  return (
    <div className="wrap narrow">
      <div className="hero-band">
        <div className="eyebrow">Private tool</div>
        <h1>Enter the password</h1>
        <p className="deck">This tool uses paid AI services, so access is limited. Ask the owner for the password.</p>
      </div>
      <form onSubmit={unlock} className="card" style={{ paddingBottom: 22 }}>
        <label className="field-label" htmlFor="pw">Password</label>
        <input id="pw" type="password" autoFocus autoComplete="current-password" value={input} onChange={(e) => setInput(e.target.value)}
          style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '1.5px solid var(--hairline)', background: 'var(--canvas)', color: 'var(--ink)', fontSize: '0.95rem' }} />
        <div className="controls"><button type="submit" className="primary" disabled={working || !input}>{working ? 'Checking…' : 'Unlock'}</button></div>
        {message && <div className="error-box">{message}</div>}
      </form>
    </div>
  )
}

// ---------- Root: scoped container + embed mode ----------
// Add ?embed=1 to the URL when showing the tool inside another page (e.g. in an iframe on the
// dashboard): the background goes transparent and the page reports its height to the parent via
// postMessage({ type: 'fib-tool-height', height }) so the iframe can resize itself.

export default function App() {
  const embed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1'
  const rootRef = useRef(null)

  useEffect(() => {
    if (!embed || window.parent === window) return
    const post = () => window.parent.postMessage({ type: 'fib-tool-height', height: document.documentElement.scrollHeight }, '*')
    const ro = new ResizeObserver(post)
    ro.observe(rootRef.current)
    post()
    return () => ro.disconnect()
  }, [embed])

  return (
    <div ref={rootRef} className={`fib-tool${embed ? ' embed' : ''}`}>
      <Gate />
    </div>
  )
}
