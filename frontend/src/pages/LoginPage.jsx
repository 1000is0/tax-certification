import React, { useState } from 'react'
import { Box, Paper, TextField, Button, Typography } from '@mui/material'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('로그인 성공')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || '로그인 실패')
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <Paper sx={{ p: 4, width: 420 }}>
        <Typography variant="h5" gutterBottom>로그인</Typography>
        <form onSubmit={onSubmit}>
          <TextField fullWidth label="이메일" margin="normal" value={email} onChange={e=>setEmail(e.target.value)} />
          <TextField fullWidth label="비밀번호" type="password" margin="normal" value={password} onChange={e=>setPassword(e.target.value)} />
          <Button fullWidth type="submit" variant="contained" disabled={isLoading} sx={{ mt: 2 }}>로그인</Button>
        </form>
        <Typography variant="body2" sx={{ mt: 2 }}>
          계정이 없으신가요? <Link to="/register">회원가입</Link>
        </Typography>
      </Paper>
    </Box>
  )
}



