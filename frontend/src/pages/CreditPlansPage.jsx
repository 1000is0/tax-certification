import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import StarIcon from '@mui/icons-material/Star'
import ContactMailIcon from '@mui/icons-material/ContactMail'
import { creditService, subscriptionService } from '../services/api'
import PaymentModal from '../components/PaymentModal'
import toast from 'react-hot-toast'

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function CreditPlansPage() {
  const [loading, setLoading] = useState(true)
  const [subscriptionPlans, setSubscriptionPlans] = useState([])
  const [oneTimeCredits, setOneTimeCredits] = useState([])
  const [currentSubscription, setCurrentSubscription] = useState(null)
  const [tabValue, setTabValue] = useState(0)
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' or 'yearly'
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentData, setPaymentData] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [plansData, subscriptionData] = await Promise.all([
        creditService.getPlans(),
        creditService.getMySubscription()
      ])
      
      setSubscriptionPlans(plansData.subscriptionPlans || [])
      setOneTimeCredits(plansData.oneTimeCredits || [])
      setCurrentSubscription(subscriptionData.subscription)
    } catch (err) {
      toast.error(err.response?.data?.error || '데이터를 가져오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue)
  }

  const handleSubscribe = async (plan) => {
    if (plan.isCustom) {
      // 엔터프라이즈는 문의하기
      toast.success('영업팀에 문의해주세요: contact@example.com')
      return
    }
    
    if (plan.tier === 'free') {
      toast.info('현재 무료 플랜을 사용 중입니다.')
      return
    }

    // 이미 구독 중인 경우 플랜 변경
    if (currentSubscription && currentSubscription.status === 'active') {
      try {
        const confirmed = window.confirm(
          `${plan.name} 플랜으로 변경하시겠습니까?\n\n남은 기간에 비례하여 크레딧이 지급됩니다.`
        )
        
        if (!confirmed) return
        
        const result = await subscriptionService.changeTier(plan.tier)
        toast.success(result.message || '플랜이 변경되었습니다!')
        fetchData() // 데이터 새로고침
      } catch (error) {
        toast.error(error.response?.data?.error || '플랜 변경에 실패했습니다.')
      }
      return
    }

    // 새로 구독하는 경우 결제 모달 열기
    setPaymentData({
      type: 'subscription',
      tier: plan.tier,
      amount: plan.price,
      orderName: `${plan.name} 구독`
    })
    setPaymentModalOpen(true)
  }

  const handlePurchaseCredits = (creditPack) => {
    // 결제 모달 열기
    setPaymentData({
      type: 'credit',
      creditPackId: creditPack.id,
      credits: creditPack.credits + (creditPack.bonus || 0),
      amount: creditPack.price,
      orderName: `크레딧 구매 (${creditPack.credits + (creditPack.bonus || 0)}개)`
    })
    setPaymentModalOpen(true)
  }

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false)
    toast.success('결제가 완료되었습니다!')
    // 데이터 새로고침
    fetchData()
  }

  const handlePaymentModalClose = () => {
    setPaymentModalOpen(false)
    setPaymentData(null)
  }

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '문의'
    if (price === 0) return '무료'
    return `₩${price.toLocaleString()}`
  }

  const formatCredits = (credits) => {
    if (credits === null || credits === undefined) return '무제한'
    return `${credits.toLocaleString()}`
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 헤더 */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" gutterBottom fontWeight="bold">
          크레딧 플랜
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          비즈니스에 맞는 최적의 플랜을 선택하세요
        </Typography>
        {currentSubscription && (
          <Chip 
            label={`현재 플랜: ${currentSubscription.tierName}`}
            color="primary"
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* 탭 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          centered
          variant="fullWidth"
        >
          <Tab label="구독 플랜" />
          <Tab label="크레딧 구매" />
        </Tabs>
      </Paper>

      {/* 구독 플랜 탭 */}
      <TabPanel value={tabValue} index={0}>
        {/* 월간/연간 토글 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <ToggleButtonGroup
            value={billingCycle}
            exclusive
            onChange={(e, newValue) => newValue && setBillingCycle(newValue)}
            color="primary"
            size="large"
          >
            <ToggleButton value="monthly" sx={{ px: 4, py: 1.5 }}>
              <Typography variant="body1" fontWeight="medium">
                월간 결제
              </Typography>
            </ToggleButton>
            <ToggleButton value="yearly" sx={{ px: 4, py: 1.5 }}>
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  연간 결제
                </Typography>
                <Chip 
                  label="10% 할인" 
                  size="small" 
                  color="success" 
                  sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                />
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Grid container spacing={3}>
          {subscriptionPlans
            .filter(plan => {
              // billingCycle에 따라 필터링
              if (plan.tier === 'free' || plan.tier === 'enterprise') return true
              if (billingCycle === 'yearly') {
                return plan.tier.endsWith('_yearly')
              } else {
                return !plan.tier.endsWith('_yearly')
              }
            })
            .map((plan) => {
            const isCurrentPlan = currentSubscription?.tier === plan.tier
            
            return (
              <Grid item xs={12} sm={6} md={plan.tier === 'enterprise' ? 12 : 4} key={plan.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: plan.popular ? '2px solid' : '1px solid',
                    borderColor: plan.popular ? 'primary.main' : 'divider',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    }
                  }}
                >
                  {plan.popular && (
                    <Chip
                      icon={<StarIcon />}
                      label="인기"
                      color="primary"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16
                      }}
                    />
                  )}
                  
                  <CardContent sx={{ flexGrow: 1, pt: 3 }}>
                    <Typography variant="h5" gutterBottom fontWeight="bold">
                      {plan.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                      {plan.description}
                    </Typography>

                    <Box sx={{ my: 3 }}>
                      <Typography variant="h3" component="div" fontWeight="bold">
                        {formatPrice(plan.price)}
                      </Typography>
                      {plan.price !== null && plan.price > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          / 월
                        </Typography>
                      )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                      월간 크레딧
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                      {formatCredits(plan.monthlyCredits)} 크레딧
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                      주요 기능
                    </Typography>
                    <List dense>
                      {plan.features.map((feature, idx) => (
                        <ListItem key={idx} disableGutters>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={feature}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0 }}>
                    {plan.isCustom ? (
                      <Button
                        variant="outlined"
                        fullWidth
                        size="large"
                        startIcon={<ContactMailIcon />}
                        onClick={() => handleSubscribe(plan)}
                      >
                        영업팀 문의
                      </Button>
                    ) : isCurrentPlan ? (
                      <Button
                        variant="outlined"
                        fullWidth
                        size="large"
                        disabled
                      >
                        현재 플랜
                      </Button>
                    ) : (
                      <Button
                        variant={plan.popular ? 'contained' : 'outlined'}
                        fullWidth
                        size="large"
                        onClick={() => handleSubscribe(plan)}
                      >
                        {plan.price === 0 ? '시작하기' : '구독하기'}
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      </TabPanel>

      {/* 크레딧 구매 탭 */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            일회성 크레딧 구매
          </Typography>
          <Typography variant="body2" color="text.secondary">
            필요한 만큼만 구매하세요. 만료일 없이 사용할 수 있습니다.
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center">
          {oneTimeCredits.map((pack) => (
            <Grid item xs={12} sm={6} md={3} key={pack.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: pack.popular ? '2px solid' : '1px solid',
                  borderColor: pack.popular ? 'secondary.main' : 'divider',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  }
                }}
              >
                {pack.popular && (
                  <Chip
                    icon={<StarIcon />}
                    label="추천"
                    color="secondary"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16
                    }}
                  />
                )}

                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight="bold" color="primary" sx={{ mb: 1 }}>
                    {pack.credits}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    크레딧
                  </Typography>

                  {pack.bonus > 0 && (
                    <Chip
                      label={`+${pack.bonus} 보너스`}
                      color="success"
                      size="small"
                      sx={{ mb: 2 }}
                    />
                  )}

                  <Typography variant="h5" fontWeight="bold" sx={{ mt: 2 }}>
                    {formatPrice(pack.price)}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {pack.description}
                  </Typography>

                  {pack.bonus > 0 && (
                    <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                      실제 {pack.credits + pack.bonus} 크레딧
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button
                    variant={pack.popular ? 'contained' : 'outlined'}
                    color={pack.popular ? 'secondary' : 'primary'}
                    fullWidth
                    size="large"
                    onClick={() => handlePurchaseCredits(pack)}
                  >
                    구매하기
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4, p: 3, bgcolor: 'info.light', borderRadius: 2 }}>
          <Typography variant="body2" color="info.dark">
            💡 <strong>Tip:</strong> 일회성 크레딧은 만료되지 않으며, 필요할 때마다 추가 구매할 수 있습니다. 
            자주 사용하시는 경우 구독 플랜이 더 경제적일 수 있습니다.
          </Typography>
        </Box>
      </TabPanel>

      {/* 결제 모달 */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={handlePaymentModalClose}
        paymentData={paymentData}
        onSuccess={handlePaymentSuccess}
      />
    </Container>
  )
}

