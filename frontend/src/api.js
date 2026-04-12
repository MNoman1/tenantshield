import axios from 'axios'

// In production (Vercel), API calls go to Railway backend
// In development, Vite proxy handles /api -> localhost:4000
const baseURL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL,
})

// Keep Authorization header synced
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
    delete axios.defaults.headers.common['Authorization']
  }
}

export default api
