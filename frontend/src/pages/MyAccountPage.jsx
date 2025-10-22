import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
  IconButton,
  InputAdornment
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { userService } from '../services/api'
import toast from 'react-hot-toast'

export default function MyAccountPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState({
    email: '',
    name: '',
    phone: ''
  })

  // 프로필 수정 모드
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: ''
  })

  // 비밀번호 변경
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await userService.getProfile()
      setProfile(res.user)
      setEditForm({
        name: res.user.name,
        phone: res.user.phone
      })
    } catch (err) {
      toast.error(err.response?.data?.error || '프로필을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!editForm.name || !editForm.phone) {
      toast.error('이름과 휴대폰 번호를 모두 입력해주세요.')
      return
    }

    try {
      await userService.updateProfile(editForm)
      toast.success('프로필이 업데이트되었습니다.')
      setEditing(false)
      fetchProfile()
    } catch (err) {
      toast.error(err.response?.data?.error || '프로필 업데이트에 실패했습니다.')
    }
  }

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('모든 비밀번호 필드를 입력해주세요.')
      return
    }

    if (newPassword.length < 8) {
      toast.error('새 비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('새 비밀번호가 일치하지 않습니다.')
      return
    }

    try {
      await userService.changePassword({
        currentPassword,
        newPassword
      })
      toast.success('비밀번호가 변경되었습니다.')
      setChangingPassword(false)
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (err) {
      toast.error(err.response?.data?.error || '비밀번호 변경에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>로딩 중...</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        내 계정
      </Typography>

      {/* 프로필 정보 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          프로필 정보
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="이메일"
              value={profile.email}
              disabled
              helperText="이메일은 변경할 수 없습니다."
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="이름"
              value={editing ? editForm.name : profile.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              disabled={!editing}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="휴대폰 번호"
              value={editing ? editForm.phone : profile.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              disabled={!editing}
              placeholder="010-1234-5678"
            />
          </Grid>
          <Grid item xs={12}>
            {editing ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleUpdateProfile}
                >
                  저장
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditing(false)
                    setEditForm({
                      name: profile.name,
                      phone: profile.phone
                    })
                  }}
                >
                  취소
                </Button>
              </Box>
            ) : (
              <Button
                variant="contained"
                onClick={() => setEditing(true)}
              >
                정보 수정
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* 비밀번호 변경 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          비밀번호 변경
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {!changingPassword ? (
          <Button
            variant="outlined"
            onClick={() => setChangingPassword(true)}
          >
            비밀번호 변경
          </Button>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                비밀번호는 최소 8자 이상이어야 합니다.
              </Alert>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type={showPasswords.current ? 'text' : 'password'}
                label="현재 비밀번호"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        edge="end"
                      >
                        {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type={showPasswords.new ? 'text' : 'password'}
                label="새 비밀번호"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        edge="end"
                      >
                        {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type={showPasswords.confirm ? 'text' : 'password'}
                label="새 비밀번호 확인"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        edge="end"
                      >
                        {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleChangePassword}
                >
                  비밀번호 변경
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setChangingPassword(false)
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    })
                  }}
                >
                  취소
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}
      </Paper>
    </Container>
  )
}

