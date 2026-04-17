import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

function fmt(n) { return Number(n || 0).toLocaleString('en-AE') }
function timeAgo(iso) {
  if (!iso) return ''
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`
}

const STATUS_PILL = { paid: 'pill-green', pending: 'pill-amber', overdue: 'pill-red', bounced: 'pill-red' }

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/dashboard').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  if (user?.role === 'landlord') return <LandlordDash data={data} user={user} />
  return <TenantDash data={data} user={user} />
}

function LandlordDash({ data, user }) {
  if (!data) return null
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Good day, {user?.name?.split(' ')[0]} 👋</div>
          <div className="page-sub">Landlord overview — {new Date().toLocaleDateString('en-AE', { dateStyle: 'full' })}</div>
        </div>
        <div className="header-actions">
          <Link to="/properties" className="btn btn-green">+ Add property</Link>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">TOTAL PROPERTIES</div><div className="stat-value">{data.totalProperties}</div><div className="stat-sub">Buildings managed</div></div>
          <div className="stat-card"><div className="stat-label">TOTAL UNITS</div><div className="stat-value">{data.totalUnits}</div><div className="stat-sub">{data.occupiedUnits} occupied · <span style={{ color: 'var(--green)' }}>{data.vacantUnits} free</span></div></div>
          <div className="stat-card green"><div className="stat-label">THIS MONTH INCOME</div><div className="stat-value">AED {fmt(data.monthEarned)}</div><div className="stat-sub">Total collected</div></div>
          <div className="stat-card green"><div className="stat-label">TOTAL EARNED</div><div className="stat-value">AED {fmt(data.totalEarned)}</div><div className="stat-sub">All time</div></div>
          <div className="stat-card amber"><div className="stat-label">TOTAL DUES</div><div className="stat-value">AED {fmt(data.totalDue)}</div><div className="stat-sub">Pending payments</div></div>
          <div className="stat-card red"><div className="stat-label">OVERDUE</div><div className="stat-value">AED {fmt(data.overdueAmt)}</div><div className="stat-sub">Requires action</div></div>
        </div>

        <div className="two-col" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">🏠 Occupancy overview</span><Link to="/units" className="btn" style={{ fontSize: 11 }}>View all</Link></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: data.occupiedUnits, background: 'var(--green)', height: 8, borderRadius: 4 }} />
                <div style={{ flex: data.vacantUnits, background: 'var(--surface2)', height: 8, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span><span style={{ color: 'var(--green)' }}>■</span> Occupied: {data.occupiedUnits}</span>
                <span><span style={{ color: 'var(--text3)' }}>■</span> Vacant: {data.vacantUnits}</span>
              </div>
              {data.vacantUnits > 0 && <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--green-light)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--green-deeper)' }}>💡 {data.vacantUnits} unit{data.vacantUnits > 1 ? 's' : ''} available — list them to increase income</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">⚡ Quick actions</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { to: '/properties', icon: '🏢', label: 'Add a new property' },
                { to: '/units', icon: '🏠', label: 'Add a unit' },
                { to: '/tenancies', icon: '📋', label: 'Create a tenancy' },
                { to: '/cheques', icon: '💳', label: 'Log a cheque payment' },
                { to: '/messages', icon: '💬', label: 'Message a tenant' },
                { to: '/chat', icon: '🤖', label: 'Ask UAE tenancy AI' },
              ].map((a, i) => (
                <Link key={i} to={a.to} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontSize: 12, transition: 'all .15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--green-light)'}
                  onMouseOut={e => e.currentTarget.style.background = ''}>
                  <span style={{ fontSize: 14 }}>{a.icon}</span>{a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {data.recentCheques?.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">💳 Recent cheques</span><Link to="/cheques" className="btn" style={{ fontSize: 11 }}>View all</Link></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tenant</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recentCheques.map(c => (
                    <tr key={c.id}>
                      <td>{c.tenantName || '—'}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontWeight: 500 }}>AED {fmt(c.amount)}</td>
                      <td>{new Date(c.dueDate).toLocaleDateString('en-AE')}</td>
                      <td><span className={`pill ${STATUS_PILL[c.status] || 'pill-gray'}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.maintenanceOpen > 0 && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--amber-light)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--amber)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔧</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--amber)' }}>{data.maintenanceOpen} open maintenance request{data.maintenanceOpen > 1 ? 's' : ''}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Tenants are waiting for a response</div>
            </div>
            <Link to="/maintenance" className="btn" style={{ marginLeft: 'auto', fontSize: 11 }}>Review →</Link>
          </div>
        )}
      </div>
    </>
  )
}

