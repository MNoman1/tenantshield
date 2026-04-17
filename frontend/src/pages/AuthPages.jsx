import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.email, form.password); navigate('/') }
    catch (err) { setError(err.response?.data?.error || 'Login failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-mark">🏠</div>
          <div><div className="auth-logo-text">TenantShield</div><div className="auth-logo-sub">UAE Property Management AI</div></div>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your encrypted workspace</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in →'}</button>
        </form>
        <p className="auth-link">No account? <Link to="/register">Register free</Link></p>
        <div style={{ marginTop: 16, padding: '9px 11px', background: 'var(--green-light)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--green-deeper)', display: 'flex', gap: 7 }}>
          <span>🔒</span><span>AES-256 encrypted — only you can read your data.</span>
        </div>
      </div>
    </div>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    if (!role) return setError('Please select your role')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 8) return setError('Password must be 8+ characters')
    setLoading(true)
    try { await register(form.name, form.email, form.password, role, form.phone); navigate('/') }
    catch (err) { setError(err.response?.data?.error || 'Registration failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-mark">🏠</div>
          <div><div className="auth-logo-text">TenantShield</div><div className="auth-logo-sub">UAE Property Management AI</div></div>
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Free — no credit card needed</p>
        {error && <div className="error-msg">{error}</div>}

        <div className="form-label" style={{ marginBottom: 6 }}>I am a...</div>
        <div className="role-selector">
          <div className={`role-opt ${role === 'landlord' ? 'selected' : ''}`} onClick={() => setRole('landlord')}>
            <span className="role-opt-icon">🏢</span>
            <div className="role-opt-label">Landlord</div>
            <div className="role-opt-desc">I own property</div>
          </div>
          <div className={`role-opt ${role === 'tenant' ? 'selected' : ''}`} onClick={() => setRole('tenant')}>
            <span className="role-opt-icon">🧑</span>
            <div className="role-opt-label">Tenant</div>
            <div className="role-opt-desc">I rent property</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" type="text" placeholder="Ahmed Al Mansouri" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input className="form-input" type="tel" placeholder="+971 50 123 4567" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm password</label>
            <input className="form-input" type="password" placeholder="Repeat password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account →'}</button>
        </form>
        <p className="auth-link">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  )
}
