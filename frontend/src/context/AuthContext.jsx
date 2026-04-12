import { createContext, useContext, useState, useEffect } from 'react'
import api, { setAuthToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('uae_token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      setAuthToken(token)
      api.get('/api/auth/me')
        .then(r => setUser(r.data))
        .catch(() => logout())
        .finally(() => setLoading(false))
    } else {
      setAuthToken(null)
      setLoading(false)
    }
  }, [token])

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('uae_token', data.token)
    setAuthToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const register = async (name, email, password) => {
    const { data } = await api.post('/api/auth/register', { name, email, password })
    localStorage.setItem('uae_token', data.token)
    setAuthToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('uae_token')
    setAuthToken(null)
    setToken(null)
    setUser(null)
  }

  const updateEmirate = async (emirate) => {
    await api.patch('/api/auth/emirate', { emirate })
    setUser(u => ({ ...u, emirate }))
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout, updateEmirate }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
