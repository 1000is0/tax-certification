import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material'
import { paymentService } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function PaymentModal({ open, onClose, paymentData, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { user } = useAuthStore()

  const { type, amount, orderName, credits, tier, newTier } = paymentData || {}

  /**
   * 나이스페이 결제창 호출
   */
  const handlePayment = async () => {
    try {
      setLoading(true)
      setError(null)

      // 결제 준비 API 호출
      let prepareResult
      if (type === 'credit') {
        prepareResult = await paymentService.prepareCreditPayment({
          creditPackId: paymentData.creditPackId,
          credits,
          price: amount
        })
      } else if (type === 'subscription') {
        prepareResult = await paymentService.prepareSubscriptionPayment({
          tier
        })
      } else if (type === 'tier_upgrade') {
        prepareResult = await paymentService.prepareTierUpgradePayment(newTier)
      }

      const { orderId, clientToken, clientId, returnUrl } = prepareResult

      // 나이스페이 SDK가 로드되었는지 확인
      if (typeof AUTHNICE === 'undefined') {
        throw new Error('결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.')
      }

      // 구매자 정보 준비
      const buyerInfo = {
        buyerName: user?.name || '미입력',
        buyerTel: user?.phone ? user.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '000-0000-0000',
        buyerEmail: user?.email || ''
      }
      
      console.log('구매자 정보:', buyerInfo)
      console.log('사용자 정보:', user)

      // 나이스페이 결제창 호출
      AUTHNICE.requestPay({
        clientId, // 가맹점 식별 코드
        method: 'card', // 카드 결제만 허용
        orderId,
        amount,
        goodsName: orderName,
        returnUrl, // 백엔드에서 전달받은 returnUrl 사용
        // 구매자 정보 추가 (나이스페이 JS SDK에서 직접 전달)
        ...buyerInfo,
        fnSuccess: (result) => {
          // 결제 성공 시 콜백
          // returnUrl로 이미 처리되므로 여기서는 로그만 남김
          console.log('결제 성공 callback:', result)
          // 결제창이 닫히고 원래 페이지로 돌아옴
          // 실제 승인 처리는 returnUrl(백엔드)에서 처리됨
        },
        fnError: (result) => {
          console.error('결제 오류:', result)
          setError(result.errorMsg || '결제 중 오류가 발생했습니다.')
          setLoading(false)
        }
      })

      // 결제창이 열리면 모달 닫기
      onClose()

    } catch (err) {
      console.error('결제 준비 실패:', err)
      setError(err.response?.data?.error || err.message || '결제 준비 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '₩0'
    return `₩${price.toLocaleString()}`
  }

  return (
    <Dialog 
      open={open} 
      onClose={!loading ? onClose : undefined}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        결제 확인
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ py: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            상품명
          </Typography>
          <Typography variant="h6" gutterBottom>
            {orderName}
          </Typography>

          {type === 'credit' && credits && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                크레딧
              </Typography>
              <Typography variant="h6" gutterBottom>
                {(credits || 0).toLocaleString()} 크레딧
              </Typography>
            </>
          )}

          {type === 'subscription' && tier && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                구독 플랜
              </Typography>
              <Typography variant="h6" gutterBottom>
                {tier}
              </Typography>
            </>
          )}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              결제 금액
            </Typography>
            <Typography variant="h5" color="primary" fontWeight="bold">
              {formatPrice(amount)}
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            결제 버튼을 클릭하면 나이스페이 결제창이 열립니다.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          color="inherit"
        >
          취소
        </Button>
        <Button
          onClick={handlePayment}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? '준비 중...' : '결제하기'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

