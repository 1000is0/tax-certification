import React, { useState, useEffect } from 'react'
import { AppBar, Toolbar, Typography, Box, Container, Button, Chip } from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { creditService } from '../services/api'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [creditBalance, setCreditBalance] = useState(null)
  const [tier, setTier] = useState('free')

  useEffect(() => {
    if (user) {
      fetchCreditBalance()
    }
  }, [user])

  const fetchCreditBalance = async () => {
    try {
      const data = await creditService.getBalance()
      setCreditBalance(data.balance)
      setTier(data.tier)
    } catch (error) {
      console.error('크레딧 조회 실패:', error)
    }
  }

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
            세무 업무 자동화
          </Typography>
          {user ? (
            <>
              {creditBalance !== null && (
                <Chip
                  icon={<AccountBalanceWalletIcon />}
                  label={`${creditBalance.toLocaleString()} 크레딧`}
                  color="secondary"
                  variant="outlined"
                  component={Link}
                  to="/credits/history"
                  clickable
                  sx={{ 
                    mr: 2, 
                    color: '#fff', 
                    borderColor: '#fff',
                    '& .MuiChip-icon': { color: '#fff' },
                    textDecoration: 'none',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                  }}
                />
              )}
              <Button color="inherit" component={Link} to="/credentials">내 인증서</Button>
              <Button color="inherit" component={Link} to="/credits/plans">크레딧 플랜</Button>
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



