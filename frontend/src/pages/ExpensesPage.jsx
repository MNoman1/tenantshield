import { useState, useEffect } from 'react'
import api from '../api'
import { useToast, Modal, Field } from '../components/ui'

const CATEGORIES = {
  maintenance: { label: 'Maintenance & Repairs', icon: '🔧', color: 'pill-amber' },
  renovation: { label: 'Renovation', icon: '🏗️', color: 'pill-blue' },
  insurance: { label: 'Insurance', icon: '🛡️', color: 'pill-green' },
  municipality_fees: { label: 'Municipality Fees', icon: '🏛️', color: 'pill-gray' },
  service_charge: { label: 'Service Charge', icon: '🏢', color: 'pill-gray' },
  management_fee: { label: 'Management Fee', icon: '👔', color: 'pill-purple' },
  legal: { label: 'Legal Fees', icon: '⚖️', color: 'pill-red' },
  marketing: { label: 'Marketing/Listing', icon: '📢', color: 'pill-blue' },
  utility: { label: 'Utilities', icon: '💡', color: 'pill-amber' },
  other: { label: 'Other', icon: '📌', color: 'pill-gray' },
}

const EMPTY = { propertyId: '', unitId: '', tenancyId: '', category: 'maintenance', description: '', amount: '', expenseDate: '', paidBy: 'landlord', vendorName: '', receiptRef: '', isRecurring: false, recurrence: '' }

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [properties, setProperties] = useState([])
  const [units, setUnits] = useState([])
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState({ category: '', propertyId: '', from: '', to: '' })
  const [showToast, Toast] = useToast()

  const load = async () => {
    setLoading(true)
    const [e, p, u, t] = await Promise.all([
      api.get('/api/expenses', { params: filter }),
      api.get('/api/properties'),
      api.get('/api/units'),
      api.get('/api/tenancies'),
    ])
    setExpenses(e.data); setProperties(p.data); setUnits(u.data); setTenancies(t.data.filter(x => x.status === 'active'))
    setLoading(false)
  }
  useEffect(() => { load() }, [filter.propertyId, filter.from, filter.to])

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const byCategory = {}
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount })

  const save = async () => {
    if (!form.category || !form.description || !form.amount || !form.expenseDate) return showToast('Fill required fields', 'error')
    try {
      await api.post('/api/expenses', { ...form, amount: parseFloat(form.amount) })
      showToast('Expense recorded ✓')
      setModal(null); setForm(EMPTY); load()
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error') }
  }

  const del = async (id) => {
    if (!confirm('Delete this expense?')) return
    await api.delete(`/api/expenses/${id}`).catch(() => {})
    showToast('Deleted'); load()
  }

  const fmt = n => `AED ${Number(n||0).toLocaleString('en-AE')}`

  return (
    <>
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Expenses</div><div className="page-sub">Track costs across all properties</div></div>
        <button className="btn btn-green" onClick={() => { setForm(EMPTY); setModal('add') }}>+ Add Expense</button>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-label">TOTAL EXPENSES</div><div className="stat-value" style={{ color: 'var(--red)', fontSize: 22 }}>{fmt(totalExpenses)}</div></div>
          <div className="stat-card"><div className="stat-label">LARGEST CATEGORY</div><div className="stat-value" style={{ fontSize: 16, marginTop: 4 }}>{Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0]?.[0]?.replace(/_/g,' ')||'—'}</div></div>
          <div className="stat-card"><div className="stat-label">TOTAL RECORDS</div><div className="stat-value">{expenses.length}</div></div>
        </div>

        {/* Category breakdown */}
        {Object.keys(byCategory).length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">📊 By Category</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => {
                  const info = CATEGORIES[cat] || CATEGORIES.other
                  const pct = Math.round((amt / totalExpenses) * 100)
                  return (
                    <div key={cat} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 12px', minWidth: 140 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{info.icon} {info.label}</div>
                      <div style={{ fontFamily: 'IBM Plex Mono', fontWeight: 500, fontSize: 14 }}>{fmt(amt)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{pct}% of total</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <select style={{ padding: '7px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 12, background: 'var(--surface)' }} value={filter.propertyId} onChange={e => setFilter(f => ({ ...f, propertyId: e.target.value }))}>
            <option value="">All properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" style={{ padding: '7px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 12 }} value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} placeholder="From" />
          <input type="date" style={{ padding: '7px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', fontSize: 12 }} value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} placeholder="To" />
          <button className="btn" onClick={() => setFilter({ category: '', propertyId: '', from: '', to: '' })}>Clear</button>
        </div>

        {/* Expenses table */}
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
          expenses.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">💰</div><div className="empty-title">No expenses yet</div><div className="empty-sub">Record maintenance costs, fees, and other property expenses.</div></div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Property / Unit</th><th>Vendor</th><th>Paid by</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
                  <tbody>
                    {expenses.map(e => {
                      const info = CATEGORIES[e.category] || CATEGORIES.other
                      return (
                        <tr key={e.id}>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{new Date(e.expense_date).toLocaleDateString('en-AE')}</td>
                          <td><span className={`pill ${info.color}`} style={{ fontSize: 10 }}>{info.icon} {info.label}</span></td>
                          <td style={{ fontSize: 12 }}>{e.description}</td>
                          <td style={{ fontSize: 11, color: 'var(--text2)' }}>{e.property_name}{e.unit_number ? ` · U${e.unit_number}` : ''}</td>
                          <td style={{ fontSize: 11, color: 'var(--text2)' }}>{e.vendor_name || '—'}</td>
                          <td><span className="pill pill-gray" style={{ fontSize: 10 }}>{e.paid_by}</span></td>
                          <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono', fontWeight: 500, color: 'var(--red)' }}>{fmt(e.amount)}</td>
                          <td><button className="btn btn-red" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => del(e.id)}>🗑</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot><tr>
                    <td colSpan={6} style={{ textAlign: 'right', fontWeight: 500, padding: '10px 12px', borderTop: '2px solid var(--border)', fontSize: 13 }}>Total:</td>
                    <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--red)', padding: '10px 12px', borderTop: '2px solid var(--border)' }}>{fmt(totalExpenses)}</td>
                    <td style={{ borderTop: '2px solid var(--border)' }}></td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )
        }
      </div>

      {modal === 'add' && (
        <Modal title="Add Expense" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-green" onClick={save}>Save Expense</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Category *">
              <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </Field>
            <Field label="Amount (AED) *">
              <input className="form-input" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="Date *">
              <input className="form-input" type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
            </Field>
            <Field label="Paid by">
              <select className="form-select" value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))}>
                <option value="landlord">Landlord</option>
                <option value="tenant">Tenant (reimbursed)</option>
                <option value="shared">Shared</option>
              </select>
            </Field>
            <Field label="Property">
              <select className="form-select" value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}>
                <option value="">All / General</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <select className="form-select" value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} disabled={!form.propertyId}>
                <option value="">All units</option>
                {units.filter(u => u.property_id === form.propertyId).map(u => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description *">
            <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. AC repair in Unit 301" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Vendor name">
              <input className="form-input" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} placeholder="Contractor / supplier name" />
            </Field>
            <Field label="Receipt reference">
              <input className="form-input" value={form.receiptRef} onChange={e => setForm(f => ({ ...f, receiptRef: e.target.value }))} placeholder="Invoice / receipt number" />
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
