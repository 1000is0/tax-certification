import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography, Grid, Card, CardContent } from '@mui/material'
import { adminService } from '../services/api'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [stats, setStats] = useState(null)

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

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
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
    </Box>
  )
}



