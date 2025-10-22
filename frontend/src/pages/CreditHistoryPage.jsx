import React, { useState, useEffect } from 'react'
import { 
  Box, 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  CircularProgress,
  TablePagination
} from '@mui/material'
import { creditService } from '../services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function CreditHistoryPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchData()
  }, [page, rowsPerPage])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [historyData, balanceData] = await Promise.all([
        creditService.getHistory({ 
          page: page + 1, // API는 1-based page
          limit: rowsPerPage
        }),
        creditService.getBalance()
      ])
      
      setTransactions(historyData.transactions || [])
      setTotalCount(historyData.totalCount || 0)
      setBalance(balanceData.balance)
    } catch (err) {
      toast.error(err.response?.data?.error || '데이터를 가져오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const getTypeLabel = (type) => {
    const typeMap = {
      'subscription_grant': '플랜 지급',
      'purchase': '추가 구매',
      'usage': '사용',
      'expiration': '만료',
      'refund': '환불',
      'admin_grant': '관리자 지급'
    }
    return typeMap[type] || type
  }

  const getTypeColor = (type) => {
    if (type === 'usage' || type === 'expiration') return 'error'
    if (type === 'refund') return 'warning'
    return 'success'
  }

  return (
    <Box>
      {/* 잔액 표시 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          현재 크레딧
        </Typography>
        <Typography variant="h3" color="primary">
          {balance.toLocaleString()} 크레딧
        </Typography>
      </Paper>

      {/* 거래 내역 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          크레딧 사용 내역
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>일시</TableCell>
                    <TableCell>유형</TableCell>
                    <TableCell>설명</TableCell>
                    <TableCell align="right">변동량</TableCell>
                    <TableCell align="right">잔액</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        거래 내역이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id} hover>
                        <TableCell>
                          {format(new Date(tx.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={getTypeLabel(tx.type)} 
                            color={getTypeColor(tx.type)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: tx.amount > 0 ? 'success.main' : 'error.main',
                            fontWeight: 'bold'
                          }}
                        >
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {tx.balanceAfter.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="페이지당 행 수:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 전체 ${count}`}
            />
          </>
        )}
      </Paper>
    </Box>
  )
}

