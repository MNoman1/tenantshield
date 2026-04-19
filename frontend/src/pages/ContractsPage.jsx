import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, Field } from '../components/ui'

const STATUS_PILL = {
  draft: 'pill-gray', sent: 'pill-blue', signed_landlord: 'pill-amber',
  signed_tenant: 'pill-amber', fully_signed: 'pill-green', cancelled: 'pill-red'
}
const STATUS_LABEL = {
  draft: 'Draft', sent: 'Sent', signed_landlord: 'Landlord Signed',
  signed_tenant: 'Tenant Signed', fully_signed: '✅ Fully Signed', cancelled: 'Cancelled'
}

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [modal, setModal] = useState(null)
  const [genTenancyId, setGenTenancyId] = useState('')
  const [showToast, Toast] = useToast()

  const load = async () => {
    setLoading(true)
    const [c, t] = await Promise.all([api.get('/api/contracts'), api.get('/api/tenancies')])
    setContracts(c.data)
    setTenancies(t.data.filter(x => x.status === 'active'))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openContract = async (c) => {
    const full = await api.get(`/api/contracts/${c.id}`)
    setSelected(full.data)
    setContent(full.data.content || '')
  }

  const generate = async () => {
    if (!genTenancyId) return showToast('Select a tenancy', 'error')
    setGenerating(true)
    try {
      const r = await api.post('/api/contracts/generate', { tenancyId: genTenancyId })
      showToast('Contract generated ✓')
      setModal(null)
      await load()
      setSelected({ ...r.data })
      setContent(r.data.content)
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error') }
    finally { setGenerating(false) }
  }

  const sign = async () => {
    if (!selected) return
    const newStatus = user.role === 'landlord' ? 'signed_landlord' : 'signed_tenant'
    await api.put(`/api/contracts/${selected.id}`, { status: newStatus }).catch(() => {})
    showToast('Contract signed ✓')
    load()
    setSelected(s => ({ ...s, status: newStatus }))
  }

  const saveEdits = async () => {
    await api.put(`/api/contracts/${selected.id}`, { content }).catch(() => {})
    showToast('Saved ✓')
  }

  const downloadTxt = () => {
    if (!selected) return
    const blob = new Blob([content], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${selected.title || 'contract'}.txt`
    a.click()
  }

  const canSign = selected && (
    (user.role === 'landlord' && !selected.landlord_signed_at) ||
    (user.role === 'tenant' && !selected.tenant_signed_at)
  ) && selected.status !== 'cancelled' && selected.status !== 'draft'

  return (
    <>
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Contracts</div>
          <div className="page-sub">{contracts.length} contract{contracts.length !== 1 ? 's' : ''} · digital signing & auto-generation</div>
        </div>
        {user.role === 'landlord' && (
          <div className="header-actions">
            <button className="btn btn-green" onClick={() => setModal('generate')}>⚡ Generate Contract</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap: 0, height: 'calc(100vh - 57px)' }}>
        {/* List */}
        <div style={{ borderRight: selected ? '1px solid var(--border)' : 'none', overflowY: 'auto' }}>
          <div className="page-body">
            {loading ? <div className="loading-center"><div className="spinner" /></div> :
              contracts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-title">No contracts yet</div>
                  <div className="empty-sub">{user.role === 'landlord' ? 'Generate a contract from an active tenancy.' : 'Your landlord will prepare your contract.'}</div>
                </div>
              ) : contracts.map(c => (
                <div key={c.id} className="card" style={{ marginBottom: 10, cursor: 'pointer', borderLeft: selected?.id === c.id ? '3px solid var(--green)' : '3px solid transparent' }} onClick={() => openContract(c)}>
                  <div className="card-body" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</div>
                      <span className={`pill ${STATUS_PILL[c.status] || 'pill-gray'}`} style={{ fontSize: 10, marginLeft: 6, flexShrink: 0 }}>{STATUS_LABEL[c.status] || c.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{c.property_name} · Unit {c.unit_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'IBM Plex Mono' }}>
                      {c.tenant_name} · {new Date(c.created_at).toLocaleDateString('en-AE')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {c.landlord_signed_at && <span className="pill pill-green" style={{ fontSize: 9 }}>LL Signed</span>}
                      {c.tenant_signed_at && <span className="pill pill-green" style={{ fontSize: 9 }}>Tenant Signed</span>}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Detail pane */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  <span className={`pill ${STATUS_PILL[selected.status]}`} style={{ fontSize: 9, marginRight: 6 }}>{STATUS_LABEL[selected.status]}</span>
                  {selected.landlord_signed_at && <span style={{ marginRight: 8 }}>🏢 Landlord signed {new Date(selected.landlord_signed_at).toLocaleDateString('en-AE')}</span>}
                  {selected.tenant_signed_at && <span>🧑 Tenant signed {new Date(selected.tenant_signed_at).toLocaleDateString('en-AE')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn" style={{ fontSize: 11 }} onClick={downloadTxt}>⬇ Download</button>
                {user.role === 'landlord' && selected.status === 'draft' && <button className="btn" style={{ fontSize: 11 }} onClick={() => api.put(`/api/contracts/${selected.id}`, { status: 'sent' }).then(() => { showToast('Sent to tenant ✓'); load(); setSelected(s => ({ ...s, status: 'sent' })) })}>📤 Send to Tenant</button>}
                {canSign && <button className="btn btn-green" style={{ fontSize: 11 }} onClick={sign}>✍️ Sign Contract</button>}
                <button className="btn" style={{ fontSize: 11 }} onClick={saveEdits}>💾 Save</button>
                <button className="btn" style={{ fontSize: 11 }} onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                readOnly={user.role === 'tenant' || selected.status === 'fully_signed'}
                style={{ width: '100%', height: '100%', minHeight: 500, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, lineHeight: 1.7, padding: 16, border: '1px solid var(--border2)', borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text)', resize: 'none', outline: 'none' }}
              />
            </div>
          </div>
        )}
      </div>

      {modal === 'generate' && (
        <Modal title="Generate Contract" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={generate} disabled={generating}>{generating ? 'Generating...' : '⚡ Generate'}</button></>}>
          <Field label="Select active tenancy *">
            <select className="form-select" value={genTenancyId} onChange={e => setGenTenancyId(e.target.value)}>
              <option value="">Choose tenancy...</option>
              {tenancies.map(t => <option key={t.id} value={t.id}>{t.tenant_name} — {t.property_name} Unit {t.unit_number}</option>)}
            </select>
          </Field>
          <div style={{ padding: '10px 12px', background: 'var(--green-light)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--green-deeper)' }}>
            ⚡ The system will auto-generate a UAE-compliant tenancy contract with all details pre-filled from the tenancy record. You can edit it before sending to the tenant.
          </div>
        </Modal>
      )}
    </>
  )
}
