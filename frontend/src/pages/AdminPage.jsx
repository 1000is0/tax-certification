import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Grid, Card, CardContent, TextField, Button, Divider } from '@mui/material'
import { adminService, creditService } from '../services/api'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [stats, setStats] = useState(null)
  const [grantForm, setGrantForm] = useState({
    userId: '',
    amount: '',
    description: ''
  })
  const [isGranting, setIsGranting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await adminService.getCredentialStats()
        setStats(res)
      } catch (err) {
        toast.error(err.response?.data?.error || '통계를 가져오지 못했습니다.')
      }
    })()
  }, [])

  const handleGrantCredit = async () => {
    if (!grantForm.userId || !grantForm.amount || !grantForm.description) {
      toast.error('모든 필드를 입력해주세요.')
      return
    }

    if (isNaN(grantForm.amount) || parseInt(grantForm.amount) <= 0) {
      toast.error('유효한 크레딧 수량을 입력해주세요.')
      return
    }

    setIsGranting(true)

    try {
      await adminService.grantCredits({
        userId: grantForm.userId,
        amount: parseInt(grantForm.amount),
        description: grantForm.description
      })

      toast.success('크레딧이 지급되었습니다.')
      setGrantForm({ userId: '', amount: '', description: '' })
    } catch (err) {
      toast.error(err.response?.data?.error || '크레딧 지급에 실패했습니다.')
    } finally {
      setIsGranting(false)
    }
  }

  return (
    <Box>
      {/* 통계 섹션 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>관리자 통계</Typography>
        {stats && (
          <Grid container spacing={2}>
            {Object.entries(stats).map(([k, v]) => (
              <Grid item xs={12} sm={6} md={3} key={k}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">{k}</Typography>
                    <Typography variant="h5">{String(v)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* 크레딧 지급 섹션 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>크레딧 지급</Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="사용자 ID"
              placeholder="dcf08ba6-13bf-4bd5-8891-09ee5e1422cb"
              value={grantForm.userId}
              onChange={(e) => setGrantForm({ ...grantForm, userId: e.target.value })}
              helperText="크레딧을 지급할 사용자의 ID를 입력하세요"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="크레딧 수량"
              placeholder="100"
              value={grantForm.amount}
              onChange={(e) => setGrantForm({ ...grantForm, amount: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="지급 사유"
              placeholder="테스트 크레딧 지급"
              value={grantForm.description}
              onChange={(e) => setGrantForm({ ...grantForm, description: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleGrantCredit}
              disabled={isGranting}
              fullWidth
            >
              {isGranting ? '지급 중...' : '크레딧 지급'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}



