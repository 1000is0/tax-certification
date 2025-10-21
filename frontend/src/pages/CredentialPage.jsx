import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField } from '@mui/material'
import { Link } from 'react-router-dom'
import { credentialService, authService } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function CredentialPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [credentialToDelete, setCredentialToDelete] = useState(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const { user } = useAuthStore()

  const fetchCredentials = async () => {
    try {
      const res = await credentialService.getCredentials()
      setList(res.credentials || [])
    } catch (err) {
      toast.error(err.response?.data?.error || '인증서 목록을 가져오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCredentials()
  }, [])

  const handleDeleteClick = (credential) => {
    setCredentialToDelete(credential)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    // 첫 번째 확인 후 비밀번호 입력 다이얼로그로 이동
    setDeleteDialogOpen(false)
    setPasswordDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setCredentialToDelete(null)
  }

  const handlePasswordConfirm = async () => {
    if (!passwordInput) {
      setPasswordError('비밀번호를 입력해주세요.')
      return
    }

    try {
      const credentialId = credentialToDelete.id
      
      // 비밀번호 검증
      await authService.verifyPassword(passwordInput)
      
      // 비밀번호가 맞으면 인증서 삭제
      await credentialService.deleteCredential(credentialId)
      
      // 상태 초기화 (먼저 다이얼로그를 닫고 상태를 정리)
      setPasswordDialogOpen(false)
      setCredentialToDelete(null)
      setPasswordInput('')
      setPasswordError('')
      
      // UI에서 삭제된 항목 제거 (API 재조회 없이)
      setList(prevList => prevList.filter(item => item.id !== credentialId))
      
      // 성공 메시지는 마지막에 표시
      toast.success('인증서가 삭제되었습니다.')
    } catch (err) {
      if (err.response?.status === 401 || err.response?.data?.code === 'INVALID_PASSWORD') {
        setPasswordError('비밀번호가 올바르지 않습니다.')
      } else {
        toast.error(err.response?.data?.error || '인증서 삭제에 실패했습니다.')
        setPasswordDialogOpen(false)
        setCredentialToDelete(null)
        setPasswordInput('')
        setPasswordError('')
      }
    }
  }

  const handlePasswordCancel = () => {
    setPasswordDialogOpen(false)
    setCredentialToDelete(null)
    setPasswordInput('')
    setPasswordError('')
  }

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">인증서 목록</Typography>
          {list.length === 0 && !loading && (
            <Button variant="contained" component={Link} to="/credentials/new">새 인증서</Button>
          )}
        </Box>
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>사업자등록번호</TableCell>
              <TableCell>상호</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>인증서 삭제</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.clientId}</TableCell>
                <TableCell>{item.certName}</TableCell>
                <TableCell>{item.isActive ? '활성' : '비활성'}</TableCell>
                <TableCell>
                  <Button 
                    size="small" 
                    color="error" 
                    variant="outlined"
                    onClick={() => handleDeleteClick(item)}
                  >
                    삭제
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">데이터가 없습니다.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>인증서 삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText>
            인증서 삭제는 취소가 불가능합니다. 정말로 삭제하시겠습니까?
          </DialogContentText>
          {credentialToDelete && (
            <DialogContentText sx={{ mt: 2, fontWeight: 'bold' }}>
              상호: {credentialToDelete.certName}
              <br />
              사업자등록번호: {credentialToDelete.clientId}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            아니오
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            예, 삭제합니다
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={passwordDialogOpen} onClose={handlePasswordCancel}>
        <DialogTitle>비밀번호 확인</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            계속하려면 로그인 비밀번호를 입력하세요.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="로그인 비밀번호"
            type="password"
            fullWidth
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value)
              setPasswordError('')
            }}
            error={!!passwordError}
            helperText={passwordError}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePasswordConfirm()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePasswordCancel} color="primary">
            취소
          </Button>
          <Button onClick={handlePasswordConfirm} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}



