import { useState, useEffect } from 'react'
import api from '../api'
import { useToast, Modal, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const PRIORITY_PILL = { low: 'pill-gray', medium: 'pill-amber', high: 'pill-red', urgent: 'pill-red' }
const STATUS_PILL = { open: 'pill-amber', 'in-progress': 'pill-blue', resolved: 'pill-green', closed: 'pill-gray' }
const CATEGORIES = ['plumbing', 'electrical', 'AC / cooling', 'appliance', 'structural', 'pest control', 'cleaning', 'security', 'other']

const EMPTY = { tenancyId: '', title: '', description: '', priority: 'medium', category: 'other' }

export default function MaintenancePage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [showToast, Toast] = useToast()

  const load = async () => {
    const [m, t] = await Promise.all([api.get('/api/maintenance'), api.get('/api/tenancies')])
    setItems(m.data); setTenancies(t.data.filter(x => x.status === 'active')); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  const save = async () => {
    if (!form.tenancyId || !form.title) return showToast('Tenancy and title required', 'error')
    setSaving(true)
    try {
      await api.post('/api/maintenance', form)
      showToast('Request submitted ✓'); setModal(null); setForm(EMPTY); load()
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error') }
    finally { setSaving(false) }
  }

  const updateStatus = async (id, status) => {
    await api.put(`/api/maintenance/${id}`, { status }).catch(() => {})
    showToast(`Marked as ${status}`)
    load()
  }

  const timeAgo = (iso) => {
    const d = Math.floor((Date.now() - new Date(iso)) / 86400000)
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`
  }

  const openCount = items.filter(i => i.status === 'open').length
  const inProgressCount = items.filter(i => i.status === 'in-progress').length
  const resolvedCount = items.filter(i => i.status === 'resolved').length

  return (
    <>
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Maintenance</div>
          <div className="page-sub">{openCount} open · {inProgressCount} in progress · {resolvedCount} resolved</div>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'open', 'in-progress', 'resolved'].map(f => (
              <button key={f} className={`btn ${filter === f ? 'btn-green' : ''}`} style={{ fontSize: 11 }} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {user?.role === 'tenant' && <button className="btn btn-green" onClick={() => { setForm(EMPTY); setModal('add') }}>+ Report issue</button>}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔧</div>
              <div className="empty-title">No maintenance requests</div>
              <div className="empty-sub">{user?.role === 'tenant' ? 'Report any issues with your unit here.' : 'No open requests from your tenants.'}</div>
              {user?.role === 'tenant' && <button className="btn btn-green" style={{ marginTop: 14 }} onClick={() => { setForm(EMPTY); setModal('add') }}>+ Report an issue</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(item => (
                <div key={item.id} className="card">
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{item.title}</span>
                          <span className={`pill ${PRIORITY_PILL[item.priority]}`}>{item.priority}</span>
                          <span className={`pill ${STATUS_PILL[item.status] || 'pill-gray'}`}>{item.status}</span>
                          <span className="pill pill-gray">{item.category}</span>
                        </div>
                        {item.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.6 }}>{item.description}</div>}
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'IBM Plex Mono' }}>
                          {item.tenantName && user?.role === 'landlord' && <span>👤 {item.tenantName}</span>}
                          {item.propertyName && <span>🏠 {item.propertyName} {item.unitNumber ? `· Unit ${item.unitNumber}` : ''}</span>}
                          <span>📅 {timeAgo(item.createdAt)}</span>
                          {item.resolvedAt && <span>✅ Resolved {timeAgo(item.resolvedAt)}</span>}
                        </div>
                      </div>

                      {user?.role === 'landlord' && item.status !== 'closed' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                          {item.status === 'open' && (
                            <button className="btn" style={{ fontSize: 11, background: 'var(--blue-light)', color: 'var(--blue)', border: 'none' }} onClick={() => updateStatus(item.id, 'in-progress')}>
                              🔨 Start work
                            </button>
                          )}
                          {(item.status === 'open' || item.status === 'in-progress') && (
                            <button className="btn" style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green-deeper)', border: 'none' }} onClick={() => updateStatus(item.id, 'resolved')}>
                              ✅ Resolve
                            </button>
                          )}
                          {item.status === 'resolved' && (
                            <button className="btn" style={{ fontSize: 11 }} onClick={() => updateStatus(item.id, 'closed')}>
                              Close
                            </button>
                          )}
                        </div>
                      )}

                      {user?.role === 'tenant' && item.status === 'open' && (
                        <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => updateStatus(item.id, 'closed')}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {modal === 'add' && (
        <Modal title="Report maintenance issue" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={save} disabled={saving}>{saving ? 'Submitting...' : 'Submit request'}</button></>}>
          <Field label="Tenancy *">
            <select className="form-select" value={form.tenancyId} onChange={e => setForm(f => ({ ...f, tenancyId: e.target.value }))}>
              <option value="">Select your tenancy...</option>
              {tenancies.map(t => <option key={t.id} value={t.id}>{t.propertyName} — Unit {t.unitNumber}</option>)}
            </select>
          </Field>
          <Field label="Issue title *">
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. AC not working, Water leak in bathroom" />
          </Field>
          <Field label="Description">
            <textarea className="form-input" style={{ minHeight: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue in detail..." />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Category">
              <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
