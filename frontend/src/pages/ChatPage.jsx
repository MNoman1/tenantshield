import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const SYSTEM_PROMPT = `You are UAE Tenancy AI — a specialized expert assistant for UAE landlord-tenant law.

KEY LAWS:
- Dubai: RERA Rental Index governs increases. 0-10% below index = no increase. 11-20% below = max 5%. 21-30% = max 10%. 31-40% = max 15%. 40%+ below = max 20%. Governed by Law No. 26 of 2007 (amended Law 33 of 2008). 90-day written notice required for any rent change. Ejari registration mandatory. Disputes go to Rent Dispute Settlement Centre.
- Abu Dhabi: 5% rent cap per year. DMT (Dept of Municipalities and Transport) governs. Tawtheeq registration required. Disputes go to ADJD.
- Sharjah: 3-year rent freeze active through 2025 reforms. Sharjah Municipality governs.
- Ajman/RAK: Follow their own municipality rules; generally similar to Dubai framework.
- UAE-wide: Eviction for owner use = 12 months notice via notary public. Security deposit must be returned within 30 days of contract end minus documented damage. Service charges must be RERA-approved.

DOCUMENT DRAFTING: When asked to draft a letter or notice, produce a complete, properly formatted UAE-compliant document with:
- Date, From/To fields, Subject line
- Proper reference to applicable law/article
- Clear notice period
- Signature block
- Legal disclaimer

RESPONSE STYLE:
- Be specific and cite laws/article numbers where relevant
- Give clear YES/NO answers then explain
- Keep chat responses concise (under 200 words) unless drafting a document
- Use bullet points for lists
- For drafted documents, produce the full text
- Always end with: "⚠️ For official legal advice, consult a UAE-licensed legal professional or contact the relevant authority."
- If emirate not specified, ask before answering`

const QUICK_PROMPTS = [
  'Is my landlord\'s 15% rent increase legal in Dubai?',
  'My landlord gave 30 days to vacate — is that legal?',
  'Draft a 90-day rent increase notice letter',
  'How do I register on Ejari?',
  'What can my landlord deduct from my deposit?',
  'Draft a RERA complaint letter',
]

function formatContent(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

function timeStr(iso) {
  return new Date(iso).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [toast, setToast] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Load history from server (decrypted by backend using user's enc key)
  useEffect(() => {
    api.get('/api/messages').then(r => {
      const history = r.data.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        time: m.createdAt,
      }))
      setMessages(history)
      setHistoryLoaded(true)
    }).catch(() => setHistoryLoaded(true))
  }, [])

  // Handle prefill from dashboard
  useEffect(() => {
    if (!historyLoaded) return
    const prefill = sessionStorage.getItem('chat_prefill')
    if (prefill) {
      sessionStorage.removeItem('chat_prefill')
      setInput(prefill)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [historyLoaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { id: Date.now(), role: 'user', content: text, time: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Save user message (server encrypts before storing)
    api.post('/api/messages', { role: 'user', content: text, tool: 'chat' }).catch(() => {})

    // Build conversation for API
    const history = messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: text })

    try {
      const resp = await api.post('/api/chat', {
        system: SYSTEM_PROMPT + `\n\nUser's emirate: ${user?.emirate || 'Dubai'}`,
        messages: history,
      })

      const reply = resp.data.content?.map(c => c.text || '').join('') || 'Sorry, could not get a response.'
      const aiMsg = { id: Date.now() + 1, role: 'assistant', content: reply, time: new Date().toISOString() }
      setMessages(prev => [...prev, aiMsg])

      // Save AI message
      api.post('/api/messages', { role: 'assistant', content: reply, tool: 'chat' }).catch(() => {})

      // Log activity
      api.post('/api/activity', {
        type: 'chat',
        description: `Asked: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`,
        icon: '💬'
      }).catch(() => {})
    } catch (err) {
      const errMsg = err.response?.status === 401
        ? 'API authentication error. Check your API key in the backend.'
        : 'Network error. Please try again.'
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: errMsg, time: new Date().toISOString() }])
    }
    setLoading(false)
  }

  const saveAsDraft = async () => {
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAI) return showToast('No AI response to save yet', 'error')
    try {
      await api.post('/api/drafts', {
        title: `Chat draft — ${new Date().toLocaleDateString('en-AE')}`,
        content: lastAI.content,
        type: 'chat',
        emirate: user?.emirate || 'dubai'
      })
      await api.post('/api/activity', { type: 'draft_saved', description: 'Saved chat response as draft', icon: '📄' })
      showToast('Saved to drafts ✓')
    } catch { showToast('Failed to save', 'error') }
  }

  const clearHistory = async () => {
    if (!confirm('Clear all chat history?')) return
    await api.delete('/api/messages')
    setMessages([])
    showToast('Chat history cleared')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <div className="chat-page">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">AI Chat</div>
            <div className="page-sub">🔒 Encrypted history • {messages.filter(m => m.role === 'user').length} questions asked</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={saveAsDraft} style={{ padding: '7px 13px', fontSize: 12 }}>Save last response</button>
            <button className="btn-secondary" onClick={clearHistory} style={{ padding: '7px 13px', fontSize: 12, color: 'var(--red)' }}>Clear history</button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏠</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Your UAE Tenancy AI is ready</div>
              <div style={{ fontSize: 13 }}>Ask about rent increases, eviction rights, Ejari, RERA, or request a legal notice letter.</div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
              <div className={`chat-avatar ${msg.role === 'user' ? 'user' : 'ai'}`}>
                {msg.role === 'user' ? (user?.name?.[0] || 'U') : 'AI'}
              </div>
              <div>
                <div
                  className="chat-bubble"
                  dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                />
                <div className="chat-time">{timeStr(msg.time)}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-msg ai">
              <div className="chat-avatar ai">AI</div>
              <div><div className="chat-bubble"><div className="typing-dots"><span className="dot"/><span className="dot"/><span className="dot"/></div></div></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-quick-prompts">
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} className="qp" onClick={() => { setInput(p); textareaRef.current?.focus() }}>{p}</button>
            ))}
          </div>
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Ask about your tenancy rights, rent increases, eviction, Ejari, RERA..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <button className="save-chat-btn" onClick={saveAsDraft}>Save ↓</button>
            <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>↑</button>
          </div>
        </div>
      </div>
    </>
  )
}
