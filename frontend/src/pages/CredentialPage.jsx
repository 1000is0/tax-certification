import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material'
import { Link } from 'react-router-dom'
import { credentialService } from '../services/api'
import toast from 'react-hot-toast'

export default function CredentialPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await credentialService.getCredentials()
        setList(res.credentials || [])
      } catch (err) {
        toast.error(err.response?.data?.error || '인증서 목록을 가져오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">인증서 목록</Typography>
          <Button variant="contained" component={Link} to="/credentials/new">새 인증서</Button>
        </Box>
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>사업자등록번호</TableCell>
              <TableCell>인증서 이름</TableCell>
              <TableCell>타입</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>만료일</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.clientId}</TableCell>
                <TableCell>{item.certName}</TableCell>
                <TableCell>{item.certType}</TableCell>
                <TableCell>{item.isActive ? '활성' : '비활성'}</TableCell>
                <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '-'}</TableCell>
              </TableRow>
            ))}
            {!loading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}



