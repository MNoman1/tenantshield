import { useState, useEffect } from 'react'
import api from '../api'
import { useToast, Modal, Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const EMPTY = { unitId: '', tenantEmail: '', startDate: '', endDate: '', rentAmount: '', securityDeposit: '', ejariNumber: '', noticePeriod: 90 }

export default function TenanciesPage() {
  const { user } = useAuth()
  const [tenancies, setTenancies] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [showToast, Toast] = useToast()

  const load = async () => {
    const [t, u] = await Promise.all([api.get('/api/tenancies'), user?.role === 'landlord' ? api.get('/api/units') : Promise.resolve({ data: [] })])
    setTenancies(t.data); setUnits(u.data.filter(x => x.status === 'vacant' || x.id === form.unitId)); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const fmt = n => Number(n || 0).toLocaleString('en-AE')
  const daysLeft = (end) => Math.max(0, Math.floor((new Date(end) - Date.now()) / 86400000))

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/api/tenancies', { ...form, rentAmount: parseFloat(form.rentAmount), securityDeposit: parseFloat(form.securityDeposit) || 0 })
      showToast('Tenancy created ✓'); setModal(null); load()
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error') }
    finally { setSaving(false) }
  }

  const endTenancy = async (id) => {
    if (!confirm('Mark this tenancy as ended?')) return
    await api.put(`/api/tenancies/${id}`, { status: 'ended' }).catch(() => {})
    showToast('Tenancy ended'); load()
  }

  const STATUS_COLOR = { active: 'pill-green', ended: 'pill-gray', expired: 'pill-red' }

  return (
    <>
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">{user?.role === 'landlord' ? 'Tenancies' : 'My Lease'}</div>
          <div className="page-sub">{tenancies.filter(t => t.status === 'active').length} active · {tenancies.filter(t => t.status === 'ended').length} ended</div>
        </div>
        {user?.role === 'landlord' && <button className="btn btn-green" onClick={() => { setForm(EMPTY); setModal('add') }}>+ New tenancy</button>}
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          tenancies.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No tenancies</div><div className="empty-sub">{user?.role === 'landlord' ? 'Create a tenancy by linking a unit to a tenant.' : 'Your landlord will set up your tenancy.'}</div></div> :
          tenancies.map(t => {
            const days = daysLeft(t.endDate)
            const expiring = days < 90 && t.status === 'active'
            return (
              <div key={t.id} className="card" style={{ marginBottom: 12 }}>
                <div className="card-header">
                  <div style={{ display: 'flex', align: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500 }}>Unit {t.unitNumber} — {t.propertyName}</span>
                    <span className={`pill ${STATUS_COLOR[t.status] || 'pill-gray'}`}>{t.status}</span>
                    {expiring && <span className="pill pill-amber">⚠️ Expires in {days} days</span>}
                  </div>
                  {user?.role === 'landlord' && t.status === 'active' && <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => endTenancy(t.id)}>End tenancy</button>}
                </div>
                <div className="card-body">
                  <div className="three-col" style={{ marginBottom: 12 }}>
                    <div><div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>{user?.role === 'landlord' ? 'TENANT' : 'LANDLORD'}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{user?.role === 'landlord' ? t.tenantName : t.landlordName}</div><div style={{ fontSize: 11, color: 'var(--text2)' }}>{user?.role === 'landlord' ? t.tenantEmail : ''}</div></div>
                    <div><div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>ANNUAL RENT</div><div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: 'var(--green-deeper)' }}>AED {fmt(t.rentAmount)}</div></div>
                    <div><div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>DEPOSIT</div><div style={{ fontSize: 13, fontFamily: 'IBM Plex Mono' }}>AED {fmt(t.securityDeposit)}</div></div>
                    <div><div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>START</div><div style={{ fontSize: 12 }}>{new Date(t.startDate).toLocaleDateString('en-AE')}</div></div>
                    <div><div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>END</div><div style={{ fontSize: 12 }}>{new Date(t.endDate).toLocaleDateString('en-AE')}</div></div>
                    {t.ejariNumber && <div><div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>EJARI</div><div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}>{t.ejariNumber}</div></div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12 }}><span style={{ color: 'var(--text2)' }}>Paid: </span><span style={{ fontWeight: 500, color: 'var(--green-deeper)', fontFamily: 'IBM Plex Mono' }}>AED {fmt(t.totalPaid)}</span></div>
                    <div style={{ background: 'var(--amber-light)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12 }}><span style={{ color: 'var(--text2)' }}>Due: </span><span style={{ fontWeight: 500, color: 'var(--amber)', fontFamily: 'IBM Plex Mono' }}>AED {fmt(t.totalDue)}</span></div>
                    {t.overdueCount > 0 && <div style={{ background: 'var(--red-light)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12 }}><span style={{ color: 'var(--text2)' }}>Overdue: </span><span style={{ fontWeight: 500, color: 'var(--red)', fontFamily: 'IBM Plex Mono' }}>{t.overdueCount} cheque{t.overdueCount > 1 ? 's' : ''}</span></div>}
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>

      {modal === 'add' && (
        <Modal title="Create tenancy" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Create tenancy'}</button></>}>
          <Field label="Unit *">
            <select className="form-select" value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}>
              <option value="">Select vacant unit...</option>
              {units.filter(u => u.status === 'vacant').map(u => <option key={u.id} value={u.id}>{u.propertyName} — Unit {u.unitNumber}</option>)}
            </select>
          </Field>
          <Field label="Tenant email * (tenant must be registered)"><input className="form-input" type="email" value={form.tenantEmail} onChange={e => setForm(f => ({ ...f, tenantEmail: e.target.value }))} placeholder="tenant@email.com" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Start date *"><input className="form-input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></Field>
            <Field label="End date *"><input className="form-input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></Field>
            <Field label="Annual rent (AED) *"><input className="form-input" type="number" value={form.rentAmount} onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="60000" /></Field>
            <Field label="Security deposit (AED)"><input className="form-input" type="number" value={form.securityDeposit} onChange={e => setForm(f => ({ ...f, securityDeposit: e.target.value }))} placeholder="5000" /></Field>
            <Field label="Ejari number"><input className="form-input" value={form.ejariNumber} onChange={e => setForm(f => ({ ...f, ejariNumber: e.target.value }))} placeholder="Optional" /></Field>
            <Field label="Notice period (days)"><input className="form-input" type="number" value={form.noticePeriod} onChange={e => setForm(f => ({ ...f, noticePeriod: parseInt(e.target.value) }))} /></Field>
          </div>
        </Modal>
      )}
    </>
  )
}
