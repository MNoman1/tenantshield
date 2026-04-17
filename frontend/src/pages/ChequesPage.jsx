import { useState, useEffect } from 'react'
import api from '../api'
import { useToast, Modal, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const STATUS_PILL = { paid: 'pill-green', pending: 'pill-amber', overdue: 'pill-red', bounced: 'pill-red', cancelled: 'pill-gray' }
const STATUS_OPTS = ['pending','paid','overdue','bounced','cancelled']
const EMPTY = { tenancyId: '', amount: '', dueDate: '', chequeNumber: '', bank: '', type: 'rent', description: '' }

export default function ChequesPage() {
  const { user } = useAuth()
  const [cheques, setCheques] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [showToast, Toast] = useToast()

  const load = async () => {
    const [c, t] = await Promise.all([api.get('/api/cheques'), api.get('/api/tenancies')])
    setCheques(c.data); setTenancies(t.data.filter(t => t.status === 'active')); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? cheques : cheques.filter(c => c.status === filter)
  const totalPaid = cheques.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  const totalPending = cheques.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0)
  const totalOverdue = cheques.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0)
  const fmt = n => Number(n || 0).toLocaleString('en-AE')

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/api/cheques', { ...form, amount: parseFloat(form.amount) })
      showToast('Cheque added ✓'); setModal(null); load()
    } catch { showToast('Failed', 'error') }
    finally { setSaving(false) }
  }

  const updateStatus = async (id, status) => {
    await api.put(`/api/cheques/${id}`, { status }).catch(() => {})
    showToast(`Marked as ${status} ✓`)
    load()
  }

  const del = async (id) => {
    if (!confirm('Delete this cheque?')) return
    await api.delete(`/api/cheques/${id}`).catch(() => {})
    showToast('Deleted'); load()
  }

  return (
    <>
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">{user?.role === 'landlord' ? 'Cheques & Payments' : 'My Payments'}</div>
          <div className="page-sub">{cheques.length} total cheques</div>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', gap: 4 }}>
            {['all','pending','paid','overdue'].map(f => (
              <button key={f} className={`btn ${filter === f ? 'btn-green' : ''}`} style={{ fontSize: 11 }} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
            ))}
          </div>
          {user?.role === 'landlord' && <button className="btn btn-green" onClick={() => { setForm(EMPTY); setModal('add') }}>+ Add cheque</button>}
        </div>
      </div>

      <div className="page-body">
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card green"><div className="stat-label">TOTAL RECEIVED</div><div className="stat-value">AED {fmt(totalPaid)}</div></div>
          <div className="stat-card amber"><div className="stat-label">PENDING</div><div className="stat-value">AED {fmt(totalPending)}</div></div>
          <div className="stat-card red"><div className="stat-label">OVERDUE</div><div className="stat-value">AED {fmt(totalOverdue)}</div></div>
          <div className="stat-card"><div className="stat-label">TOTAL CHEQUES</div><div className="stat-value">{cheques.length}</div></div>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">💳</div><div className="empty-title">No payments</div><div className="empty-sub">{user?.role === 'landlord' ? 'Add cheques to track payments.' : 'Your payment schedule will appear here.'}</div></div> : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {user?.role === 'landlord' && <th>Tenant</th>}
                      <th>Property / Unit</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Due Date</th>
                      <th>Cheque No.</th>
                      <th>Bank</th>
                      <th>Status</th>
                      {user?.role === 'landlord' && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id}>
                        {user?.role === 'landlord' && <td style={{ fontWeight: 500 }}>{c.tenantName || '—'}</td>}
                        <td style={{ fontSize: 11 }}>{c.propertyName} {c.unitNumber ? `· Unit ${c.unitNumber}` : ''}</td>
                        <td><span className="pill pill-gray">{c.type}</span></td>
                        <td style={{ fontFamily: 'IBM Plex Mono', fontWeight: 500 }}>AED {fmt(c.amount)}</td>
                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: c.status === 'overdue' ? 'var(--red)' : 'inherit' }}>{new Date(c.dueDate).toLocaleDateString('en-AE')}</td>
                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{c.chequeNumber || '—'}</td>
                        <td style={{ fontSize: 11 }}>{c.bank || '—'}</td>
                        <td><span className={`pill ${STATUS_PILL[c.status] || 'pill-gray'}`}>{c.status}</span></td>
                        {user?.role === 'landlord' && (
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {c.status !== 'paid' && <button className="btn" style={{ fontSize: 10, padding: '3px 8px', background: 'var(--green-light)', color: 'var(--green-deeper)', border: 'none' }} onClick={() => updateStatus(c.id, 'paid')}>✓ Paid</button>}
                              {c.status === 'pending' && <button className="btn" style={{ fontSize: 10, padding: '3px 8px', background: 'var(--red-light)', color: 'var(--red)', border: 'none' }} onClick={() => updateStatus(c.id, 'bounced')}>Bounced</button>}
                              <button className="btn btn-red" style={{ fontSize: 10, padding: '3px 6px' }} onClick={() => del(c.id)}>🗑</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      </div>

      {modal === 'add' && (
        <Modal title="Add cheque" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Add cheque'}</button></>}>
          <Field label="Tenancy *">
            <select className="form-select" value={form.tenancyId} onChange={e => setForm(f => ({ ...f, tenancyId: e.target.value }))}>
              <option value="">Select tenancy...</option>
              {tenancies.map(t => <option key={t.id} value={t.id}>{t.tenantName} — {t.propertyName} Unit {t.unitNumber}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Amount (AED) *"><input className="form-input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="15000" /></Field>
            <Field label="Due date *"><input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></Field>
            <Field label="Cheque number"><input className="form-input" value={form.chequeNumber} onChange={e => setForm(f => ({ ...f, chequeNumber: e.target.value }))} placeholder="012345" /></Field>
            <Field label="Bank"><input className="form-input" value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="Emirates NBD" /></Field>
            <Field label="Type">
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['rent','security deposit','maintenance','other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Description"><input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional note" /></Field>
          </div>
        </Modal>
      )}
    </>
  )
}
