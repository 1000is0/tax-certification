import React from 'react'
import { Box, Paper, Typography, Button } from '@mui/material'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>대시보드</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          인증서 상태를 관리하고, 자동화 작업을 시작하세요.
        </Typography>
        <Button variant="contained" component={Link} to="/credentials/new">
          인증서 등록
        </Button>
      </Paper>
    </Box>
  )
}



