import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, Field } from '../components/ui'

const NOTICE_TYPES = {
  rent_increase: { label: 'Rent Increase Notice', icon: '📊', color: 'pill-amber' },
  eviction_owner_use: { label: 'Eviction — Owner Use', icon: '🏠', color: 'pill-red' },
  eviction_nonpayment: { label: 'Eviction — Non-Payment', icon: '⚠️', color: 'pill-red' },
  eviction_breach: { label: 'Eviction — Contract Breach', icon: '🚫', color: 'pill-red' },
  non_renewal: { label: 'Non-Renewal Notice', icon: '📅', color: 'pill-amber' },
  rent_demand: { label: 'Rent Demand Letter', icon: '💰', color: 'pill-amber' },
  general: { label: 'General Notice', icon: '📋', color: 'pill-gray' },
}
const STATUS_PILL = { draft: 'pill-gray', sent: 'pill-blue', acknowledged: 'pill-green', disputed: 'pill-red', withdrawn: 'pill-gray' }

const TEMPLATES = {
  rent_increase: (data) => `RENT INCREASE NOTICE

Date: ${data.date}
Property: ${data.property}, Unit ${data.unit}
Current Annual Rent: AED ${data.currentRent}
Proposed Annual Rent: AED ${data.proposedRent}

Dear ${data.tenantName},

In accordance with ${data.emirateLaw} and the RERA Rental Index, please be informed that your annual rent will be increased from AED ${data.currentRent} to AED ${data.proposedRent} upon renewal of your tenancy agreement.

This notice is provided ${data.noticeDays} days in advance as required by law. The new rent will be effective from ${data.effectiveDate}.

If you wish to dispute this increase, you may file a complaint with the Rent Dispute Settlement Centre within 30 days.

Regards,
${data.landlordName}`,

  eviction_owner_use: (data) => `EVICTION NOTICE — OWNER USE

Date: ${data.date}
Property: ${data.property}, Unit ${data.unit}

Dear ${data.tenantName},

Pursuant to UAE Federal Law and ${data.emirateLaw}, you are hereby notified to vacate the above premises by ${data.vacateDate} (12 months from this notice).

The premises are required for personal use by the owner/owner's immediate family.

Important: You have the right to challenge this notice within 30 days at the Rent Dispute Settlement Centre. The landlord cannot re-let this property for 2 years following eviction.

Regards,
${data.landlordName}`,

  rent_demand: (data) => `RENT DEMAND LETTER

Date: ${data.date}
Property: ${data.property}, Unit ${data.unit}

Dear ${data.tenantName},

This letter serves as a formal demand for payment of overdue rent.

Outstanding Amount: AED ${data.amount}
Due Date: ${data.dueDate}

Kindly arrange payment within 7 days to avoid formal proceedings at the Rent Dispute Settlement Centre.

Regards,
${data.landlordName}`,

  general: (data) => `NOTICE

Date: ${data.date}
Property: ${data.property}, Unit ${data.unit}

Dear ${data.tenantName},

[Enter your notice content here]

Regards,
${data.landlordName}`,
}

function getEmirateLaw(emirate) {
  const laws = { dubai: 'Law No. 26 of 2007 (Dubai Tenancy Law)', sharjah: 'Sharjah Tenancy Decree', abudhabi: 'Abu Dhabi Law No. 20 of 2006' }
  return laws[emirate] || 'UAE Federal Law'
}

