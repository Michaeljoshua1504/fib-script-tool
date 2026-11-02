// Adds comic lettering (speech bubbles and caption boxes) on top of a generated picture.
// The words come straight from the script, so they are exact and in English. AI image models
// cannot be trusted to spell, which is why the text is drawn here instead of inside the picture.

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif'
const INK = '#1D2B2E'
const SPEAKER_COLORS = ['#C2371F', '#17806A', '#5B3FC4', '#B8590A']

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the picture to add text to it.'))
    img.src = src
  })
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Largest font size (between max and min) at which every block fits in maxHeight. */
function fitSize(ctx, blocks, maxWidth, maxHeight, maxPx, minPx, gap, labelExtra) {
  for (let px = maxPx; px >= minPx; px -= 1) {
    ctx.font = `600 ${px}px ${FONT}`
    let total = 0
    for (const b of blocks) total += wrapLines(ctx, b.text, maxWidth).length * px * 1.28 + (b.label ? px * labelExtra : 0) + gap
    if (total <= maxHeight) return px
  }
  return minPx
}

function drawSpeech(ctx, W, H, speech) {
  const margin = W * 0.035
  const boxW = W * 0.66
  const padX = W * 0.022
  const padY = W * 0.016
  const gap = H * 0.05 // room for the tails
  const textW = boxW - padX * 2
  const maxPx = Math.round(H * 0.036)
  const px = fitSize(ctx, speech.map((s) => ({ text: s.text, label: s.speaker })), textW, H * 0.6, maxPx, Math.round(H * 0.022), gap + padY * 2, 1.3)
  const names = [...new Set(speech.map((s) => s.speaker))]
  let y = margin
  speech.forEach((s, i) => {
    ctx.font = `600 ${px}px ${FONT}`
    const lines = wrapLines(ctx, s.text, textW)
    const labelH = px * 1.3
    const boxH = padY * 2 + labelH + lines.length * px * 1.28
    const onLeft = i % 2 === 0
    const x = onLeft ? margin : W - margin - boxW
    // bubble with a tail that points down towards the speaker
    ctx.lineWidth = Math.max(3, W * 0.004)
    ctx.strokeStyle = INK
    ctx.fillStyle = '#FFFFFF'
    roundedRect(ctx, x, y, boxW, boxH, W * 0.026)
    ctx.fill(); ctx.stroke()
    const tx = onLeft ? x + boxW * 0.2 : x + boxW * 0.8
    ctx.beginPath()
    ctx.moveTo(tx - W * 0.022, y + boxH - 1)
    ctx.lineTo(tx + (onLeft ? -W * 0.012 : W * 0.012), y + boxH + gap * 0.8)
    ctx.lineTo(tx + W * 0.022, y + boxH - 1)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(tx - W * 0.022, y + boxH)
    ctx.lineTo(tx + (onLeft ? -W * 0.012 : W * 0.012), y + boxH + gap * 0.8)
    ctx.lineTo(tx + W * 0.022, y + boxH)
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(tx - W * 0.02, y + boxH - ctx.lineWidth, W * 0.04, ctx.lineWidth * 2) // hide the seam under the bubble edge
    // speaker label, then the words
    ctx.textBaseline = 'top'
    ctx.fillStyle = SPEAKER_COLORS[names.indexOf(s.speaker) % SPEAKER_COLORS.length]
    ctx.font = `800 ${Math.round(px * 0.82)}px ${FONT}`
    ctx.fillText(String(s.speaker).toUpperCase(), x + padX, y + padY)
    ctx.fillStyle = INK
    ctx.font = `600 ${px}px ${FONT}`
    lines.forEach((l, li) => ctx.fillText(l, x + padX, y + padY + labelH + li * px * 1.28))
    y += boxH + gap
  })
}

function drawCaption(ctx, W, H, caption) {
  const margin = W * 0.03
  const boxW = W - margin * 2
  const padX = W * 0.026
  const padY = W * 0.02
  const textW = boxW - padX * 2
  const px = fitSize(ctx, [{ text: caption }], textW, H * 0.3, Math.round(H * 0.038), Math.round(H * 0.024), 0, 0)
  ctx.font = `600 ${px}px ${FONT}`
  const lines = wrapLines(ctx, caption, textW)
  const boxH = padY * 2 + lines.length * px * 1.28
  const y = H - margin - boxH
  ctx.lineWidth = Math.max(3, W * 0.004)
  ctx.strokeStyle = INK
  ctx.fillStyle = '#FFF1B8'
  roundedRect(ctx, margin, y, boxW, boxH, W * 0.012)
  ctx.fill(); ctx.stroke()
  ctx.fillStyle = INK
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, margin + padX, y + padY + i * px * 1.28))
}

/** Returns a new picture (data URL) with the lettering drawn on. With nothing to add, returns the original. */
export async function letterImage(src, { caption, speech } = {}) {
  const hasSpeech = speech && speech.length > 0
  const hasCaption = caption && caption.trim()
  if (!hasSpeech && !hasCaption) return src
  const img = await loadImage(src)
  const W = img.naturalWidth || 1024
  const H = img.naturalHeight || 1024
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, W, H)
  if (document.fonts?.ready) { try { await document.fonts.ready } catch {} }
  if (hasSpeech) drawSpeech(ctx, W, H, speech)
  if (hasCaption) drawCaption(ctx, W, H, caption.trim())
  return canvas.toDataURL('image/jpeg', 0.92)
}

/** Shorten narration to its first sentences (about 30 words) so it fits in a caption box. */
export function clipWords(text, maxWords = 30) {
  const sentences = String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)
  let out = ''
  let count = 0
  for (const s of sentences) {
    const n = s.split(' ').length
    if (out && count + n > maxWords) break
    out = out ? `${out} ${s}` : s
    count += n
  }
  const words = out.split(' ')
  return words.length > maxWords + 6 ? `${words.slice(0, maxWords).join(' ')}…` : out
}
