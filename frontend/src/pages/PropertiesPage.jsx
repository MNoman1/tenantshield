import { useState, useEffect } from 'react'
import api from '../api'
import { useToast, Modal, Field } from '../components/ui'

const EMPTY = { name: '', address: '', emirate: 'dubai', type: 'residential' }

export default function PropertiesPage() {
  const [props, setProps] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [showToast, Toast] = useToast()

  const load = () => api.get('/api/properties').then(r => setProps(r.data)).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(EMPTY); setModal('add') }
  const openEdit = (p) => { setForm(p); setModal('edit') }

  const save = async () => {
    if (!form.name || !form.address) return showToast('Name and address required', 'error')
    setSaving(true)
    try {
      if (modal === 'add') await api.post('/api/properties', form)
      else await api.put(`/api/properties/${form.id}`, form)
      showToast(modal === 'add' ? 'Property added ✓' : 'Updated ✓')
      setModal(null); load()
    } catch { showToast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Delete this property? All units will also be removed.')) return
    await api.delete(`/api/properties/${id}`).catch(() => {})
    showToast('Deleted'); load()
  }

  return (
    <>
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Properties</div><div className="page-sub">Your buildings and complexes</div></div>
        <div className="header-actions"><button className="btn btn-green" onClick={openAdd}>+ Add property</button></div>
      </div>
      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          props.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🏢</div><div className="empty-title">No properties yet</div><div className="empty-sub">Add your first property to get started.</div><button className="btn btn-green" style={{ marginTop: 14 }} onClick={openAdd}>+ Add property</button></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
              {props.map(p => (
                <div key={p.id} className="card">
                  <div className="card-body">
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 3 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{p.address}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span className="pill pill-blue">{p.emirate}</span>
                      <span className="pill pill-gray">{p.type}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div style={{ textAlign: 'center', background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 4px' }}>
                        <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'IBM Plex Mono' }}>{p.totalUnits}</div>
                        <div style={{ fontSize: 9, color: 'var(--text3)' }}>TOTAL</div>
                      </div>
                      <div style={{ textAlign: 'center', background: 'var(--green-light)', borderRadius: 'var(--radius)', padding: '8px 4px' }}>
                        <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: 'var(--green-deeper)' }}>{p.occupiedUnits}</div>
                        <div style={{ fontSize: 9, color: 'var(--green-dark)' }}>OCCUPIED</div>
                      </div>
                      <div style={{ textAlign: 'center', background: p.vacantUnits > 0 ? 'var(--amber-light)' : 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 4px' }}>
                        <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: p.vacantUnits > 0 ? 'var(--amber)' : 'var(--text3)' }}>{p.vacantUnits}</div>
                        <div style={{ fontSize: 9, color: p.vacantUnits > 0 ? 'var(--amber)' : 'var(--text3)' }}>VACANT</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(p)}>✏️ Edit</button>
                      <button className="btn btn-red" onClick={() => del(p.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add property' : 'Edit property'} onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
          <Field label="Property name *"><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Al Noor Tower" /></Field>
          <Field label="Full address *"><input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. King Faisal Street, Sharjah" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Emirate">
              <select className="form-select" value={form.emirate} onChange={e => setForm(f => ({ ...f, emirate: e.target.value }))}>
                {['dubai','sharjah','abudhabi','ajman','rak','fujairah','uaq'].map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase()+e.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="villa">Villa</option>
                <option value="mixed">Mixed use</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
