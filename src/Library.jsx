import { useEffect, useState } from 'react'
import { listLibrary, deleteImage, deleteCase, downloadImage, downloadZip, fmtDateTime } from './storage.js'

/** The saved library: one folder per case, with the date each image was saved. */
export default function Library({ onBack, onOpenStory }) {
  const [cases, setCases] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')

  const load = () => listLibrary().then(setCases).catch((e) => { setError(e.message || 'Could not open the saved library.'); setCases([]) })
  useEffect(() => { load() }, [])

  const folder = cases?.find((c) => c.id === openId)

  const removeImage = async (img) => {
    if (!window.confirm(`Delete “${img.label}” from this folder?`)) return
    try { await deleteImage(img.key); await load() } catch (e) { setError(e.message) }
  }
  const removeFolder = async (c) => {
    if (!window.confirm(`Delete the folder “${c.title}” and its ${c.images.length} saved image(s)? This cannot be undone.`)) return
    try { await deleteCase(c.id); setOpenId(null); await load() } catch (e) { setError(e.message) }
  }

  return (
    <div className="wrap wide">
      <div className="case-topbar"><button type="button" className="back-link" onClick={folder ? () => setOpenId(null) : onBack}>← {folder ? 'All saved cases' : 'Back'}</button></div>

      <div className="case-hero">
        <div className="eyebrow">Saved library</div>
        <div className="lib-title">{folder ? folder.title : 'Your saved cases'}</div>
        <div className="lib-sub">
          {folder
            ? `${folder.images.length} saved image${folder.images.length === 1 ? '' : 's'} · last saved ${fmtDateTime(folder.updatedAt)}`
            : 'Each case has its own folder. Saved images stay in this browser, with the date they were saved, until you delete them.'}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {cases === null && <p className="status">Loading…</p>}

      {cases && !folder && cases.length === 0 && !error && (
        <div className="lib-empty">Nothing saved yet. Draw some images on a case page and click <b>Save all</b> to create its folder.</div>
      )}

      {cases && !folder && cases.length > 0 && (
        <div className="lib-grid">
          {cases.map((c) => (
            <button key={c.id} type="button" className="lib-folder" onClick={() => setOpenId(c.id)}>
              <div className="lib-folder-head">
                <span className="lib-folder-icon" aria-hidden="true">▤</span>
                <span className="lib-folder-name">{c.title}</span>
              </div>
              <div className="lib-thumbs">
                {c.images.slice(0, 4).map((i) => <img key={i.key} src={i.dataUrl} alt="" />)}
                {c.images.length === 0 && <span className="lib-nothumb">No images yet</span>}
              </div>
              <div className="lib-meta">{c.images.length} image{c.images.length === 1 ? '' : 's'} · saved {fmtDateTime(c.updatedAt)}</div>
            </button>
          ))}
        </div>
      )}

      {folder && (
        <>
          <div className="controls" style={{ marginTop: 0 }}>
            <button type="button" className="primary" onClick={() => onOpenStory(folder)}>Open this story again →</button>
            <button type="button" className="ghost" disabled={folder.images.length === 0} onClick={() => downloadZip(folder.title, folder.images.map((i) => ({ label: i.label, dataUrl: i.dataUrl, ts: i.savedAt })))}>Download all (.zip)</button>
            <button type="button" className="ghost" onClick={() => removeFolder(folder)}>Delete folder</button>
          </div>
          {folder.images.length === 0 && <div className="lib-empty">This folder has no images. “Open this story again” still restores the script.</div>}
          <div className="lib-images">
            {folder.images.map((img) => (
              <div className="lib-image" key={img.key}>
                <img src={img.dataUrl} alt={img.label} />
                <div className="lib-image-label">{img.label}</div>
                <div className="lib-image-date">Saved {fmtDateTime(img.savedAt)}</div>
                <div className="lib-image-actions">
                  <button type="button" className="small primary-soft" onClick={() => downloadImage(folder.title, img.label, img.dataUrl, img.savedAt)}>Download</button>
                  <button type="button" className="ghost small" onClick={() => removeImage(img)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
