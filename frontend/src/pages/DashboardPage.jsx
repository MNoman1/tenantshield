import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const quickActions = [
  { icon: '💬', label: 'Ask a tenancy question', to: '/chat' },
  { icon: '🧮', label: 'Check if rent increase is legal', to: '/calculator' },
  { icon: '📄', label: 'Draft an eviction notice', to: '/chat', query: 'Draft a 12-month eviction notice for owner use in Dubai' },
  { icon: '⚖️', label: 'Know my rights as a tenant', to: '/chat', query: 'What are my rights as a tenant in the UAE?' },
  { icon: '📋', label: 'Draft a 90-day notice letter', to: '/chat', query: 'Draft a 90-day rent increase notice letter from landlord to tenant' },
  { icon: '🏛️', label: 'File a RERA complaint', to: '/chat', query: 'How do I file a complaint with RERA Dubai about an illegal rent increase?' },
]

const lawHighlights = [
  { emirate: 'Dubai', icon: '📊', title: 'RERA Smart Rental Index', desc: 'Live market-based rent caps. Max 20% increase if rent is 40%+ below index.' },
  { emirate: 'Sharjah', icon: '❄️', title: '3-Year Rent Freeze', desc: 'Zero rent increases allowed in Sharjah through 2025 reforms.' },
  { emirate: 'Abu Dhabi', icon: '5️⃣', title: '5% Annual Cap', desc: 'Abu Dhabi limits increases to 5% per year. Register via Tawtheeq.' },
  { emirate: 'UAE-wide', icon: '⏰', title: '90-Day Notice Rule', desc: 'Landlords must give 90 days written notice before any rent change or non-renewal.' },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ messages: 0, drafts: 0, activities: 0 })

  useEffect(() => {
    axios.get('/api/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  const handleQuickAction = (action) => {
    if (action.query) {
      sessionStorage.setItem('chat_prefill', action.query)
    }
    navigate(action.to)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Good day, {user?.name?.split(' ')[0]} 👋</div>
        <div className="page-sub">Your encrypted UAE tenancy workspace — {new Date().toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="dashboard-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">QUESTIONS ASKED</div>
            <div className="stat-value">{stats.messages}</div>
            <div className="stat-sub">Total AI consultations</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">SAVED DRAFTS</div>
            <div className="stat-value">{stats.drafts}</div>
            <div className="stat-sub">Letters & notices</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">EMIRATE</div>
            <div className="stat-value" style={{ fontSize: 18, marginTop: 4 }}>
              {user?.emirate ? user.emirate.charAt(0).toUpperCase() + user.emirate.slice(1) : 'Dubai'}
            </div>
            <div className="stat-sub">Your selected location</div>
          </div>
        </div>

        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-title">⚡ Quick Actions</div>
            {quickActions.map((a, i) => (
              <button key={i} className="quick-action" onClick={() => handleQuickAction(a)}>
                <span className="qa-icon">{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <div className="dash-card-title">📰 UAE Law Highlights</div>
              {lawHighlights.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < lawHighlights.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{l.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{l.title} <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'var(--green-light)', color: 'var(--green-deeper)', padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>{l.emirate}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{l.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="dash-card">
              <div className="dash-card-title">🔒 Your Privacy</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                <div>✅ AES-256-GCM encryption on all stored data</div>
                <div>✅ Your key is derived from your password</div>
                <div>✅ We cannot read your chats or documents</div>
                <div>✅ JWT-authenticated sessions (7-day tokens)</div>
                <div>✅ Rate-limited API endpoints</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
