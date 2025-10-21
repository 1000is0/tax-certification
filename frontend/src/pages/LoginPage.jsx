import React, { useState } from 'react'
import { Box, Paper, TextField, Button, Typography, FormHelperText } from '@mui/material'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [focused, setFocused] = useState({})

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePassword = (password) => {
    return password.length >= 8
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!email) {
      newErrors.email = '이메일을 입력해주세요.'
    } else if (!validateEmail(email)) {
      newErrors.email = '올바른 이메일 형식을 입력해주세요.'
    }
    
    if (!password) {
      newErrors.password = '비밀번호를 입력해주세요.'
    } else if (!validatePassword(password)) {
      newErrors.password = '비밀번호는 최소 8자 이상이어야 합니다.'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    try {
      await login(email, password)
      toast.success('로그인 성공')
      navigate('/dashboard')
    } catch (err) {
      const errorMessage = err.response?.data?.error || '로그인 실패'
      
      // 로그인 실패 시 이메일 또는 비밀번호 오류로 처리
      if (errorMessage.includes('이메일') || errorMessage.includes('email')) {
        setErrors({ ...errors, email: errorMessage })
      } else if (errorMessage.includes('비밀번호') || errorMessage.includes('password')) {
        setErrors({ ...errors, password: errorMessage })
      } else {
        setErrors({ email: '이메일 또는 비밀번호가 올바르지 않습니다.' })
      }
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: 420 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>로그인</Typography>
        <form onSubmit={onSubmit}>
          <Box sx={{ mb: 2 }}>
            <TextField 
              fullWidth 
              label="이메일" 
              value={email} 
              onChange={e=>setEmail(e.target.value)}
              onFocus={()=>setFocused({...focused, email: true})}
              onBlur={()=>setFocused({...focused, email: false})}
              error={!!errors.email}
              helperText={errors.email}
            />
            {(focused.email || email) && !errors.email && (
              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                올바른 이메일 형식으로 입력해주세요.
              </FormHelperText>
            )}
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <TextField 
              fullWidth 
              label="비밀번호" 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)}
              onFocus={()=>setFocused({...focused, password: true})}
              onBlur={()=>setFocused({...focused, password: false})}
              error={!!errors.password}
              helperText={errors.password}
            />
            {(focused.password || password) && !errors.password && (
              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                최소 8자 이상의 비밀번호를 입력해주세요.
              </FormHelperText>
            )}
          </Box>
          
          <Button fullWidth type="submit" variant="contained" disabled={isLoading} sx={{ mt: 2 }}>
            로그인
          </Button>
        </form>
        <Typography variant="body2" sx={{ mt: 2 }}>
          계정이 없으신가요? <Link to="/register">회원가입</Link>
        </Typography>
      </Paper>
    </Box>
  )
}



