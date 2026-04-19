import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, Field } from '../components/ui'

const ROOMS = ['Living Room', 'Master Bedroom', 'Bedroom 2', 'Bedroom 3', 'Kitchen', 'Bathroom 1', 'Bathroom 2', 'Balcony', 'Storage', 'Entrance Hall', 'Parking']
const ITEMS_BY_ROOM = {
  'Living Room': ['Walls & Ceiling', 'Flooring', 'Windows & Glass', 'Doors & Handles', 'Light Fixtures', 'AC Unit', 'Electrical Sockets', 'Curtains/Blinds'],
  'Kitchen': ['Walls & Tiles', 'Flooring', 'Cabinets & Drawers', 'Countertop', 'Sink & Taps', 'Cooking Hob', 'Exhaust Fan', 'Fridge (if provided)', 'Dishwasher (if provided)'],
  'Master Bedroom': ['Walls & Ceiling', 'Flooring', 'Windows & Glass', 'Built-in Wardrobes', 'AC Unit', 'Electrical Sockets', 'Doors & Handles'],
  'default': ['Walls & Ceiling', 'Flooring', 'Windows & Glass', 'Doors & Handles', 'Light Fixtures', 'AC Unit', 'Electrical Sockets'],
}
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'damaged', 'missing']
const COND_COLOR = { excellent: 'var(--green)', good: 'var(--green-dark)', fair: 'var(--amber)', poor: 'var(--red)', damaged: 'var(--red)', missing: 'var(--red)' }
const TYPE_LABEL = { move_in: '🔑 Move-In', move_out: '🚪 Move-Out', routine: '🔍 Routine', inventory: '📦 Inventory' }

