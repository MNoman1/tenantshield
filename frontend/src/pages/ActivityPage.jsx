import { useState, useEffect } from 'react'
import api from '../api'

const TYPE_COLORS = {
  chat: 'var(--green-light)',
  draft_saved: 'var(--blue-light)',
  draft_deleted: 'var(--red-light)',
  calc: 'var(--amber-light)',
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function groupByDay(activities) {
  const groups = {}
  activities.forEach(a => {
    const day = new Date(a.createdAt).toLocaleDateString('en-AE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    if (!groups[day]) groups[day] = []
    groups[day].push(a)
  })
  return groups
}

export default function ActivityPage() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/activity')
      .then(r => setActivities(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const grouped = groupByDay(activities)

  return (
    <>
      <div className="page-header">
        <div className="page-title">Activity Log</div>
        <div className="page-sub">🔒 Encrypted — your recent actions on TenantShield</div>
      </div>

      <div className="activity-body">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">No activity yet</div>
            <div className="empty-sub">Your actions — chats, calculations, saved drafts — will appear here.</div>
          </div>
        ) : (
          Object.entries(grouped).map(([day, acts]) => (
            <div key={day} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text3)', marginBottom: 10, letterSpacing: '0.05em' }}>
                {day}
              </div>
              <div className="activity-list">
                {acts.map(a => (
                  <div key={a.id} className="activity-item" style={{ background: TYPE_COLORS[a.type] || 'var(--surface)', borderColor: 'transparent' }}>
                    <div className="activity-icon">{a.icon}</div>
                    <div>
                      <div className="activity-desc">{a.description}</div>
                      <div className="activity-time">{formatDate(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
