import { useState, useEffect } from 'react'
import api from '../api'
import { useToast, Modal, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const EMPTY = { propertyId: '', unitNumber: '', floor: '', bedrooms: 1, bathrooms: 1, size: '', rentAmount: '' }

export default function UnitsPage() {
  const { user } = useAuth()
  const [units, setUnits] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [showToast, Toast] = useToast()

  const load = async () => {
    const [u, p] = await Promise.all([api.get('/api/units'), user?.role === 'landlord' ? api.get('/api/properties') : Promise.resolve({ data: [] })])
    setUnits(u.data); setProperties(p.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? units : units.filter(u => u.status === filter)

  const save = async () => {
    if (!form.propertyId || !form.unitNumber) return showToast('Property and unit number required', 'error')
    setSaving(true)
    try {
      if (modal === 'add') await api.post('/api/units', { ...form, rentAmount: parseFloat(form.rentAmount) || 0 })
      else await api.put(`/api/units/${form.id}`, form)
      showToast('Saved ✓'); setModal(null); load()
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Delete this unit?')) return
    await api.delete(`/api/units/${id}`).catch(() => {})
    showToast('Deleted'); load()
  }

  const fmt = n => Number(n || 0).toLocaleString('en-AE')

  return (
    <>
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">{user?.role === 'landlord' ? 'Units' : 'My Unit'}</div>
          <div className="page-sub">{units.length} total · {units.filter(u => u.status === 'vacant').length} vacant · {units.filter(u => u.status === 'occupied').length} occupied</div>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', gap: 4 }}>
            {['all','vacant','occupied'].map(f => <button key={f} className={`btn ${filter === f ? 'btn-green' : ''}`} style={{ fontSize: 11 }} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}</button>)}
          </div>
          {user?.role === 'landlord' && <button className="btn btn-green" onClick={() => { setForm(EMPTY); setModal('add') }}>+ Add unit</button>}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">🏠</div><div className="empty-title">No units</div><div className="empty-sub">{user?.role === 'landlord' ? 'Add units to your properties.' : 'You have no active tenancy yet.'}</div></div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
              {filtered.map(u => (
                <div key={u.id} className="card" style={{ borderTop: `3px solid ${u.status === 'occupied' ? 'var(--green)' : 'var(--amber)'}` }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Unit {u.unitNumber}</div>
                      <span className={`pill ${u.status === 'occupied' ? 'pill-green' : 'pill-amber'}`}>{u.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>{u.propertyName}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, fontSize: 11 }}>
                      <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '5px 8px' }}>
                        <div style={{ color: 'var(--text3)' }}>BEDS</div><div style={{ fontWeight: 500 }}>{u.bedrooms}</div>
                      </div>
                      <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '5px 8px' }}>
                        <div style={{ color: 'var(--text3)' }}>BATHS</div><div style={{ fontWeight: 500 }}>{u.bathrooms}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontWeight: 500, fontSize: 15, color: 'var(--green-deeper)', marginBottom: 6 }}>AED {fmt(u.rentAmount)}/yr</div>
                    {u.tenantName && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>👤 {u.tenantName}</div>}
                    {user?.role === 'landlord' && (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => { setForm(u); setModal('edit') }}>Edit</button>
                        <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => del(u.id)}>🗑</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add unit' : 'Edit unit'} onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
          <Field label="Property *">
            <select className="form-select" value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}>
              <option value="">Select property...</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Unit number *"><input className="form-input" value={form.unitNumber} onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))} placeholder="e.g. 301" /></Field>
            <Field label="Floor"><input className="form-input" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="e.g. 3" /></Field>
            <Field label="Bedrooms"><input className="form-input" type="number" min="0" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: parseInt(e.target.value) }))} /></Field>
            <Field label="Bathrooms"><input className="form-input" type="number" min="0" value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: parseInt(e.target.value) }))} /></Field>
            <Field label="Size (sqft)"><input className="form-input" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. 850" /></Field>
            <Field label="Annual rent (AED)"><input className="form-input" type="number" value={form.rentAmount} onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="e.g. 60000" /></Field>
          </div>
          {modal === 'edit' && (
            <Field label="Status">
              <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Under maintenance</option>
              </select>
            </Field>
          )}
        </Modal>
      )}
    </>
  )
}
