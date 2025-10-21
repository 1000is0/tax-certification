import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Link } from 'react-router-dom'
import { credentialService } from '../services/api'
import toast from 'react-hot-toast'

export default function CredentialPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [credentialToDelete, setCredentialToDelete] = useState(null)

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

  const handleDeleteConfirm = async () => {
    if (!credentialToDelete) return

    try {
      await credentialService.deleteCredential(credentialToDelete.id)
      toast.success('인증서가 삭제되었습니다.')
      setDeleteDialogOpen(false)
      setCredentialToDelete(null)
      fetchCredentials()
    } catch (err) {
      toast.error(err.response?.data?.error || '인증서 삭제에 실패했습니다.')
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setCredentialToDelete(null)
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
    </Box>
  )
}



