import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

const LANDLORD_NAV = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '⊞', exact: true }] },
  { section: 'Portfolio', items: [
    { to: '/properties', label: 'Properties', icon: '🏢' },
    { to: '/units', label: 'Units', icon: '🏠' },
    { to: '/tenancies', label: 'Tenancies', icon: '📋' },
  ]},
  { section: 'Finance', items: [
    { to: '/cheques', label: 'Cheques & Payments', icon: '💳' },
  ]},
  { section: 'Communicate', items: [
    { to: '/messages', label: 'Messages', icon: '💬' },
    { to: '/documents', label: 'Documents', icon: '📁' },
    { to: '/maintenance', label: 'Maintenance', icon: '🔧' },
  ]},
  { section: 'AI Tools', items: [
    { to: '/chat', label: 'AI Assistant', icon: '🤖' },
    { to: '/calculator', label: 'Rent Calculator', icon: '🧮' },
    { to: '/drafts', label: 'Drafts', icon: '📄' },
  ]},
]

const TENANT_NAV = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '⊞', exact: true }] },
  { section: 'My Tenancy', items: [
    { to: '/tenancies', label: 'My Lease', icon: '📋' },
    { to: '/cheques', label: 'Payments', icon: '💳' },
  ]},
  { section: 'Communicate', items: [
    { to: '/messages', label: 'Messages', icon: '💬' },
    { to: '/documents', label: 'Documents', icon: '📁' },
    { to: '/maintenance', label: 'Maintenance', icon: '🔧' },
  ]},
  { section: 'AI Tools', items: [
    { to: '/chat', label: 'AI Assistant', icon: '🤖' },
    { to: '/calculator', label: 'Rent Calculator', icon: '🧮' },
    { to: '/drafts', label: 'Drafts', icon: '📄' },
  ]},
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const nav = user?.role === 'landlord' ? LANDLORD_NAV : TENANT_NAV

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
        <div className="sidebar-top">
          <div className="logo-row">
            <div className="logo-mark">🏠</div>
            {open && <div><div className="logo-name">TenantShield</div><div className="logo-sub">UAE Property AI</div></div>}
            <button className="toggle-btn" onClick={() => setOpen(o => !o)}>{open ? '◀' : '▶'}</button>
          </div>
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
                  {open && <span>{item.label}</span>}
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
                <div><div className="enc-title">End-to-end encrypted</div><div className="enc-sub">Your data is private</div></div>
              </div>
              <div className="user-row">
                <div className={`avatar ${user?.role}`}>{user?.name?.[0]?.toUpperCase()}</div>
                <div className="user-info">
                  <div className="user-name">{user?.name}</div>
                  <div className="user-role">{user?.role} · {user?.emirate}</div>
                </div>
                <button className="logout-btn" onClick={() => { logout(); navigate('/login') }}>⏻</button>
              </div>
            </>
          )}
          {!open && <button className="logout-btn" style={{ display: 'block', margin: '0 auto' }} onClick={() => { logout(); navigate('/login') }}>⏻</button>}
        </div>
      </aside>

      <main className="main-content"><Outlet /></main>
    </div>
  )
}
