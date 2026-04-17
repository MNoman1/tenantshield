import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import PropertiesPage from './pages/PropertiesPage'
import UnitsPage from './pages/UnitsPage'
import TenanciesPage from './pages/TenanciesPage'
import ChequesPage from './pages/ChequesPage'
import MessagesPage from './pages/MessagesPage'
import DocumentsPage from './pages/DocumentsPage'
import MaintenancePage from './pages/MaintenancePage'
import ChatPage from './pages/ChatPage'
import DraftsPage from './pages/DraftsPage'
import CalculatorPage from './pages/CalculatorPage'
import './index.css'

function Guard({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<DashboardPage />} />
            <Route path="properties" element={<PropertiesPage />} />
            <Route path="units" element={<UnitsPage />} />
            <Route path="tenancies" element={<TenanciesPage />} />
            <Route path="cheques" element={<ChequesPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="drafts" element={<DraftsPage />} />
            <Route path="calculator" element={<CalculatorPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
