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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Divider
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
    .min(100, '유효한 인증서 데이터를 입력해주세요'),
  privateKey: yup
    .string()
    .required('개인키는 필수입니다')
    .min(100, '유효한 개인키를 입력해주세요'),
  certPassword: yup
    .string()
    .required('인증서 비밀번호는 필수입니다')
    .min(4, '인증서 비밀번호는 최소 4자 이상이어야 합니다'),
  userPassword: yup
    .string()
    .required('사용자 비밀번호는 필수입니다')
    .min(8, '사용자 비밀번호는 최소 8자 이상이어야 합니다'),
  certName: yup
    .string()
    .required('인증서 이름은 필수입니다')
    .min(2, '인증서 이름은 최소 2자 이상이어야 합니다'),
  certType: yup
    .string()
    .required('인증서 타입은 필수입니다')
    .oneOf(['personal', 'business'], '유효한 인증서 타입을 선택해주세요')
})

function CredentialFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)

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
      certName: '',
      certType: 'business'
    }
  })

  const watchedClientId = watch('clientId')

  const onSubmit = async (data) => {
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
    if (!formData.clientId || !formData.userPassword) {
      toast.error('사업자등록번호와 사용자 비밀번호를 입력해주세요.')
      return
    }

    setIsLoading(true)
    try {
      const result = await credentialService.testConnection({
        clientId: formData.clientId,
        userPassword: formData.userPassword
      })
      setTestResult(result)
      if (result.isValidConnection) {
        toast.success('연결 테스트에 성공했습니다.')
      } else {
        toast.error('연결 테스트에 실패했습니다.')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '연결 테스트 중 오류가 발생했습니다.')
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
                        name="clientId"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="사업자등록번호"
                            placeholder="1234567890"
                            fullWidth
                            error={!!errors.clientId}
                            helperText={errors.clientId?.message}
                            inputProps={{ maxLength: 10 }}
                          />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="certName"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="인증서 이름"
                            placeholder="예: 우리회사 인증서"
                            fullWidth
                            error={!!errors.certName}
                            helperText={errors.certName?.message}
                          />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="certType"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.certType}>
                            <InputLabel>인증서 타입</InputLabel>
                            <Select {...field} label="인증서 타입">
                              <MenuItem value="business">사업자용</MenuItem>
                              <MenuItem value="personal">개인용</MenuItem>
                            </Select>
                            {errors.certType && (
                              <Typography variant="caption" color="error" sx={{ mt: 1, ml: 2 }}>
                                {errors.certType.message}
                              </Typography>
                            )}
                          </FormControl>
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
                  <Typography variant="h6" gutterBottom>
                    인증서 정보
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Controller
                        name="certData"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="인증서 데이터 (PEM)"
                            multiline
                            rows={6}
                            fullWidth
                            error={!!errors.certData}
                            helperText={errors.certData?.message || '-----BEGIN CERTIFICATE----- 로 시작하는 PEM 형식의 인증서 데이터를 입력하세요'}
                            placeholder="-----BEGIN CERTIFICATE-----&#10;MIIF...&#10;-----END CERTIFICATE-----"
                          />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Controller
                        name="privateKey"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="개인키 (PEM)"
                            multiline
                            rows={6}
                            fullWidth
                            error={!!errors.privateKey}
                            helperText={errors.privateKey?.message || '-----BEGIN PRIVATE KEY----- 로 시작하는 PEM 형식의 개인키를 입력하세요'}
                            placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIE...&#10;-----END PRIVATE KEY-----"
                          />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="certPassword"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="인증서 비밀번호"
                            type="password"
                            fullWidth
                            error={!!errors.certPassword}
                            helperText={errors.certPassword?.message}
                          />
                        )}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="userPassword"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="사용자 비밀번호"
                            type="password"
                            fullWidth
                            error={!!errors.userPassword}
                            helperText={errors.userPassword?.message || '인증서 정보 암호화에 사용됩니다'}
                          />
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
                      disabled={isLoading}
                      sx={{ mb: 2 }}
                    >
                      {isLoading ? <CircularProgress size={20} /> : '연결 테스트'}
                    </Button>
                    
                    {testResult && (
                      <Alert 
                        severity={testResult.isValidConnection ? 'success' : 'error'}
                        sx={{ mt: 2 }}
                      >
                        {testResult.isValidConnection 
                          ? '연결 테스트에 성공했습니다.' 
                          : '연결 테스트에 실패했습니다.'
                        }
                      </Alert>
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
