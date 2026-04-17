import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui'

const SYSTEM = `You are UAE Tenancy AI — a specialized expert on UAE landlord-tenant law for Dubai, Sharjah, Abu Dhabi, Ajman, RAK and all emirates.

KEY LAWS:
- Dubai: RERA Rental Index governs increases. 0-10% below index = no increase. 11-20% = max 5%. 21-30% = max 10%. 31-40% = max 15%. 40%+ = max 20%. Law No. 26 of 2007 (amended by Law 33 of 2008). 90-day written notice required. Ejari mandatory. Disputes → Rent Dispute Settlement Centre.
- Abu Dhabi: 5% annual cap. DMT governs. Tawtheeq registration required. Disputes → ADJD.
- Sharjah: 3-year rent freeze active (2025 reforms). Zero increases permitted. Sharjah Municipality governs.
- UAE-wide: Eviction for owner use = 12 months notice via notary public. Deposit returned within 30 days of contract end. Tenant can only be evicted for non-payment after court order.

DOCUMENT DRAFTING: When asked to draft a letter, notice, or document, produce a complete, properly formatted UAE-compliant document with date, from/to fields, subject, correct legal reference, clear notice period, and signature block.

TONE: Be specific, cite laws and article numbers. Give clear YES/NO answers then explain. Keep responses under 200 words unless drafting a document. Always end with: "⚠️ For official legal advice, consult a UAE-licensed legal professional."`

const QUICK = [
  'Is my landlord\'s rent increase legal?',
  'Draft a 90-day notice letter',
  'What are my rights if evicted?',
  'How do I register on Ejari?',
  'Draft a RERA complaint letter',
  'Can my landlord keep my deposit?',
]

function fmt(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/^- (.+)$/gm, '<li>$1</li>').replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [histLoaded, setHistLoaded] = useState(false)
  const bottomRef = useRef(null)
  const taRef = useRef(null)
  const [showToast, Toast] = useToast()

  useEffect(() => {
    api.get('/api/chat-history').then(r => {
      setMessages(r.data.map(m => ({ id: m.id, role: m.role, content: m.content, time: m.createdAt })))
      setHistLoaded(true)
    }).catch(() => setHistLoaded(true))
  }, [])

  useEffect(() => {
    if (!histLoaded) return
    const pre = sessionStorage.getItem('chat_prefill')
    if (pre) { sessionStorage.removeItem('chat_prefill'); setInput(pre); setTimeout(() => taRef.current?.focus(), 100) }
  }, [histLoaded])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg = { id: Date.now(), role: 'user', content: text, time: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    setLoading(true)
    api.post('/api/chat-history', { role: 'user', content: text }).catch(() => {})
    const history = messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: text })
    try {
      const resp = await api.post('/api/chat', { system: SYSTEM + `\n\nUser emirate: ${user?.emirate || 'Dubai'}. User role: ${user?.role}.`, messages: history })
      const reply = resp.data.content?.map(c => c.text || '').join('') || 'Sorry, I could not get a response.'
      const aiMsg = { id: Date.now() + 1, role: 'assistant', content: reply, time: new Date().toISOString() }
      setMessages(m => [...m, aiMsg])
      api.post('/api/chat-history', { role: 'assistant', content: reply }).catch(() => {})
    } catch (err) {
      const msg = err.response?.data?.error || 'Connection error. Please try again.'
      setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', content: msg, time: new Date().toISOString() }])
    }
    setLoading(false)
  }

  const saveAsDraft = async () => {
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (!last) return showToast('No AI response to save', 'error')
    await api.post('/api/drafts', { title: `Chat draft — ${new Date().toLocaleDateString('en-AE')}`, content: last.content, type: 'chat', emirate: user?.emirate || 'dubai' }).catch(() => {})
    showToast('Saved to drafts ✓')
  }

  const clearHistory = async () => {
    if (!confirm('Clear all chat history?')) return
    await api.delete('/api/chat-history').catch(() => {})
    setMessages([])
    showToast('History cleared')
  }

  return (
    <>
      {Toast}
      <div className="chat-wrap">
        <div className="page-header">
          <div><div className="page-title">AI Assistant</div><div className="page-sub">🔒 Encrypted history · {messages.filter(m => m.role === 'user').length} questions asked</div></div>
          <div className="header-actions">
            <button className="btn" style={{ fontSize: 11 }} onClick={saveAsDraft}>Save last response</button>
            <button className="btn" style={{ fontSize: 11, color: 'var(--red)' }} onClick={clearHistory}>Clear history</button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 5 }}>UAE Tenancy AI is ready</div>
              <div style={{ fontSize: 12 }}>Ask about rent increases, eviction, Ejari, RERA, or request a legal notice letter.</div>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`msg ${m.role === 'user' ? 'user' : ''}`}>
              <div className={`msg-av ${m.role === 'user' ? 'user' : 'ai'}`}>{m.role === 'user' ? user?.name?.[0] || 'U' : 'AI'}</div>
              <div>
                <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: fmt(m.content) }} />
                <div className="msg-time">{new Date(m.time).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg">
              <div className="msg-av ai">AI</div>
              <div><div className="msg-bubble"><div className="typing"><span className="dot" /><span className="dot" /><span className="dot" /></div></div></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-bottom">
          <div className="quick-chips">
            {QUICK.map((q, i) => <button key={i} className="chip" onClick={() => { setInput(q); taRef.current?.focus() }}>{q}</button>)}
          </div>
          <div className="chat-row">
            <textarea ref={taRef} className="chat-ta" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask about your tenancy rights, rent, eviction, Ejari..." rows={1} />
            <button className="chat-send" onClick={send} disabled={loading || !input.trim()}>↑</button>
          </div>
        </div>
      </div>
    </>
  )
}