export default function NoticesPage() {
  const { user } = useAuth()
  const [notices, setNotices] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [viewContent, setViewContent] = useState('')
  const [form, setForm] = useState({ tenancyId: '', type: 'rent_increase', subject: '', content: '', responseDeadline: '' })
  const [showToast, Toast] = useToast()

  const load = async () => {
    setLoading(true)
    const [n, t] = await Promise.all([api.get('/api/notices'), api.get('/api/tenancies')])
    setNotices(n.data)
    setTenancies(t.data.filter(x => x.status === 'active'))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openView = async (n) => {
    const full = await api.get(`/api/notices/${n.id}`)
    setSelected(full.data)
    setViewContent(full.data.content || '')
    setModal('view')
  }

  const fillTemplate = () => {
    const t = tenancies.find(x => x.id === form.tenancyId)
    if (!t) return
    const templateFn = TEMPLATES[form.type] || TEMPLATES.general
    const days = form.type === 'eviction_owner_use' ? 365 : (t.notice_period_days || 90)
    const effectiveDate = new Date(Date.now() + days * 86400000).toLocaleDateString('en-AE')
    const content = templateFn({
      date: new Date().toLocaleDateString('en-AE', { dateStyle: 'full' }),
      property: t.property_name, unit: t.unit_number,
      tenantName: t.tenant_name, landlordName: user.name,
      currentRent: Number(t.rent_amount).toLocaleString('en-AE'),
      proposedRent: '',
      amount: t.overdueAmt || '',
      dueDate: '',
      vacateDate: effectiveDate, effectiveDate,
      noticeDays: days, emirateLaw: getEmirateLaw(t.emirate),
    })
    setForm(f => ({ ...f, content, subject: NOTICE_TYPES[f.type]?.label || 'Notice' }))
  }

  const save = async () => {
    try {
      await api.post('/api/notices', form)
      showToast('Notice created ✓')
      setModal(null)
      setForm({ tenancyId: '', type: 'rent_increase', subject: '', content: '', responseDeadline: '' })
      load()
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error') }
  }

  const updateStatus = async (id, status) => {
    await api.put(`/api/notices/${id}`, { status, servedAt: status === 'sent' ? new Date().toISOString() : undefined }).catch(() => {})
    showToast(`Status updated to ${status} ✓`)
    load()
  }

  const download = () => {
    if (!selected) return
    const blob = new Blob([viewContent], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${selected.subject || 'notice'}.txt`
    a.click()
  }

  return (
    <>
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Legal Notices</div>
          <div className="page-sub">{notices.length} notice{notices.length !== 1 ? 's' : ''} · UAE-compliant templates</div>
        </div>
        {user.role === 'landlord' && (
          <button className="btn btn-green" onClick={() => setModal('create')}>+ Create Notice</button>
        )}
      </div>

      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          notices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No notices yet</div>
              <div className="empty-sub">{user.role === 'landlord' ? 'Create legal notices using UAE-compliant templates.' : 'Legal notices from your landlord will appear here.'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notices.map(n => {
                const info = NOTICE_TYPES[n.type] || NOTICE_TYPES.general
                return (
                  <div key={n.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openView(n)}>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 24 }}>{info.icon}</span>
                          <div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 500 }}>{n.subject || info.label}</span>
                              <span className={`pill ${info.color}`} style={{ fontSize: 10 }}>{info.label}</span>
                              <span className={`pill ${STATUS_PILL[n.status] || 'pill-gray'}`} style={{ fontSize: 10 }}>{n.status}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                              {n.property_name} · Unit {n.unit_number} · {n.status === 'sent' ? `Issued by ${n.issued_by_name}` : `Draft by ${n.issued_by_name}`}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginTop: 3 }}>
                              {new Date(n.created_at).toLocaleDateString('en-AE')}
                              {n.served_at && ` · Served ${new Date(n.served_at).toLocaleDateString('en-AE')}`}
                              {n.response_deadline && ` · Response by ${new Date(n.response_deadline).toLocaleDateString('en-AE')}`}
                            </div>
                          </div>
                        </div>
                        {user.role === 'landlord' && n.status === 'draft' && (
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button className="btn" style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green-deeper)', border: 'none' }} onClick={() => updateStatus(n.id, 'sent')}>📤 Send</button>
                          </div>
                        )}
                        {user.role === 'tenant' && n.status === 'sent' && (
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button className="btn" style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green-deeper)', border: 'none' }} onClick={() => updateStatus(n.id, 'acknowledged')}>✓ Acknowledge</button>
                            <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => updateStatus(n.id, 'disputed')}>Dispute</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {/* View modal */}
      {modal === 'view' && selected && (
        <Modal title={selected.subject} onClose={() => { setModal(null); setSelected(null) }}
          footer={<><button className="btn" onClick={() => { setModal(null); setSelected(null) }}>Close</button><button className="btn btn-green" onClick={download}>⬇ Download</button></>}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className={`pill ${STATUS_PILL[selected.status] || 'pill-gray'}`}>{selected.status}</span>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>Issued by {selected.issued_by_name} to {selected.issued_to_name}</span>
          </div>
          <textarea value={viewContent} readOnly style={{ width: '100%', minHeight: 320, fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, lineHeight: 1.7, padding: 14, border: '1px solid var(--border2)', borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text)', resize: 'vertical' }} />
        </Modal>
      )}

      {/* Create modal */}
      {modal === 'create' && (
        <Modal title="Create Legal Notice" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn" onClick={fillTemplate} disabled={!form.tenancyId}>⚡ Fill Template</button><button className="btn btn-green" onClick={save}>Create Notice</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Tenancy *">
              <select className="form-select" value={form.tenancyId} onChange={e => setForm(f => ({ ...f, tenancyId: e.target.value }))}>
                <option value="">Select tenancy...</option>
                {tenancies.map(t => <option key={t.id} value={t.id}>{t.tenant_name} — {t.property_name} U{t.unit_number}</option>)}
              </select>
            </Field>
            <Field label="Notice type *">
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(NOTICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Subject">
            <input className="form-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Notice subject line" />
          </Field>
          <Field label="Response deadline">
            <input className="form-input" type="date" value={form.responseDeadline} onChange={e => setForm(f => ({ ...f, responseDeadline: e.target.value }))} />
          </Field>
          <Field label="Content *">
            <textarea className="form-input" style={{ minHeight: 200, fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, lineHeight: 1.7, resize: 'vertical' }} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Click 'Fill Template' to auto-fill, or type manually..." />
          </Field>
        </Modal>
      )}
    </>
  )
}
