import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useToast } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function MessagesPage() {
  const { user } = useAuth()
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [newModal, setNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ recipientId: '', tenancyId: '', subject: '' })
  const [tenancies, setTenancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const [showToast, Toast] = useToast()

  const loadThreads = () => api.get('/api/threads').then(r => setThreads(r.data)).catch(() => {})
  const loadMessages = (threadId) => api.get(`/api/threads/${threadId}/messages`).then(r => setMessages(r.data)).catch(() => {})

  useEffect(() => {
    Promise.all([api.get('/api/threads'), api.get('/api/tenancies')])
      .then(([t, ten]) => { setThreads(t.data); setTenancies(ten.data.filter(x => x.status === 'active')) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeThread) { loadMessages(activeThread.id) }
  }, [activeThread])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const selectThread = (t) => { setActiveThread(t); loadMessages(t.id) }

  const send = async () => {
    if (!input.trim() || !activeThread || sending) return
    const text = input.trim()
    setSending(true); setInput('')
    try {
      const msg = await api.post(`/api/threads/${activeThread.id}/messages`, { content: text })
      setMessages(m => [...m, { ...msg.data, content: text, senderName: user?.name }])
      loadThreads()
    } catch { showToast('Failed to send', 'error') }
    finally { setSending(false) }
  }

  const startNew = async () => {
    if (!newForm.tenancyId) return showToast('Select a tenancy', 'error')
    const tenancy = tenancies.find(t => t.id === newForm.tenancyId)
    const recipientId = user?.role === 'landlord' ? tenancy?.tenantId || tenancy?.id : tenancy?.landlordId
    if (!recipientId) return showToast('Could not find recipient', 'error')
    try {
      const t = await api.post('/api/threads', { recipientId: user?.role === 'landlord' ? tenancy.tenantId : '', tenancyId: newForm.tenancyId, subject: newForm.subject || 'General' })
      setNewModal(false); loadThreads()
      setActiveThread(t.data); loadMessages(t.data.id)
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error') }
  }

  const timeStr = (iso) => iso ? new Date(iso).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : ''
  const dateStr = (iso) => iso ? new Date(iso).toLocaleDateString('en-AE', { day: '2-digit', month: 'short' }) : ''

  return (
    <>
      {Toast}
      <div className="page-header">
        <div><div className="page-title">Messages</div><div className="page-sub">Direct communication with your {user?.role === 'landlord' ? 'tenants' : 'landlord'}</div></div>
        <button className="btn btn-green" onClick={() => setNewModal(true)}>+ New thread</button>
      </div>

      <div className="msg-layout">
        <div className="thread-list">
          {loading ? <div className="loading-center"><div className="spinner" /></div> :
            threads.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 16px' }}>
                <div className="empty-icon">💬</div>
                <div className="empty-title">No messages</div>
                <div className="empty-sub">Start a conversation with your {user?.role === 'landlord' ? 'tenant' : 'landlord'}.</div>
              </div>
            ) : threads.map(t => (
              <div key={t.id} className={`thread-item ${activeThread?.id === t.id ? 'active' : ''}`} onClick={() => selectThread(t)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div className="thread-name">{t.otherName || 'Unknown'}</div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {t.unreadCount > 0 && <span className="unread-badge">{t.unreadCount}</span>}
                    <span className="thread-time">{dateStr(t.lastAt)}</span>
                  </div>
                </div>
                <div className="thread-preview">{t.lastMessage || t.subject}</div>
              </div>
            ))
          }
        </div>

        {activeThread ? (
          <div className="chat-wrap" style={{ height: 'calc(100vh - 57px)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--green-deeper)' }}>{activeThread.otherName?.[0]}</div>
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>{activeThread.otherName}</div><div style={{ fontSize: 10, color: 'var(--text3)' }}>{activeThread.subject}</div></div>
            </div>

            <div className="chat-messages">
              {messages.map(m => {
                const isMe = m.senderId === (user?.id || '')
                return (
                  <div key={m.id} className={`msg ${isMe ? 'user' : 'ai'}`}>
                    <div className={`msg-av ${isMe ? 'user' : 'ai'}`}>{m.senderName?.[0]}</div>
                    <div>
                      <div className="msg-bubble" style={{ fontSize: 13 }}>{m.content}</div>
                      <div className="msg-time">{timeStr(m.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="chat-bottom">
              <div className="chat-row">
                <textarea className="chat-ta" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Type a message... (Enter to send)" rows={1} />
                <button className="chat-send" onClick={send} disabled={sending || !input.trim()}>↑</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ margin: 'auto' }}>
            <div className="empty-icon">💬</div>
            <div className="empty-title">Select a conversation</div>
            <div className="empty-sub">Choose a thread from the left or start a new one.</div>
          </div>
        )}
      </div>

      {newModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setNewModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">New conversation</div>
              <button className="modal-close" onClick={() => setNewModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tenancy *</label>
                <select className="form-select" value={newForm.tenancyId} onChange={e => setNewForm(f => ({ ...f, tenancyId: e.target.value }))}>
                  <option value="">Select tenancy...</option>
                  {tenancies.map(t => <option key={t.id} value={t.id}>{user?.role === 'landlord' ? t.tenantName : t.landlordName} — {t.propertyName} Unit {t.unitNumber}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={newForm.subject} onChange={e => setNewForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Maintenance request, Rent query..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setNewModal(false)}>Cancel</button>
              <button className="btn btn-green" onClick={startNew}>Start conversation</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
