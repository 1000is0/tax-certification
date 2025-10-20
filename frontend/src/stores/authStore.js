import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // 상태
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,

      // 액션
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login(email, password)
          const { user, tokens } = response
          
          // 토큰 저장
          localStorage.setItem('accessToken', tokens.accessToken)
          localStorage.setItem('refreshToken', tokens.refreshToken)
          
          set({
            isAuthenticated: true,
            user,
            isLoading: false,
            error: null
          })
          
          return response
        } catch (error) {
          const errorMessage = error.response?.data?.error || '로그인에 실패했습니다.'
          set({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: errorMessage
          })
          throw error
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.register(userData)
          const { user, tokens } = response
          
          // 토큰 저장
          localStorage.setItem('accessToken', tokens.accessToken)
          localStorage.setItem('refreshToken', tokens.refreshToken)
          
          set({
            isAuthenticated: true,
            user,
            isLoading: false,
            error: null
          })
          
          return response
        } catch (error) {
          const errorMessage = error.response?.data?.error || '회원가입에 실패했습니다.'
          set({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: errorMessage
          })
          throw error
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // 토큰 제거
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          
          set({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null
          })
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          set({ isAuthenticated: false, user: null })
          return false
        }

        set({ isLoading: true })
        try {
          const response = await authService.getCurrentUser()
          set({
            isAuthenticated: true,
            user: response.user,
            isLoading: false,
            error: null
          })
          return true
        } catch (error) {
          // 토큰이 유효하지 않으면 제거
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          set({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null
          })
          return false
        }
      },

      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData }
        }))
      },

      clearError: () => {
        set({ error: null })
      },

      // 초기화
      initialize: async () => {
        const token = localStorage.getItem('accessToken')
        if (token) {
          await get().checkAuth()
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user
      })
    }
  )
)

