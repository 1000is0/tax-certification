import React, { useState } from 'react'
import { Box, Paper, TextField, Button, Typography, Grid, Divider, FormHelperText, IconButton, InputAdornment } from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { credentialService } from '../services/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser, isLoading } = useAuthStore()

  // Step control
  const [step, setStep] = useState(1)

  // Step 1 fields (계정 생성)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // 에러 상태
  const [errors, setErrors] = useState({})
  
  // 포커스 상태 (툴팁 표시용)
  const [focused, setFocused] = useState({})
  
  // 비밀번호 표시/숨기기
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 유효성 검사 함수들
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
    
    if (!confirmPassword) {
      newErrors.confirmPassword = '비밀번호 확인을 입력해주세요.'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Step 2 fields (사업자/인증서)
  const [businessName, setBusinessName] = useState('') // 상호
  const [clientId, setClientId] = useState('')         // 사업자등록번호 (10자리 숫자)
  const [certData, setCertData] = useState('')         // 인증서 PEM
  const [privateKey, setPrivateKey] = useState('')     // 개인키 PEM
  const [certPassword, setCertPassword] = useState('') // 인증서 비밀번호

  const onSubmitStep1 = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    try {
      // name은 이메일의 @ 앞부분을 사용
      await registerUser({ email, password, name: email.split('@')[0] })
      setStep(2)
    } catch (err) {
      const errorMessage = err.response?.data?.error || '회원가입 실패'
      
      // 중복 이메일 에러를 입력란 하단에 표시
      if (errorMessage.includes('이메일') || errorMessage.includes('email')) {
        setErrors({ ...errors, email: '이미 사용중인 이메일입니다.' })
      } else {
        toast.error(errorMessage)
      }
    }
  }

  const onSubmitStep2 = async (e) => {
    e.preventDefault()
    if (!businessName || !/^\d{10}$/.test(clientId)) {
      toast.error('상호와 10자리 사업자등록번호를 확인해주세요.')
      return
    }
    if (!certData || !privateKey || !certPassword) {
      toast.error('인증서/개인키/인증서 비밀번호를 모두 입력해주세요.')
      return
    }
    try {
      // 인증서 등록 (사용자 비밀번호로 암호화)
      await credentialService.createCredential({
        clientId,
        certData,
        privateKey,
        certPassword,
        userPassword: password, // 계정 비밀번호로 암호화
        certName: businessName,
        certType: 'business'
      })
      toast.success('회원가입이 완료되었습니다.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || '인증서 저장에 실패했습니다.')
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: 740 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>회원가입</Typography>

        {step === 1 && (
          <form onSubmit={onSubmitStep1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
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
                    올바른 이메일 형식으로 입력해주세요. (예: user@example.com)
                  </FormHelperText>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  fullWidth 
                  label="비밀번호" 
                  type={showPassword ? "text" : "password"}
                  value={password} 
                  onChange={e=>setPassword(e.target.value)}
                  onFocus={()=>setFocused({...focused, password: true})}
                  onBlur={()=>setFocused({...focused, password: false})}
                  error={!!errors.password}
                  helperText={errors.password}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                {(focused.password || password) && !errors.password && (
                  <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                    최소 8자 이상의 비밀번호를 입력해주세요.
                  </FormHelperText>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  fullWidth 
                  label="비밀번호 확인" 
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword} 
                  onChange={e=>setConfirmPassword(e.target.value)}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" disabled={isLoading}>회원가입</Button>
                <Typography variant="body2" sx={{ mt: 2 }}>
                  이미 계정이 있으신가요? <Link to="/login">로그인</Link>
                </Typography>
              </Grid>
            </Grid>
          </form>
        )}

        {step === 2 && (
          <>
            <Divider sx={{ my: 2 }} />
            <form onSubmit={onSubmitStep2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="상호" value={businessName} onChange={e=>setBusinessName(e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="사업자등록번호" placeholder="1234567890" value={clientId} inputProps={{ maxLength: 10 }} onChange={e=>setClientId(e.target.value.replace(/[^0-9]/g,''))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={5} label="인증서 (PEM)" placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----" value={certData} onChange={e=>setCertData(e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={5} label="개인키 (PEM)" placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" value={privateKey} onChange={e=>setPrivateKey(e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="인증서 비밀번호" type="password" value={certPassword} onChange={e=>setCertPassword(e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" onClick={()=>setStep(1)}>이전</Button>
                    <Button type="submit" variant="contained">회원가입</Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </>
        )}
      </Paper>
    </Box>
  )
}



