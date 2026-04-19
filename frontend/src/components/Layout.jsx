import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import api from '../api'

const LANDLORD_NAV = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '⊞', exact: true }] },
  { section: 'Portfolio', items: [
    { to: '/properties', label: 'Properties', icon: '🏢' },
    { to: '/units', label: 'Units', icon: '🏠' },
    { to: '/tenancies', label: 'Tenancies', icon: '📋' },
  ]},
  { section: 'Finance', items: [
    { to: '/cheques', label: 'Cheques & Payments', icon: '💳' },
    { to: '/expenses', label: 'Expenses', icon: '💸' },
  ]},
  { section: 'Legal & Docs', items: [
    { to: '/contracts', label: 'Contracts', icon: '📜' },
    { to: '/notices', label: 'Legal Notices', icon: '⚖️' },
    { to: '/inspections', label: 'Inspections', icon: '🔍' },
    { to: '/documents', label: 'Documents', icon: '📁' },
  ]},
  { section: 'Operations', items: [
    { to: '/maintenance', label: 'Maintenance', icon: '🔧' },
    { to: '/utilities', label: 'Utilities', icon: '⚡' },
    { to: '/messages', label: 'Messages', icon: '💬' },
  ]},
  { section: 'AI Tools', items: [
    { to: '/chat', label: 'AI Assistant', icon: '🤖' },
    { to: '/calculator', label: 'Rent Calculator', icon: '🧮' },
    { to: '/drafts', label: 'Saved Drafts', icon: '📄' },
  ]},
]

const TENANT_NAV = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '⊞', exact: true }] },
  { section: 'My Tenancy', items: [
    { to: '/tenancies', label: 'My Lease', icon: '📋' },
    { to: '/cheques', label: 'Payments', icon: '💳' },
    { to: '/contracts', label: 'Contracts', icon: '📜' },
    { to: '/utilities', label: 'Utilities', icon: '⚡' },
  ]},
  { section: 'Legal & Docs', items: [
    { to: '/notices', label: 'Legal Notices', icon: '⚖️' },
    { to: '/inspections', label: 'Inspections', icon: '🔍' },
    { to: '/documents', label: 'Documents', icon: '📁' },
  ]},
  { section: 'Communicate', items: [
    { to: '/messages', label: 'Messages', icon: '💬' },
    { to: '/maintenance', label: 'Maintenance', icon: '🔧' },
  ]},
  { section: 'AI Tools', items: [
    { to: '/chat', label: 'AI Assistant', icon: '🤖' },
    { to: '/calculator', label: 'Rent Calculator', icon: '🧮' },
    { to: '/drafts', label: 'Saved Drafts', icon: '📄' },
  ]},
]

const EMIRATE_OPTIONS = [
  { value: 'dubai', label: 'Dubai' },
  { value: 'sharjah', label: 'Sharjah' },
  { value: 'abudhabi', label: 'Abu Dhabi' },
  { value: 'ajman', label: 'Ajman' },
  { value: 'rak', label: 'Ras Al Khaimah' },
  { value: 'fujairah', label: 'Fujairah' },
  { value: 'uaq', label: 'Umm Al Quwain' },
]

export default function Layout() {
  const { user, logout, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [unread, setUnread] = useState(0)
  const nav = user?.role === 'landlord' ? LANDLORD_NAV : TENANT_NAV

  useEffect(() => {
    const check = () => api.get('/api/notifications').then(r => setUnread(r.data.filter(n => !n.is_read).length)).catch(() => {})
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
        <div className="sidebar-top">
          <div className="logo-row">
            <div className="logo-mark">🏠</div>
            {open && <div><div className="logo-name">TenantShield</div><div className="logo-sub">UAE Property AI v3</div></div>}
            <button className="toggle-btn" onClick={() => setOpen(o => !o)}>{open ? '◀' : '▶'}</button>
          </div>
          {open && (
            <div style={{ marginBottom: 8 }}>
              <div className="picker-label">EMIRATE</div>
              <select className="emirate-select" value={user?.emirate || 'dubai'}
                onChange={e => updateProfile && updateProfile({ emirate: e.target.value })}>
                {EMIRATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          {open && <div className={`role-pill ${user?.role}`}>{user?.role === 'landlord' ? '🏢 Landlord' : '🧑 Tenant'}</div>}
        </div>

        <div className="nav-section" style={{ flex: 1, overflowY: 'auto' }}>
          {nav.map(section => (
            <div key={section.section}>
              {open && <div className="nav-label">{section.section}</div>}
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.exact}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {open && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      {item.label}
                      {item.to === '/messages' && unread > 0 && (
                        <span style={{ background: 'var(--red)', color: 'white', borderRadius: 20, fontSize: 9, padding: '1px 5px', fontWeight: 600, marginLeft: 'auto' }}>{unread}</span>
                      )}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          {open && (
            <>
              <div className="enc-badge">
                <span style={{ fontSize: 13 }}>🔒</span>
                <div><div className="enc-title">AES-256 Encrypted</div><div className="enc-sub">SQLite · v3.0</div></div>
              </div>
              <div className="user-row">
                <div className={`avatar ${user?.role}`}>{user?.name?.[0]?.toUpperCase()}</div>
                <div className="user-info">
                  <div className="user-name">{user?.name}</div>
                  <div className="user-role">{user?.role} · {user?.emirate || 'dubai'}</div>
                </div>
                <button className="logout-btn" onClick={handleLogout} title="Logout">⏻</button>
              </div>
            </>
          )}
          {!open && <button className="logout-btn" style={{ display: 'block', margin: '0 auto' }} onClick={handleLogout}>⏻</button>}
        </div>
      </aside>

      <main className="main-content"><Outlet /></main>
    </div>
  )
}
