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
  FormHelperText
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import toast from 'react-hot-toast'
import { credentialService } from '../services/api'

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
                      onClick={() => {
                        window.open('/NxWeb_Guide.html', '_blank');
                      }}
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
    </Box>
  )
}

export default CredentialFormPage
