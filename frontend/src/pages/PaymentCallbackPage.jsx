import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Container, Typography, CircularProgress, Button, Paper } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { paymentService } from '../services/api'
import toast from 'react-hot-toast'

export default function PaymentCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing') // processing, success, error
  const [message, setMessage] = useState('결제를 처리 중입니다...')

  useEffect(() => {
    processPayment()
  }, [])

  const processPayment = async () => {
    try {
      // 나이스페이에서 전달한 파라미터 추출
      const orderId = searchParams.get('orderId')
      const tid = searchParams.get('tid')
      const amount = searchParams.get('amount')
      const resultCode = searchParams.get('resultCode')
      const resultMsg = searchParams.get('resultMsg')

      // 결제 실패 처리
      if (resultCode !== '0000') {
        setStatus('error')
        setMessage(resultMsg || '결제에 실패했습니다.')
        toast.error(resultMsg || '결제에 실패했습니다.')
        return
      }

      // 필수 파라미터 확인
      if (!orderId || !tid || !amount) {
        setStatus('error')
        setMessage('결제 정보가 올바르지 않습니다.')
        toast.error('결제 정보가 올바르지 않습니다.')
        return
      }

      // 결제 승인 API 호출
      const approveResult = await paymentService.approvePayment({
        orderId,
        tid,
        amount: parseInt(amount)
      })

      if (approveResult.success) {
        setStatus('success')
        setMessage(approveResult.message || '결제가 완료되었습니다!')
        toast.success(approveResult.message || '결제가 완료되었습니다!')
      } else {
        setStatus('error')
        setMessage(approveResult.error || '결제 승인에 실패했습니다.')
        toast.error(approveResult.error || '결제 승인에 실패했습니다.')
      }
    } catch (error) {
      console.error('결제 처리 오류:', error)
      setStatus('error')
      setMessage(error.response?.data?.error || '결제 처리 중 오류가 발생했습니다.')
      toast.error(error.response?.data?.error || '결제 처리 중 오류가 발생했습니다.')
    }
  }

  const handleGoToPlans = () => {
    navigate('/credits/plans')
  }

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        {status === 'processing' && (
          <>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" gutterBottom>
              결제 처리 중
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {message}
            </Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircleIcon 
              sx={{ fontSize: 80, color: 'success.main', mb: 2 }} 
            />
            <Typography variant="h4" gutterBottom fontWeight="bold" color="success.main">
              결제 완료!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {message}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={handleGoToPlans}
              >
                플랜 보기
              </Button>
              <Button
                variant="contained"
                onClick={handleGoToDashboard}
              >
                대시보드로
              </Button>
            </Box>
          </>
        )}

        {status === 'error' && (
          <>
            <ErrorIcon 
              sx={{ fontSize: 80, color: 'error.main', mb: 2 }} 
            />
            <Typography variant="h4" gutterBottom fontWeight="bold" color="error.main">
              결제 실패
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {message}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={handleGoToDashboard}
              >
                대시보드로
              </Button>
              <Button
                variant="contained"
                onClick={handleGoToPlans}
              >
                다시 시도
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Container>
  )
}

