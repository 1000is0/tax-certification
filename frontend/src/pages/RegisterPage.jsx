import React, { useState } from 'react'
import { Box, Paper, TextField, Button, Typography, Grid, Divider } from '@mui/material'
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
  const [userId, setUserId] = useState('') // 별도 ID가 필요하면 사용, 현재는 name 대체 가능

  // Step 2 fields (사업자/인증서)
  const [businessName, setBusinessName] = useState('') // 상호
  const [clientId, setClientId] = useState('')         // 사업자등록번호 (10자리 숫자)
  const [certData, setCertData] = useState('')         // 인증서 PEM
  const [privateKey, setPrivateKey] = useState('')     // 개인키 PEM
  const [certPassword, setCertPassword] = useState('') // 인증서 비밀번호

  const onSubmitStep1 = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력해주세요.')
      return
    }
    try {
      // name은 우선 사용자 ID로 채워두고, 사업자명은 2단계에서 별도 저장/사용
      await registerUser({ email, password, name: userId || email.split('@')[0] })
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.error || '회원가입 실패')
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
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <Paper sx={{ p: 4, width: 740 }}>
        <Typography variant="h5" gutterBottom>회원가입</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          1단계에서 계정 정보를 입력하고, 2단계에서 사업자/인증서 정보를 등록합니다.
        </Typography>

        {step === 1 && (
          <form onSubmit={onSubmitStep1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="ID (표시용)" placeholder="예: myid" value={userId} onChange={e=>setUserId(e.target.value)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="이메일" value={email} onChange={e=>setEmail(e.target.value)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="비밀번호" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" disabled={isLoading}>다음</Button>
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



