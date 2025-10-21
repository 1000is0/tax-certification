import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { credentialService } from '../services/api'

export default function DashboardPage() {
  const [hasCredentials, setHasCredentials] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await credentialService.getCredentials()
        setHasCredentials(res.credentials && res.credentials.length > 0)
      } catch (err) {
        console.error('Failed to fetch credentials:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>대시보드</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          인증서 상태를 관리하고, 자동화 작업을 시작하세요.
        </Typography>
        {!loading && (
          <Button 
            variant="contained" 
            component={Link} 
            to={hasCredentials ? "/credentials" : "/credentials/new"}
          >
            {hasCredentials ? "내 인증서 보기" : "인증서 등록"}
          </Button>
        )}
      </Paper>
    </Box>
  )
}



