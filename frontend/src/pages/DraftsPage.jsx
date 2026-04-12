import { useState, useEffect } from 'react'
import axios from 'axios'

const TYPE_LABELS = { chat: 'Chat', notice: 'Notice', calc: 'Calculator', letter: 'Letter' }
const TYPE_BADGE = { chat: 'badge-chat', notice: 'badge-notice', calc: 'badge-calc', letter: 'badge-notice' }

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const loadDrafts = () => {
    setLoading(true)
    axios.get('/api/drafts')
      .then(r => setDrafts(r.data))
      .catch(() => showToast('Failed to load drafts', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDrafts() }, [])

  const openDraft = (draft) => {
    setSelected(draft)
    setEditContent(draft.content)
  }

  const saveDraft = async () => {
    if (!selected) return
    try {
      await axios.put(`/api/drafts/${selected.id}`, { content: editContent, title: selected.title })
      showToast('Draft saved ✓')
      loadDrafts()
    } catch { showToast('Failed to save', 'error') }
  }

  const deleteDraft = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this draft?')) return
    try {
      await axios.delete(`/api/drafts/${id}`)
      setDrafts(d => d.filter(x => x.id !== id))
      if (selected?.id === id) setSelected(null)
      showToast('Draft deleted')
      await axios.post('/api/activity', { type: 'draft_deleted', description: 'Deleted a draft', icon: '🗑️' })
    } catch { showToast('Failed to delete', 'error') }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editContent)
    showToast('Copied to clipboard ✓')
  }

  const filtered = drafts.filter(d =>
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.content?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <div className="page-header">
        <div className="page-title">My Drafts</div>
        <div className="page-sub">🔒 Encrypted — {drafts.length} saved document{drafts.length !== 1 ? 's' : ''}</div>
      </div>

      <div className="drafts-body">
        <div className="drafts-toolbar">
          <input
            className="search-input"
            placeholder="Search drafts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn-secondary" onClick={loadDrafts}>↻ Refresh</button>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <div className="empty-title">{search ? 'No drafts match your search' : 'No drafts yet'}</div>
            <div className="empty-sub">Save AI responses or notice letters from the Chat page.</div>
          </div>
        ) : (
          <div className="drafts-grid">
            {filtered.map(draft => (
              <div key={draft.id} className="draft-card" onClick={() => openDraft(draft)}>
                <div>
                  <span className={`draft-type-badge ${TYPE_BADGE[draft.type] || 'badge-notice'}`}>
                    {TYPE_LABELS[draft.type] || draft.type}
                  </span>
                  {draft.emirate && (
                    <span className="draft-type-badge badge-calc" style={{ marginLeft: 4 }}>
                      {draft.emirate}
                    </span>
                  )}
                </div>
                <div className="draft-title">{draft.title}</div>
                <div className="draft-preview">{draft.content}</div>
                <div className="draft-meta">
                  <span className="draft-date">{timeAgo(draft.updatedAt)}</span>
                  <button className="draft-del" onClick={e => deleteDraft(draft.id, e)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">{selected.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'IBM Plex Mono' }}>
                  {new Date(selected.updatedAt).toLocaleString('en-AE')} · {selected.emirate}
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <textarea
                className="modal-textarea"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-danger" onClick={() => { deleteDraft(selected.id, { stopPropagation: () => {} }); setSelected(null) }}>Delete</button>
              <button className="btn-secondary" onClick={copyToClipboard}>Copy</button>
              <button className="btn-success" onClick={saveDraft}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
