import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⊞', exact: true },
  { to: '/chat', label: 'AI Chat', icon: '💬' },
  { to: '/calculator', label: 'Rent Calculator', icon: '🧮' },
  { to: '/drafts', label: 'My Drafts', icon: '📄' },
  { to: '/activity', label: 'Activity', icon: '📊' },
]

const emirateOptions = [
  { value: 'dubai', label: 'Dubai' },
  { value: 'sharjah', label: 'Sharjah' },
  { value: 'abudhabi', label: 'Abu Dhabi' },
  { value: 'ajman', label: 'Ajman' },
  { value: 'rak', label: 'Ras Al Khaimah' },
]

export default function Layout() {
  const { user, logout, updateEmirate } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-top">
          <div className="logo-row">
            <div className="logo-mark">🏠</div>
            {sidebarOpen && (
              <div>
                <div className="logo-name">TenantShield</div>
                <div className="logo-sub">UAE Tenancy AI</div>
              </div>
            )}
            <button className="toggle-btn" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          {sidebarOpen && (
            <div className="emirate-picker">
              <label className="picker-label">YOUR EMIRATE</label>
              <select
                value={user?.emirate || 'dubai'}
                onChange={e => updateEmirate(e.target.value)}
                className="emirate-select"
              >
                {emirateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <nav className="nav-links">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {sidebarOpen && (
            <>
              <div className="enc-badge">
                <span className="enc-icon">🔒</span>
                <div>
                  <div className="enc-title">End-to-End Encrypted</div>
                  <div className="enc-sub">Your data is private</div>
                </div>
              </div>
              <div className="user-row">
                <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
                <div className="user-info">
                  <div className="user-name">{user?.name}</div>
                  <div className="user-email">{user?.email}</div>
                </div>
                <button className="logout-btn" onClick={handleLogout} title="Logout">⏻</button>
              </div>
            </>
          )}
          {!sidebarOpen && (
            <button className="logout-btn-small" onClick={handleLogout} title="Logout">⏻</button>
          )}
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
