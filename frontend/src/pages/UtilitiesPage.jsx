import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, Field } from '../components/ui'

const UTIL_TYPES = {
  electricity_water: { label: 'DEWA (Electricity & Water)', icon: '⚡', color: 'pill-amber' },
  cooling: { label: 'District Cooling', icon: '❄️', color: 'pill-blue' },
  gas: { label: 'Gas', icon: '🔥', color: 'pill-red' },
  internet: { label: 'Internet / Telecom', icon: '📡', color: 'pill-blue' },
  parking: { label: 'Parking', icon: '🚗', color: 'pill-gray' },
  other: { label: 'Other', icon: '🔌', color: 'pill-gray' },
}

export default function UtilitiesPage() {
  const { user } = useAuth()
  const [utils, setUtils] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ tenancyId: '', type: 'electricity_water', provider: '', accountNumber: '', monthlyAvg: '', paidBy: 'tenant', notes: '' })
  const [showToast, Toast] = useToast()

  const load = async () => {
    setLoading(true)
    const [u, t] = await Promise.all([api.get('/api/utilities'), api.get('/api/tenancies')])
    setUtils(u.data); setTenancies(t.data.filter(x => x.status === 'active')); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/api/utilities/${editing.id}`, { provider: form.provider, account_number: form.accountNumber, monthly_avg: parseFloat(form.monthlyAvg)||0, paid_by: form.paidBy, notes: form.notes })
        showToast('Updated ✓')
      } else {
        await api.post('/api/utilities', { ...form, monthlyAvg: parseFloat(form.monthlyAvg)||0 })
        showToast('Utility added ✓')
      }
      setModal(null); setEditing(null); setForm({ tenancyId: '', type: 'electricity_water', provider: '', accountNumber: '', monthlyAvg: '', paidBy: 'tenant', notes: '' }); load()
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error') }
  }

  const del = async (id) => {
    if (!confirm('Remove this utility?')) return
    await api.delete(`/api/utilities/${id}`).catch(() => {})
    showToast('Removed'); load()
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({ tenancyId: u.tenancy_id, type: u.type, provider: u.provider, accountNumber: u.account_number, monthlyAvg: u.monthly_avg, paidBy: u.paid_by, notes: u.notes })
    setModal('form')
  }

  const grouped = {}
  utils.forEach(u => { const k = u.property_name + ' · Unit ' + u.unit_number; if (!grouped[k]) grouped[k] = []; grouped[k].push(u) })

  return (
    <>
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Utilities</div><div className="page-sub">DEWA, cooling, internet — track accounts per unit</div></div>
        <button className="btn btn-green" onClick={() => { setEditing(null); setForm({ tenancyId: '', type: 'electricity_water', provider: '', accountNumber: '', monthlyAvg: '', paidBy: 'tenant', notes: '' }); setModal('form') }}>+ Add Utility</button>
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          utils.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⚡</div>
              <div className="empty-title">No utilities tracked</div>
              <div className="empty-sub">Add DEWA, cooling, and internet accounts to track for each tenancy.</div>
              <button className="btn btn-green" style={{ marginTop: 14 }} onClick={() => setModal('form')}>+ Add utility</button>
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 10, fontFamily: 'IBM Plex Mono' }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {items.map(u => {
                    const info = UTIL_TYPES[u.type] || UTIL_TYPES.other
                    return (
                      <div key={u.id} className="card">
                        <div className="card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontSize: 22 }}>{info.icon}</div>
                            <span className={`pill ${info.color}`} style={{ fontSize: 10 }}>{info.label}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{u.provider || 'Provider not set'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.8 }}>
                            {u.account_number && <div>Account: <span style={{ fontFamily: 'IBM Plex Mono' }}>{u.account_number}</span></div>}
                            {u.monthly_avg > 0 && <div>Avg monthly: <strong>AED {Number(u.monthly_avg).toLocaleString('en-AE')}</strong></div>}
                            <div>Paid by: <span className="pill pill-gray" style={{ fontSize: 9 }}>{u.paid_by}</span></div>
                          </div>
                          {u.notes && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{u.notes}</div>}
                          <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                            <button className="btn" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => openEdit(u)}>Edit</button>
                            <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => del(u.id)}>🗑</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )
        }
      </div>

      {modal === 'form' && (
        <Modal title={editing ? 'Edit Utility' : 'Add Utility'} onClose={() => { setModal(null); setEditing(null) }}
          footer={<><button className="btn" onClick={() => { setModal(null); setEditing(null) }}>Cancel</button><button className="btn btn-green" onClick={save}>Save</button></>}>
          {!editing && (
            <Field label="Tenancy *">
              <select className="form-select" value={form.tenancyId} onChange={e => setForm(f => ({ ...f, tenancyId: e.target.value }))}>
                <option value="">Select tenancy...</option>
                {tenancies.map(t => <option key={t.id} value={t.id}>{t.property_name} Unit {t.unit_number} — {t.tenant_name}</option>)}
              </select>
            </Field>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Type *">
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} disabled={!!editing}>
                {Object.entries(UTIL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </Field>
            <Field label="Paid by">
              <select className="form-select" value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))}>
                <option value="tenant">Tenant</option>
                <option value="landlord">Landlord</option>
              </select>
            </Field>
            <Field label="Provider / Company">
              <input className="form-input" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="e.g. DEWA, Du, Empower" />
            </Field>
            <Field label="Account number">
              <input className="form-input" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="Account / premise no." />
            </Field>
            <Field label="Avg monthly cost (AED)">
              <input className="form-input" type="number" value={form.monthlyAvg} onChange={e => setForm(f => ({ ...f, monthlyAvg: e.target.value }))} placeholder="0" />
            </Field>
          </div>
          <Field label="Notes">
            <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional details..." />
          </Field>
        </Modal>
      )}
    </>
  )
}
