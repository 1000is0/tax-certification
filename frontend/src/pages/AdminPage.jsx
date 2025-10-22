import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Grid, Card, CardContent, TextField, Button, Divider, Autocomplete, CircularProgress } from '@mui/material'
import { adminService, creditService, authService } from '../services/api'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [stats, setStats] = useState(null)
  const [grantForm, setGrantForm] = useState({
    userEmail: '',
    userId: '',
    amount: '',
    description: ''
  })
  const [isGranting, setIsGranting] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchUsers()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await adminService.getCredentialStats()
      setStats(res)
    } catch (err) {
      toast.error(err.response?.data?.error || '통계를 가져오지 못했습니다.')
    }
  }

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await adminService.getAllUsers()
      setUsers(res.users || [])
    } catch (err) {
      toast.error(err.response?.data?.error || '사용자 목록을 가져오지 못했습니다.')
    } finally {
      setLoadingUsers(false)
    }
  }

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
      setGrantForm({ userEmail: '', userId: '', amount: '', description: '' })
      fetchUsers() // 사용자 목록 새로고침
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
            <Autocomplete
              options={users}
              getOptionLabel={(option) => `${option.email} (${option.name}) - 잔액: ${option.creditBalance || 0} 크레딧`}
              filterOptions={(options, state) => {
                const inputValue = state.inputValue.toLowerCase()
                return options.filter(option => 
                  option.email.toLowerCase().includes(inputValue) ||
                  option.name.toLowerCase().includes(inputValue)
                )
              }}
              loading={loadingUsers}
              value={users.find(u => u.id === grantForm.userId) || null}
              onChange={(event, newValue) => {
                setGrantForm({ 
                  ...grantForm, 
                  userId: newValue?.id || '',
                  userEmail: newValue?.email || ''
                })
              }}
              noOptionsText="검색 결과가 없습니다."
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="사용자 검색 (이메일 또는 이름)"
                  placeholder="사용자를 선택하세요"
                  helperText="이메일이나 이름으로 검색하여 선택하세요"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="크레딧 수량"
              placeholder="100 (음수 입력 시 차감)"
              value={grantForm.amount}
              onChange={(e) => setGrantForm({ ...grantForm, amount: e.target.value })}
              helperText="양수: 지급, 음수: 차감"
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
              disabled={isGranting || !grantForm.userId}
              fullWidth
            >
              {isGranting ? '처리 중...' : '크레딧 지급/차감'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}



