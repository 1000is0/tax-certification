import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import toast from 'react-hot-toast'
import { credentialService } from '../services/api'
import axios from 'axios'

const schema = yup.object({
  clientId: yup
    .string()
    .required('사업자등록번호는 필수입니다')
    .matches(/^[0-9]{10}$/, '사업자등록번호는 10자리 숫자여야 합니다'),
  certData: yup
    .string()
    .required('인증서 데이터는 필수입니다')
    .min(100, '유효한 인증서 데이터를 입력해주세요')
    .test('different-from-private-key', '인증서 데이터와 개인키는 같을 수 없습니다', function(value) {
      const { privateKey } = this.parent
      return !value || !privateKey || value.trim() !== privateKey.trim()
    }),
  privateKey: yup
    .string()
    .required('개인키는 필수입니다')
    .min(100, '유효한 개인키를 입력해주세요')
    .test('different-from-cert-data', '개인키와 인증서 데이터는 같을 수 없습니다', function(value) {
      const { certData } = this.parent
      return !value || !certData || value.trim() !== certData.trim()
    }),
  certPassword: yup
    .string()
    .required('인증서 비밀번호는 필수입니다')
    .min(10, '인증서 비밀번호는 최소 10자 이상이어야 합니다'),
  userPassword: yup
    .string()
    .required('사용자 비밀번호는 필수입니다')
    .min(8, '사용자 비밀번호는 최소 8자 이상이어야 합니다'),
  certName: yup
    .string()
    .required('상호는 필수입니다')
    .min(2, '상호는 최소 2자 이상이어야 합니다')
})

function CredentialFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState('') // 연결 테스트 에러 메시지
  const [testCompleted, setTestCompleted] = useState(false) // 연결 테스트 성공 여부
  const [focused, setFocused] = useState({})
  const [certDialogOpen, setCertDialogOpen] = useState(false)
  const [certList, setCertList] = useState([])
  const [selectedCert, setSelectedCert] = useState(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      clientId: '',
      certData: '',
      privateKey: '',
      certPassword: '',
      userPassword: '',
      certName: ''
    }
  })

  const watchedClientId = watch('clientId')

  const onSubmit = async (data) => {
    // 연결 테스트가 완료되지 않았으면 저장 불가
    if (!isEdit && !testCompleted) {
      toast.error('연결 테스트를 먼저 완료해주세요.')
      return
    }

    setIsLoading(true)
    try {
      if (isEdit) {
        await credentialService.updateCredential(id, data)
        toast.success('인증서 정보가 성공적으로 수정되었습니다.')
      } else {
        await credentialService.createCredential(data)
        toast.success('인증서 정보가 성공적으로 저장되었습니다.')
      }
      navigate('/credentials')
    } catch (error) {
      toast.error(error.response?.data?.error || '오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    const formData = watch()
    if (!formData.clientId || !formData.certData || !formData.privateKey || !formData.certPassword) {
      setTestError('사업자등록번호, 인증서 데이터, 개인키, 인증서 비밀번호를 모두 입력해주세요.')
      return
    }

    setIsLoading(true)
    setTestError('') // 이전 에러 메시지 초기화
    setTestResult(null) // 이전 결과 초기화
    
    try {
      const result = await credentialService.testConnection({
        clientId: formData.clientId,
        certData: formData.certData,
        privateKey: formData.privateKey,
        certPassword: formData.certPassword
      })
      setTestResult(result)
      if (result.isValidConnection) {
        setTestCompleted(true) // 연결 테스트 성공 표시
        toast.success('연결 테스트에 성공했습니다.')
      }
    } catch (error) {
      // 모든 에러 메시지를 버튼 하단에 표시 (toast 팝업 제거)
      setTestCompleted(false)
      
      // 상세한 에러 메시지 생성
      const errorData = error.response?.data
      let errorMessage = '연결 테스트 중 오류가 발생했습니다.'
      
      if (errorData) {
        // API에서 받은 에러 메시지 (백엔드에서 이미 errMsg를 error 필드에 담아 보냄)
        if (errorData.error) {
          errorMessage = errorData.error
        }
      }
      
      setTestError(errorMessage)
      setTestResult({ isValidConnection: false })
    } finally {
      setIsLoading(false)
    }
  }

  // NX2 인증서 추출 함수
  const handleExtractCert = async () => {
    try {
      // NX2 모듈 설치 여부 확인
      console.log('NX2 연결 시도 중...')
      const response = await axios.post('https://127.0.0.1:16566/', {
        op: 'certlist'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000
      })
      
      console.log('NX2 응답:', response.data)
      
      // NX2 응답 확인
      if (response.data.errYn === 'N' && response.data.certList) {
        setCertList(response.data.certList)
        setCertDialogOpen(true)
        toast.success('인증서 목록을 불러왔습니다.')
      } else if (response.data.errYn === 'Y') {
        toast.error(`NX2 오류: ${response.data.errMsg || '알 수 없는 오류'}`)
      } else {
        toast.error('인증서 목록을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('NX2 연결 오류:', error)
      // NX2 모듈이 설치되어 있지 않으면 설치 파일 다운로드
      // OS 감지
      const userAgent = window.navigator.userAgent
      const platform = window.navigator.platform
      const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K']
      const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE']
      
      let downloadUrl = ''
      let fileName = ''
      
      if (macosPlatforms.indexOf(platform) !== -1) {
        // macOS
        downloadUrl = '/ExAdapter_Web_Setup.pkg'
        fileName = 'ExAdapter_Web_Setup.pkg'
      } else if (windowsPlatforms.indexOf(platform) !== -1) {
        // Windows
        downloadUrl = '/ExAdapter_Web_Setup.exe'
        fileName = 'ExAdapter_Web_Setup.exe'
      } else {
        // 기타 OS
        toast.error('지원하지 않는 운영체제입니다. Windows 또는 macOS에서 사용해주세요.')
        return
      }
      
      // 설치 파일 다운로드
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('설치 파일 다운로드를 시작합니다. 설치 완료 후 브라우저를 재시작하고 이 버튼을 다시 클릭해주세요.', {
        duration: 6000
      })
    }
  }

  const handleCertSelect = (cert) => {
    setSelectedCert(cert)
  }

  const handleCertConfirm = () => {
    if (selectedCert) {
      // 인증서 데이터를 폼에 입력
      setValue('certData', selectedCert.signCert || '')
      setValue('privateKey', selectedCert.signPri || '')
      setCertDialogOpen(false)
      toast.success('인증서 정보가 입력되었습니다.')
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isEdit ? '인증서 정보 수정' : '인증서 정보 등록'}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          홈택스 연동을 위한 인증서 정보를 안전하게 저장합니다. 모든 민감한 정보는 암호화되어 저장됩니다.
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* 기본 정보 */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    기본 정보
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="certName"
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              label="상호"
                              placeholder="소나무세무그룹"
                              fullWidth
                              disabled={testCompleted}
                              error={!!errors.certName}
                              helperText={errors.certName?.message}
                              onFocus={() => setFocused({ ...focused, certName: true })}
                              onBlur={() => setFocused({ ...focused, certName: false })}
                            />
                            {(focused.certName || field.value) && !errors.certName && (
                              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                                사업자등록증에 표시된 상호를 정확히 입력하세요
                              </FormHelperText>
                            )}
                          </Box>
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="clientId"
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              label="사업자등록번호"
                              placeholder="1234567890"
                              fullWidth
                              disabled={testCompleted}
                              error={!!errors.clientId}
                              helperText={errors.clientId?.message}
                              inputProps={{ maxLength: 10 }}
                              onFocus={() => setFocused({ ...focused, clientId: true })}
                              onBlur={() => setFocused({ ...focused, clientId: false })}
                              onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                            {(focused.clientId || field.value) && !errors.clientId && (
                              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                                숫자만 입력하세요
                              </FormHelperText>
                            )}
                          </Box>
                        )}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 인증서 정보 */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6">
                      인증서 정보
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleExtractCert}
                    >
                      인증서 정보 추출
                    </Button>
                  </Box>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Controller
                        name="certData"
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              label="인증서 데이터 (PEM)"
                              fullWidth
                              disabled={testCompleted}
                              error={!!errors.certData}
                              helperText={errors.certData?.message}
                              placeholder="MIIF... (-----BEGIN CERTIFICATE----- 와 -----END CERTIFICATE----- 사이의 내용만)"
                              value={field.value || ''}
                              onChange={(e) => {
                                const cleaned = e.target.value
                                  .replace(/[\r\n\t\s]/g, '')
                                  .replace(/\\n/g, '')
                                  .replace(/\\r/g, '')
                                  .replace(/\\t/g, '');
                                field.onChange(cleaned);
                              }}
                              onPaste={(e) => {
                                e.preventDefault();
                                const pastedText = e.clipboardData.getData('text');
                                const cleaned = pastedText
                                  .replace(/[\r\n\t\s]/g, '')
                                  .replace(/\\n/g, '')
                                  .replace(/\\r/g, '')
                                  .replace(/\\t/g, '');
                                field.onChange(cleaned);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                            />
                            {!errors.certData && (
                              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                                -----BEGIN CERTIFICATE----- 와 -----END CERTIFICATE----- 를 제외한 사이의 데이터만 입력하세요
                              </FormHelperText>
                            )}
                          </Box>
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Controller
                        name="privateKey"
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              label="개인키 (PEM)"
                              fullWidth
                              disabled={testCompleted}
                              error={!!errors.privateKey}
                              helperText={errors.privateKey?.message}
                              placeholder="MIIE... (-----BEGIN PRIVATE KEY----- 와 -----END PRIVATE KEY----- 사이의 내용만)"
                              value={field.value || ''}
                              onChange={(e) => {
                                const cleaned = e.target.value
                                  .replace(/[\r\n\t\s]/g, '')
                                  .replace(/\\n/g, '')
                                  .replace(/\\r/g, '')
                                  .replace(/\\t/g, '');
                                field.onChange(cleaned);
                              }}
                              onPaste={(e) => {
                                e.preventDefault();
                                const pastedText = e.clipboardData.getData('text');
                                const cleaned = pastedText
                                  .replace(/[\r\n\t\s]/g, '')
                                  .replace(/\\n/g, '')
                                  .replace(/\\r/g, '')
                                  .replace(/\\t/g, '');
                                field.onChange(cleaned);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                            />
                            {!errors.privateKey && (
                              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                                -----BEGIN PRIVATE KEY----- 와 -----END PRIVATE KEY----- 를 제외한 사이의 데이터만 입력하세요
                              </FormHelperText>
                            )}
                          </Box>
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="certPassword"
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              label="인증서 비밀번호"
                              type="password"
                              fullWidth
                              disabled={testCompleted}
                              error={!!errors.certPassword}
                              helperText={errors.certPassword?.message}
                              onFocus={() => setFocused({ ...focused, certPassword: true })}
                              onBlur={() => setFocused({ ...focused, certPassword: false })}
                            />
                            {(focused.certPassword || field.value) && !errors.certPassword && (
                              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                                실제 인증서 비밀번호를 입력하세요
                              </FormHelperText>
                            )}
                          </Box>
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="userPassword"
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              label="사용자 비밀번호"
                              type="password"
                              fullWidth
                              disabled={testCompleted}
                              error={!!errors.userPassword}
                              helperText={errors.userPassword?.message}
                              onFocus={() => setFocused({ ...focused, userPassword: true })}
                              onBlur={() => setFocused({ ...focused, userPassword: false })}
                            />
                            {!errors.userPassword && (
                              <FormHelperText sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.5 }}>
                                인증서 정보 암호화에 사용됩니다
                              </FormHelperText>
                            )}
                            {(focused.userPassword || field.value) && !errors.userPassword && (
                              <FormHelperText sx={{ color: 'info.main', fontSize: '0.75rem', mt: 0.5 }}>
                                최소 8자 이상의 비밀번호를 입력해주세요
                              </FormHelperText>
                            )}
                          </Box>
                        )}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* 연결 테스트 */}
            {watchedClientId && watchedClientId.length === 10 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      연결 테스트
                    </Typography>
                    
                    <Button
                      variant="outlined"
                      onClick={handleTestConnection}
                      disabled={isLoading || testCompleted}
                      sx={{ mb: 1 }}
                    >
                      {isLoading ? <CircularProgress size={20} /> : testCompleted ? '연결 테스트 완료' : '연결 테스트'}
                    </Button>
                    
                    {/* 에러 메시지를 버튼 하단에 표시 */}
                    {testError && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'error.main', 
                          mt: 1,
                          fontWeight: 500
                        }}
                      >
                        {testError}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* 버튼 */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/credentials')}
                  disabled={isLoading}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={20} /> : (isEdit ? '수정' : '저장')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* 인증서 선택 다이얼로그 */}
      <Dialog open={certDialogOpen} onClose={() => setCertDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>인증서 선택</DialogTitle>
        <DialogContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>선택</TableCell>
                <TableCell>인증서명</TableCell>
                <TableCell>발급자</TableCell>
                <TableCell>만료일</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {certList.map((cert, index) => (
                <TableRow 
                  key={index}
                  hover
                  selected={selectedCert === cert}
                  onClick={() => handleCertSelect(cert)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <input 
                      type="radio" 
                      checked={selectedCert === cert}
                      onChange={() => handleCertSelect(cert)}
                    />
                  </TableCell>
                  <TableCell>{cert.subjectName || '-'}</TableCell>
                  <TableCell>{cert.issuerName || '-'}</TableCell>
                  <TableCell>{cert.validTo || '-'}</TableCell>
                </TableRow>
              ))}
              {certList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    인증서가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCertDialogOpen(false)}>취소</Button>
          <Button onClick={handleCertConfirm} variant="contained" disabled={!selectedCert}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CredentialFormPage