export default function InspectionsPage() {
  const { user } = useAuth()
  const [inspections, setInspections] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [form, setForm] = useState({ tenancyId: '', type: 'move_in', overallCondition: 'good', notes: '', inspectorName: '', tenantPresent: false })
  const [rooms, setRooms] = useState([])
  const [showToast, Toast] = useToast()

  const load = async () => {
    setLoading(true)
    const [i, t] = await Promise.all([api.get('/api/inspections'), api.get('/api/tenancies')])
    setInspections(i.data)
    setTenancies(t.data.filter(x => x.status === 'active'))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const addDefaultRooms = () => {
    const defaultItems = ROOMS.slice(0, 5).map(room => ({
      room, items: (ITEMS_BY_ROOM[room] || ITEMS_BY_ROOM.default).map(item => ({ item_name: item, condition: 'good', notes: '', estimated_cost: 0 }))
    }))
    setRooms(defaultItems)
  }

  const addRoom = (roomName) => {
    if (!roomName || rooms.find(r => r.room === roomName)) return
    setRooms(prev => [...prev, { room: roomName, items: (ITEMS_BY_ROOM[roomName] || ITEMS_BY_ROOM.default).map(i => ({ item_name: i, condition: 'good', notes: '', estimated_cost: 0 })) }])
  }

  const updateItem = (roomIdx, itemIdx, field, value) => {
    setRooms(prev => {
      const next = [...prev]
      next[roomIdx] = { ...next[roomIdx], items: [...next[roomIdx].items] }
      next[roomIdx].items[itemIdx] = { ...next[roomIdx].items[itemIdx], [field]: value }
      return next
    })
  }

  const save = async () => {
    try {
      const items = rooms.flatMap(r => r.items.map(it => ({ ...it, room: r.room })))
      await api.post('/api/inspections', { ...form, items })
      showToast('Inspection saved ✓')
      setModal(null)
      setRooms([])
      load()
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error') }
  }

  const openView = async (insp) => {
    const full = await api.get(`/api/inspections/${insp.id}`)
    setViewing(full.data)
    setModal('view')
  }

  const totalDamage = viewing?.items?.reduce((s, it) => s + (it.estimated_cost || 0), 0) || 0

  return (
    <>
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Inspections</div>
          <div className="page-sub">Move-in · Move-out · Routine inspection reports</div>
        </div>
        <button className="btn btn-green" onClick={() => { setModal('create'); addDefaultRooms() }}>+ New Inspection</button>
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          inspections.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No inspections yet</div>
              <div className="empty-sub">Create move-in and move-out inspection reports to track property condition.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {inspections.map(insp => (
                <div key={insp.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openView(insp)}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{TYPE_LABEL[insp.type] || insp.type}</span>
                          <span className={`pill ${insp.overall_condition === 'good' || insp.overall_condition === 'excellent' ? 'pill-green' : insp.overall_condition === 'fair' ? 'pill-amber' : 'pill-red'}`} style={{ fontSize: 10 }}>{insp.overall_condition}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{insp.property_name} · Unit {insp.unit_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginTop: 3 }}>
                          {new Date(insp.created_at).toLocaleDateString('en-AE')} · {insp.inspector_name || 'Inspector not named'}
                          {insp.tenant_present ? ' · Tenant present ✓' : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>View report →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* View report */}
      {modal === 'view' && viewing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh' }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{TYPE_LABEL[viewing.type]} Inspection Report</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{new Date(viewing.created_at).toLocaleDateString('en-AE')} · Overall: <strong>{viewing.overall_condition}</strong></div>
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              {viewing.notes && <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', fontSize: 12, marginBottom: 14, color: 'var(--text2)' }}>📝 {viewing.notes}</div>}
              {viewing.items && (() => {
                const grouped = {}
                viewing.items.forEach(it => { if (!grouped[it.room]) grouped[it.room] = []; grouped[it.room].push(it); })
                return Object.entries(grouped).map(([room, items]) => (
                  <div key={room} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 'var(--radius)' }}>{room}</div>
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}>ITEM</th><th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}>CONDITION</th><th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}>NOTES</th><th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text2)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}>COST</th></tr></thead>
                      <tbody>
                        {items.map((it, i) => (
                          <tr key={i}><td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{it.item_name}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}><span style={{ color: COND_COLOR[it.condition] || 'inherit', fontWeight: 500 }}>{it.condition}</span></td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{it.notes || '—'}</td>
                          <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontFamily: 'IBM Plex Mono' }}>{it.estimated_cost > 0 ? `AED ${it.estimated_cost}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              })()}
              {totalDamage > 0 && <div style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 500, color: 'var(--red)', fontFamily: 'IBM Plex Mono' }}>Total estimated damage cost: AED {totalDamage.toLocaleString('en-AE')}</div>}
            </div>
            <div className="modal-footer"><button className="btn btn-green" onClick={() => setModal(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 760, maxHeight: '92vh' }}>
            <div className="modal-header">
              <div className="modal-title">New Inspection Report</div>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <Field label="Tenancy *">
                  <select className="form-select" value={form.tenancyId} onChange={e => setForm(f => ({ ...f, tenancyId: e.target.value }))}>
                    <option value="">Select tenancy...</option>
                    {tenancies.map(t => <option key={t.id} value={t.id}>{t.property_name} Unit {t.unit_number} — {t.tenant_name}</option>)}
                  </select>
                </Field>
                <Field label="Type *">
                  <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="move_in">🔑 Move-In</option>
                    <option value="move_out">🚪 Move-Out</option>
                    <option value="routine">🔍 Routine</option>
                    <option value="inventory">📦 Inventory</option>
                  </select>
                </Field>
                <Field label="Inspector name">
                  <input className="form-input" value={form.inspectorName} onChange={e => setForm(f => ({ ...f, inspectorName: e.target.value }))} placeholder="Your name" />
                </Field>
                <Field label="Overall condition">
                  <select className="form-select" value={form.overallCondition} onChange={e => setForm(f => ({ ...f, overallCondition: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="General notes">
                <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Overall observations..." />
              </Field>

              <div style={{ display: 'flex', gap: 8, margin: '14px 0 10px', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Rooms & Items</div>
                <select style={{ padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 12, background: 'var(--surface2)', cursor: 'pointer' }} onChange={e => { addRoom(e.target.value); e.target.value = '' }} defaultValue="">
                  <option value="">+ Add room...</option>
                  {ROOMS.filter(r => !rooms.find(x => x.room === r)).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {rooms.map((room, ri) => (
                <div key={ri} style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{room.room}</span>
                    <button onClick={() => setRooms(prev => prev.filter((_, i) => i !== ri))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }}>✕</button>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    {room.items.map((item, ii) => (
                      <div key={ii} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 2fr 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12 }}>{item.item_name}</span>
                        <select style={{ padding: '5px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 11, color: COND_COLOR[item.condition] || 'inherit', fontWeight: 500 }} value={item.condition} onChange={e => updateItem(ri, ii, 'condition', e.target.value)}>
                          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input style={{ padding: '5px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 11 }} placeholder="Notes..." value={item.notes} onChange={e => updateItem(ri, ii, 'notes', e.target.value)} />
                        <input type="number" style={{ padding: '5px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 11 }} placeholder="AED cost" value={item.estimated_cost || ''} onChange={e => updateItem(ri, ii, 'estimated_cost', parseFloat(e.target.value) || 0)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-green" onClick={save}>Save Inspection</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
