// Saved library: one "folder" per case, kept in this browser's IndexedDB (no server, nothing uploaded).
// Each case record keeps the fields and script so the story can be reopened; images are stored per slot
// ('dm', 'rr', 'p0'..'p6') with the date they were saved.
import { makeZip } from './zip.js'

const DB_NAME = 'fib-library'
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

function open() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('Saving is not available in this browser window (try a normal, non-private window).')); return }
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => {
      const db = r.result
      db.createObjectStore('cases', { keyPath: 'id' })
      db.createObjectStore('images', { keyPath: 'key' }).createIndex('caseId', 'caseId')
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error || new Error('Could not open the saved library.'))
  })
}

export const slugify = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'untitled'
export const caseIdFor = (title) => slugify(title)
export const isoDate = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10)
export const fmtDateTime = (ts) => new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const mimeOf = (dataUrl) => (dataUrl.match(/^data:([^;]+);/) || [])[1] || 'image/jpeg'
const extOf = (mime) => (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg')
export function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** e.g. fib-001-philips-albuquerque_panel-03-the-shock_2026-11-01.jpg */
export function fileNameFor(caseTitle, label, dataUrl, ts) {
  return `${slugify(caseTitle).slice(0, 40)}_${slugify(label)}_${isoDate(ts)}.${extOf(mimeOf(dataUrl))}`
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function downloadImage(caseTitle, label, dataUrl, ts) {
  downloadBlob(new Blob([dataUrlToBytes(dataUrl)], { type: mimeOf(dataUrl) }), fileNameFor(caseTitle, label, dataUrl, ts))
}
/** items: [{ label, dataUrl, ts? }] -> one .zip containing every image */
export function downloadZip(caseTitle, items, ts = Date.now()) {
  const files = items.map((it) => ({ name: fileNameFor(caseTitle, it.label, it.dataUrl, it.ts || ts), bytes: dataUrlToBytes(it.dataUrl), date: new Date(it.ts || ts) }))
  downloadBlob(makeZip(files), `${slugify(caseTitle).slice(0, 40)}_${isoDate(ts)}.zip`)
}

/** Save images into the case's folder. snapshot = { title, fields, beats }; items = [{ slot, label, dataUrl }]. */
export async function saveImages(snapshot, items) {
  const db = await open()
  const id = caseIdFor(snapshot.title)
  const now = Date.now()
  const t = db.transaction(['cases', 'images'], 'readwrite')
  t.objectStore('cases').put({ id, title: snapshot.title, date: snapshot.fields?.fDate || '', fields: snapshot.fields, beats: snapshot.beats, updatedAt: now })
  for (const it of items) {
    t.objectStore('images').put({ key: `${id}::${it.slot}`, caseId: id, slot: it.slot, label: it.label, dataUrl: it.dataUrl, savedAt: now })
  }
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error) })
  db.close()
  return { id, savedAt: now }
}

/** slot -> { savedAt, dataUrl } for one case */
export async function savedForCase(title) {
  const db = await open()
  const rows = await req(db.transaction('images').objectStore('images').index('caseId').getAll(caseIdFor(title)))
  db.close()
  return Object.fromEntries(rows.map((r) => [r.slot, { savedAt: r.savedAt, dataUrl: r.dataUrl }]))
}

/** Every saved case with its images, newest first. */
export async function listLibrary() {
  const db = await open()
  const t = db.transaction(['cases', 'images'])
  const [cases, images] = await Promise.all([req(t.objectStore('cases').getAll()), req(t.objectStore('images').getAll())])
  db.close()
  return cases
    .map((c) => ({ ...c, images: images.filter((i) => i.caseId === c.id).sort((a, b) => a.label.localeCompare(b.label)) }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteImage(key) {
  const db = await open()
  await req(db.transaction('images', 'readwrite').objectStore('images').delete(key))
  db.close()
}
export async function deleteCase(id) {
  const db = await open()
  const t = db.transaction(['cases', 'images'], 'readwrite')
  t.objectStore('cases').delete(id)
  const keys = await req(t.objectStore('images').index('caseId').getAllKeys(id))
  for (const k of keys) t.objectStore('images').delete(k)
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error) })
  db.close()
}