function TenantDash({ data, user }) {
  if (!data) return null
  const t = data.activeTenancy
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Good day, {user?.name?.split(' ')[0]} 👋</div>
          <div className="page-sub">Tenant overview — {new Date().toLocaleDateString('en-AE', { dateStyle: 'full' })}</div>
        </div>
        <div className="header-actions">
          <Link to="/maintenance" className="btn">🔧 Report issue</Link>
          <Link to="/chat" className="btn btn-green">🤖 Ask AI</Link>
        </div>
      </div>
      <div className="page-body">
        {t && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">🏠 My current tenancy</span><span className={`pill pill-green`}>Active</span></div>
            <div className="card-body">
              <div className="three-col">
                <div><div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>PROPERTY</div><div style={{ fontSize: 13, fontWeight: 500 }}>{t.propertyName}</div><div style={{ fontSize: 11, color: 'var(--text2)' }}>{t.propertyAddress}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>UNIT</div><div style={{ fontSize: 13, fontWeight: 500 }}>Unit {t.unitNumber}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>ANNUAL RENT</div><div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'IBM Plex Mono' }}>AED {fmt(t.rentAmount)}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>START DATE</div><div style={{ fontSize: 13 }}>{new Date(t.startDate).toLocaleDateString('en-AE')}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>END DATE</div><div style={{ fontSize: 13 }}>{new Date(t.endDate).toLocaleDateString('en-AE')}</div></div>
                {t.ejariNumber && <div><div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>EJARI NO.</div><div style={{ fontSize: 13, fontFamily: 'IBM Plex Mono' }}>{t.ejariNumber}</div></div>}
              </div>
            </div>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card green"><div className="stat-label">TOTAL PAID</div><div className="stat-value">AED {fmt(data.totalPaid)}</div><div className="stat-sub">All payments made</div></div>
          <div className="stat-card amber"><div className="stat-label">TOTAL DUE</div><div className="stat-value">AED {fmt(data.totalDue)}</div><div className="stat-sub">Remaining balance</div></div>
          <div className="stat-card red"><div className="stat-label">OVERDUE</div><div className="stat-value">AED {fmt(data.overdueAmt)}</div><div className="stat-sub">{data.overdueCount} cheque{data.overdueCount !== 1 ? 's' : ''}</div></div>
          <div className="stat-card"><div className="stat-label">TOTAL CHEQUES</div><div className="stat-value">{data.totalCheques}</div><div className="stat-sub">In your schedule</div></div>
        </div>

        <div className="two-col">
          {data.upcomingPayments?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">📅 Upcoming payments</span><Link to="/cheques" className="btn" style={{ fontSize: 11 }}>View all</Link></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.upcomingPayments.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface2)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                    <div><div style={{ fontWeight: 500 }}>{c.description || c.type}</div><div style={{ color: 'var(--text2)', fontSize: 11 }}>Due {new Date(c.dueDate).toLocaleDateString('en-AE')}</div></div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontWeight: 500 }}>AED {fmt(c.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">⚡ Quick actions</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { to: '/cheques', icon: '💳', label: 'View my payment schedule' },
                { to: '/messages', icon: '💬', label: 'Message my landlord' },
                { to: '/maintenance', icon: '🔧', label: 'Report a maintenance issue' },
                { to: '/documents', icon: '📁', label: 'View my documents' },
                { to: '/calculator', icon: '🧮', label: 'Check rent increase legality' },
                { to: '/chat', icon: '🤖', label: 'Ask UAE tenancy AI' },
              ].map((a, i) => (
                <Link key={i} to={a.to} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontSize: 12, transition: 'all .15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--blue-light)'}
                  onMouseOut={e => e.currentTarget.style.background = ''}>
                  <span style={{ fontSize: 14 }}>{a.icon}</span>{a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
