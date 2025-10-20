import React from 'react'
import { AppBar, Toolbar, Typography, Box, Container, Button } from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component={Link}
            to="/dashboard"
            sx={{ flexGrow: 1, color: '#fff', textDecoration: 'none' }}
          >
            세무사 자동화
          </Typography>
          {user ? (
            <>
              <Button color="inherit" component={Link} to="/credentials">인증서</Button>
              {user.role === 'admin' && (
                <Button color="inherit" component={Link} to="/admin">관리</Button>
              )}
              <Button color="inherit" onClick={handleLogout}>로그아웃</Button>
            </>
          ) : (
            <>
              <Button color="inherit" component={Link} to="/login">로그인</Button>
              <Button color="inherit" component={Link} to="/register">회원가입</Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {children}
      </Container>
    </Box>
  )
}



