import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useToast, Modal, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const TYPE_LABELS = { contract: '📋 Contract', ejari: '🏛️ Ejari', passport: '🛂 Passport', visa: '✈️ Visa', noc: '📝 NOC', receipt: '🧾 Receipt', other: '📄 Other' }
const TYPE_PILL = { contract: 'pill-blue', ejari: 'pill-green', passport: 'pill-purple', visa: 'pill-purple', noc: 'pill-amber', receipt: 'pill-green', other: 'pill-gray' }

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [viewDoc, setViewDoc] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'contract', tenancyId: '', sharedWith: [] })
  const [fileData, setFileData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const fileRef = useRef()
  const [showToast, Toast] = useToast()

  const load = async () => {
    const [d, t] = await Promise.all([api.get('/api/documents'), api.get('/api/tenancies')])
    setDocs(d.data); setTenancies(t.data.filter(x => x.status === 'active')); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return showToast('File must be under 4MB', 'error')
    const b64 = await fileToBase64(file)
    setFileData(b64)
    setFileName(file.name)
    if (!form.name) setForm(f => ({ ...f, name: file.name }))
  }

  const save = async () => {
    if (!form.name || !fileData) return showToast('Name and file required', 'error')
    setSaving(true)
    const tenancy = tenancies.find(t => t.id === form.tenancyId)
    const sharedWith = []
    if (tenancy) {
      if (user?.role === 'landlord') sharedWith.push(tenancy.tenantId || '')
      else sharedWith.push(tenancy.landlordId || '')
    }
    try {
      await api.post('/api/documents', { name: form.name, type: form.type, content: fileData, tenancyId: form.tenancyId || null, sharedWith, fileSize: fileData.length })
      showToast('Document uploaded ✓')
      setModal(null); setFileData(null); setFileName(''); setForm({ name: '', type: 'contract', tenancyId: '', sharedWith: [] })
      load()
    } catch { showToast('Upload failed', 'error') }
    finally { setSaving(false) }
  }

  const openDoc = async (doc) => {
    const r = await api.get(`/api/documents/${doc.id}`).catch(() => null)
    if (r) setViewDoc(r.data)
  }

  const del = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this document?')) return
    await api.delete(`/api/documents/${id}`).catch(() => {})
    showToast('Deleted'); load()
  }

  const download = () => {
    if (!viewDoc?.content) return
    const a = document.createElement('a')
    a.href = viewDoc.content
    a.download = viewDoc.name
    a.click()
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.type === filter)

  return (
    <>
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Documents</div><div className="page-sub">{docs.length} file{docs.length !== 1 ? 's' : ''} · encrypted storage</div></div>
        <div className="header-actions">
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'contract', 'ejari', 'noc', 'receipt'].map(f => (
              <button key={f} className={`btn ${filter === f ? 'btn-green' : ''}`} style={{ fontSize: 11 }} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-green" onClick={() => setModal('upload')}>+ Upload</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <div className="empty-title">No documents</div>
              <div className="empty-sub">Upload contracts, Ejari, NOCs, receipts and share them securely.</div>
              <button className="btn btn-green" style={{ marginTop: 14 }} onClick={() => setModal('upload')}>+ Upload document</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
              {filtered.map(doc => (
                <div key={doc.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openDoc(doc)}>
                  <div className="card-body">
                    <div style={{ fontSize: 32, marginBottom: 8 }}>
                      {doc.type === 'contract' ? '📋' : doc.type === 'ejari' ? '🏛️' : doc.type === 'receipt' ? '🧾' : doc.type === 'noc' ? '📝' : '📄'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, wordBreak: 'break-word' }}>{doc.name}</div>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className={`pill ${TYPE_PILL[doc.type] || 'pill-gray'}`}>{TYPE_LABELS[doc.type] || doc.type}</span>
                      {doc.sharedWith?.length > 0 && <span className="pill pill-green">🔗 Shared</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 10 }}>
                      {new Date(doc.createdAt).toLocaleDateString('en-AE')} · {formatSize(doc.fileSize)}
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); openDoc(doc) }}>View</button>
                      {doc.uploadedBy === user?.id && <button className="btn btn-red" style={{ fontSize: 11 }} onClick={e => del(doc.id, e)}>🗑</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {modal === 'upload' && (
        <Modal title="Upload document" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={save} disabled={saving}>{saving ? 'Uploading...' : 'Upload'}</button></>}>
          <div style={{ border: '2px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '24px', textAlign: 'center', cursor: 'pointer', background: fileData ? 'var(--green-light)' : 'var(--surface2)' }}
            onClick={() => fileRef.current.click()}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{fileData ? '✅' : '📎'}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: fileData ? 'var(--green-deeper)' : 'var(--text2)' }}>
              {fileName || 'Click to select file'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>PDF, images, Word — max 4MB</div>
            <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFile} />
          </div>
          <Field label="Document name">
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Tenancy Contract 2025" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Type">
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Share with tenancy">
              <select className="form-select" value={form.tenancyId} onChange={e => setForm(f => ({ ...f, tenancyId: e.target.value }))}>
                <option value="">Only me</option>
                {tenancies.map(t => <option key={t.id} value={t.id}>{user?.role === 'landlord' ? t.tenantName : t.landlordName} — Unit {t.unitNumber}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}

      {viewDoc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewDoc(null)}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: '90vh' }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{viewDoc.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'IBM Plex Mono' }}>
                  {new Date(viewDoc.createdAt).toLocaleDateString('en-AE')} · {formatSize(viewDoc.fileSize)}
                </div>
              </div>
              <button className="modal-close" onClick={() => setViewDoc(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center', padding: 0 }}>
              {viewDoc.content?.startsWith('data:image') ? (
                <img src={viewDoc.content} alt={viewDoc.name} style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} />
              ) : viewDoc.content?.startsWith('data:application/pdf') ? (
                <iframe src={viewDoc.content} style={{ width: '100%', height: 500, border: 'none', borderRadius: 'var(--radius)' }} title={viewDoc.name} />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Preview not available — click Download to open.</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setViewDoc(null)}>Close</button>
              <button className="btn btn-green" onClick={download}>⬇ Download</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
