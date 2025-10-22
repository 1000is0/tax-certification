import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tax-certification.vercel.app/api'

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// 요청 인터셉터 - 토큰 추가
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 응답 인터셉터 - 토큰 만료 처리
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          })
          
          const { accessToken } = response.data
          localStorage.setItem('accessToken', accessToken)
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export const credentialService = {
  // 인증서 목록 조회
  async getCredentials() {
    try {
      const response = await api.get('/credentials')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 인증서 상세 조회
  async getCredential(id) {
    try {
      const response = await api.get(`/credentials/${id}`)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 인증서 생성
  async createCredential(data) {
    try {
      const response = await api.post('/credentials', data)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 인증서 수정
  async updateCredential(id, data) {
    try {
      const response = await api.put(`/credentials/${id}`, data)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 인증서 삭제
  async deleteCredential(id) {
    try {
      const response = await api.delete(`/credentials/${id}`)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 인증서 비활성화
  async deactivateCredential(id) {
    try {
      const response = await api.post(`/credentials/${id}/deactivate`)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 연결 테스트
  async testConnection(data) {
    try {
      const response = await api.post('/credentials/test-connection', data)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 클라이언트 ID로 인증서 복호화 (Make 웹훅용)
  async decryptByClientId(data) {
    try {
      const response = await api.post('/webhook/decrypt-credentials', data)
      return response.data
    } catch (error) {
      throw error
    }
  }
}

// 크레딧 서비스
export const creditService = {
  // 크레딧 잔액 조회
  async getBalance() {
    try {
      const response = await api.get('/credits')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 크레딧 이력 조회
  async getHistory(params = {}) {
    try {
      const response = await api.get('/credits/history', { params })
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 구독 플랜 목록 조회
  async getPlans() {
    try {
      const response = await api.get('/credits/plans')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 내 구독 정보 조회
  async getMySubscription() {
    try {
      const response = await api.get('/credits/subscription')
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export const authService = {
  // 로그인
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password })
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 회원가입
  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 로그아웃
  async logout() {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // 로그아웃 실패해도 토큰은 제거
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  },

  // 현재 사용자 정보 조회
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 비밀번호 변경
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      })
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 계정 삭제
  async deleteAccount() {
    try {
      const response = await api.delete('/auth/account')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 비밀번호 검증
  async verifyPassword(password) {
    try {
      const response = await api.post('/auth/verify-password', { password })
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export const paymentService = {
  // 크레딧 구매 결제 준비
  async prepareCreditPayment(data) {
    try {
      const response = await api.post('/payments/prepare/credit', data)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 구독 결제 준비
  async prepareSubscriptionPayment(data) {
    try {
      const response = await api.post('/payments/prepare/subscription', data)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 결제 승인
  async approvePayment(data) {
    try {
      const response = await api.post('/payments/approve', data)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 결제 취소
  async cancelPayment(data) {
    try {
      const response = await api.post('/payments/cancel', data)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 결제 내역 조회
  async getPaymentHistory(params = {}) {
    try {
      const response = await api.get('/payments/history', { params })
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export const subscriptionService = {
  // 내 구독 정보 조회
  async getMySubscription() {
    try {
      const response = await api.get('/subscriptions/my')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 구독 취소
  async cancel(reason = '') {
    try {
      const response = await api.post('/subscriptions/cancel', { reason })
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 구독 플랜 변경
  async changeTier(newTier) {
    try {
      const response = await api.post('/subscriptions/change-tier', { newTier })
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export const adminService = {
  // 모든 인증서 조회
  async getAllCredentials(params = {}) {
    try {
      const response = await api.get('/admin/credentials', { params })
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 인증서 통계 조회
  async getCredentialStats() {
    try {
      const response = await api.get('/admin/credentials/stats')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 모든 사용자 조회
  async getAllUsers() {
    try {
      const response = await api.get('/admin/users')
      return response.data
    } catch (error) {
      throw error
    }
  },

  // 크레딧 지급
  async grantCredits(data) {
    try {
      const response = await api.post('/admin/credits/grant', data)
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export default api

