import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon,
  CreditCard as CreditCardIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { subscriptionService } from '../services/api'

function SubscriptionManagePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [reactivating, setReactivating] = useState(false)

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    try {
      setLoading(true)
      const data = await subscriptionService.getMySubscription()
      setSubscription(data.subscription)
    } catch (error) {
      console.error('구독 정보 조회 실패:', error)
      toast.error('구독 정보를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelClick = () => {
    setCancelDialogOpen(true)
  }

  const handleCancelConfirm = async () => {
    try {
      setCancelling(true)
      await subscriptionService.cancel(cancelReason)
      toast.success('구독이 취소되었습니다.')
      setCancelDialogOpen(false)
      setCancelReason('')
      fetchSubscription()
    } catch (error) {
      console.error('구독 취소 실패:', error)
      toast.error(error.response?.data?.error || '구독 취소에 실패했습니다.')
    } finally {
      setCancelling(false)
    }
  }

  const handleReactivate = async () => {
    try {
      const confirmed = window.confirm('구독을 재활성화하시겠습니까? 원래 일정대로 자동 결제가 진행됩니다.')
      if (!confirmed) return

      setReactivating(true)
      const result = await subscriptionService.reactivate()
      toast.success(result.message || '구독이 재활성화되었습니다.')
      fetchSubscription()
    } catch (error) {
      console.error('구독 재활성화 실패:', error)
      toast.error(error.response?.data?.error || '구독 재활성화에 실패했습니다.')
    } finally {
      setReactivating(false)
    }
  }

  const getStatusColor = (status) => {
    const colorMap = {
      active: 'success',
      suspended: 'warning',
      cancelled: 'default',
      expired: 'error'
    }
    return colorMap[status] || 'default'
  }

  const getStatusLabel = (status) => {
    const labelMap = {
      active: '활성',
      suspended: '일시정지',
      cancelled: '취소됨',
      expired: '만료됨'
    }
    return labelMap[status] || status
  }

  const getTierConfig = (tier) => {
    const tiers = {
      free: { name: '무료', color: 'default' },
      starter: { name: '스타터', color: 'primary' },
      professional: { name: '프로페셔널', color: 'secondary' },
      business: { name: '비즈니스', color: 'warning' },
      enterprise: { name: '엔터프라이즈', color: 'error' }
    }
    return tiers[tier] || { name: tier, color: 'default' }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    )
  }

  if (!subscription) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              활성화된 구독이 없습니다
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              구독 플랜을 선택하여 더 많은 크레딧과 혜택을 받으세요.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/credits/plans')}
            >
              구독 플랜 보기
            </Button>
          </CardContent>
        </Card>
      </Container>
    )
  }

  const tierConfig = getTierConfig(subscription.tier)

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          구독 관리
        </Typography>
        <Typography variant="body1" color="text.secondary">
          현재 구독 정보를 확인하고 관리할 수 있습니다.
        </Typography>
      </Box>

      {/* 구독 상태 카드 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">구독 정보</Typography>
            <Chip
              label={getStatusLabel(subscription.status)}
              color={getStatusColor(subscription.status)}
              size="small"
            />
          </Box>
          
          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                플랜
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Chip
                  label={tierConfig.name}
                  color={tierConfig.color}
                  size="medium"
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                월 크레딧
              </Typography>
              <Typography variant="h6">
                {subscription.monthlyCreditQuota?.toLocaleString() || 0} 크레딧
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                요금
              </Typography>
              <Typography variant="h6">
                {subscription.price === 0 ? '무료' : `₩${subscription.price?.toLocaleString()}`}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                다음 결제일
              </Typography>
              <Typography variant="h6">
                {subscription.status === 'active' ? formatDate(subscription.nextBillingDate) : '-'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                구독 시작일
              </Typography>
              <Typography variant="body1">
                {formatDate(subscription.billingCycleStart)}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                현재 주기 종료일
              </Typography>
              <Typography variant="body1">
                {formatDate(subscription.billingCycleEnd)}
              </Typography>
            </Grid>
          </Grid>

          {subscription.billingKey && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" icon={<CreditCardIcon />}>
                자동 결제가 등록되어 있습니다.
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 다운그레이드 예약 상태 표시 */}
      {subscription.status === 'active' && subscription.pendingTier && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            플랜 변경이 예약되었습니다
          </Typography>
          <Typography variant="caption">
            현재 플랜: {subscription.tier} → 다음 결제일부터: {subscription.pendingTier}
          </Typography>
        </Alert>
      )}

      {/* 구독 관리 액션 */}
      {subscription.status === 'active' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              구독 관리
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              구독을 변경하거나 취소할 수 있습니다.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="primary"
                  onClick={() => navigate('/credits/plans')}
                >
                  플랜 변경
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  onClick={handleCancelClick}
                >
                  구독 취소
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 일시정지/만료 안내 */}
      {subscription.status === 'suspended' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            구독이 일시정지되었습니다.
          </Typography>
          <Typography variant="caption">
            결제 실패로 인해 구독이 일시정지되었습니다. 결제 수단을 확인해주세요.
          </Typography>
        </Alert>
      )}

      {subscription.status === 'cancelled' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            구독이 취소되었습니다.
          </Typography>
          <Typography variant="caption">
            현재 주기가 끝나는 {formatDate(subscription.billingCycleEnd)}까지 서비스를 이용할 수 있습니다.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleReactivate}
              disabled={reactivating}
            >
              {reactivating ? <CircularProgress size={24} /> : '구독 재활성화'}
            </Button>
          </Box>
        </Alert>
      )}

      {subscription.status === 'expired' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            구독이 만료되었습니다.
          </Typography>
          <Typography variant="caption">
            새로운 구독을 시작하려면 아래 버튼을 클릭하세요.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/credits/plans')}
            >
              새 구독 시작
            </Button>
          </Box>
        </Alert>
      )}

      {/* 구독 취소 다이얼로그 */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => !cancelling && setCancelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>구독 취소</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            구독을 취소하시겠습니까? 현재 주기가 끝나는 {formatDate(subscription?.billingCycleEnd)}까지 서비스를 계속 이용할 수 있습니다.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="취소 사유 (선택)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="취소 사유를 입력해주세요"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
            닫기
          </Button>
          <Button
            onClick={handleCancelConfirm}
            color="error"
            variant="contained"
            disabled={cancelling}
          >
            {cancelling ? <CircularProgress size={24} /> : '구독 취소'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default SubscriptionManagePage

