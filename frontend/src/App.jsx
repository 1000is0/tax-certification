import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CredentialPage from './pages/CredentialPage'
import CredentialFormPage from './pages/CredentialFormPage'
import AdminPage from './pages/AdminPage'

function App() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Routes>
        {/* 공개 라우트 */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
        />
        <Route 
          path="/register" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} 
        />
        
        {/* 보호된 라우트 */}
        <Route 
          path="/*" 
          element={
            isAuthenticated ? (
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/credentials" element={<CredentialPage />} />
                  <Route path="/credentials/new" element={<CredentialFormPage />} />
                  <Route path="/credentials/:id/edit" element={<CredentialFormPage />} />
                  {user?.role === 'admin' && (
                    <Route path="/admin" element={<AdminPage />} />
                  )}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Box>
  )
}

export default App
