import { useState, useEffect } from 'react'
import api from '../api'
import { useToast, Modal } from '../components/ui'

function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [showToast, Toast] = useToast()

  const load = () => api.get('/api/drafts').then(r => setDrafts(r.data)).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const open = (d) => { setSelected(d); setEditContent(d.content) }

  const save = async () => {
    await api.put(`/api/drafts/${selected.id}`, { content: editContent, title: selected.title }).catch(() => {})
    showToast('Saved ✓'); load()
  }

  const del = async (id, e) => {
    e?.stopPropagation()
    if (!confirm('Delete this draft?')) return
    await api.delete(`/api/drafts/${id}`).catch(() => {})
    if (selected?.id === id) setSelected(null)
    showToast('Deleted'); load()
  }

  const copy = () => {
    navigator.clipboard.writeText(editContent)
    showToast('Copied to clipboard ✓')
  }

  const filtered = drafts.filter(d => d.title?.toLowerCase().includes(search.toLowerCase()) || d.content?.toLowerCase().includes(search.toLowerCase()))
  const BADGE = { chat: 'pill-green', notice: 'pill-amber', calc: 'pill-blue', letter: 'pill-amber' }

  return (
    <>
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Drafts</div><div className="page-sub">🔒 Encrypted · {drafts.length} saved</div></div>
        <div className="header-actions">
          <input style={{ padding: '7px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 12, width: 200, outline: 'none', fontFamily: 'Sora,sans-serif' }}
            placeholder="Search drafts..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn" onClick={load}>↻</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <div className="empty-title">{search ? 'No matching drafts' : 'No drafts yet'}</div>
              <div className="empty-sub">Save AI responses or notice letters from the Chat page.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
              {filtered.map(d => (
                <div key={d.id} className="card" style={{ cursor: 'pointer' }} onClick={() => open(d)}>
                  <div className="card-body">
                    <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
                      <span className={`pill ${BADGE[d.type] || 'pill-gray'}`}>{d.type}</span>
                      {d.emirate && <span className="pill pill-blue">{d.emirate}</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 10 }}>{d.content}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono' }}>{timeAgo(d.updatedAt)}</span>
                      <button className="btn btn-red" style={{ fontSize: 11, padding: '2px 6px' }} onClick={e => del(d.id, e)}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}
          footer={<><button className="btn btn-red" onClick={() => { del(selected.id); setSelected(null) }}>Delete</button><button className="btn" onClick={copy}>Copy</button><button className="btn btn-green" onClick={save}>Save changes</button></>}>
          <textarea style={{ width: '100%', minHeight: 260, padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--text)', resize: 'vertical', outline: 'none', background: 'var(--surface2)', lineHeight: 1.7 }}
            value={editContent} onChange={e => setEditContent(e.target.value)} />
        </Modal>
      )}
    </>
  )
}
