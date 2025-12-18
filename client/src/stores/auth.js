import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:21324/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const accessToken = ref(null)
  const refreshToken = ref(null)
  const permissions = ref({})
  const loading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)

  // Load tokens from localStorage on init
  function loadTokens() {
    const storedAccessToken = localStorage.getItem('accessToken')
    const storedRefreshToken = localStorage.getItem('refreshToken')
    
    if (storedAccessToken) {
      accessToken.value = storedAccessToken
    }
    if (storedRefreshToken) {
      refreshToken.value = storedRefreshToken
    }
  }

  // Save tokens to localStorage
  // Note: Storing JWT in localStorage is vulnerable to XSS attacks.
  // For enhanced security in production:
  // 1. Implement Content Security Policy (CSP) to mitigate XSS
  // 2. Consider using httpOnly secure cookies (requires backend changes)
  // 3. Keep access token expiry short (15 minutes)
  function saveTokens(access, refresh) {
    accessToken.value = access
    refreshToken.value = refresh
    
    localStorage.setItem('accessToken', access)
    if (refresh) {
      localStorage.setItem('refreshToken', refresh)
    }
  }

  // Clear tokens
  function clearTokens() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    permissions.value = {}
    
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  // Set up axios interceptors
  function setupAxiosInterceptors() {
    // Request interceptor - add auth token
    axios.interceptors.request.use(
      (config) => {
        if (accessToken.value) {
          config.headers.Authorization = `Bearer ${accessToken.value}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor - handle token refresh
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // If 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            // Try to refresh the token
            const { data } = await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken: refreshToken.value
            })

            saveTokens(data.accessToken, refreshToken.value)

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
            return axios(originalRequest)
          } catch (refreshError) {
            // Refresh failed, logout
            clearTokens()
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  // Login
  async function login(email, password) {
    loading.value = true
    error.value = null

    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      })

      saveTokens(data.accessToken, data.refreshToken)
      user.value = data.user

      // Fetch full user details and permissions
      await fetchUser()

      return data.user
    } catch (err) {
      error.value = err.response?.data?.error || 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Logout
  async function logout() {
    loading.value = true
    error.value = null

    try {
      if (refreshToken.value) {
        await axios.post(`${API_URL}/auth/logout`, {
          refreshToken: refreshToken.value
        })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      clearTokens()
      loading.value = false
    }
  }

  // Refresh access token
  async function refresh() {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken: refreshToken.value
      })

      saveTokens(data.accessToken, refreshToken.value)
      user.value = data.user

      return data
    } catch (err) {
      clearTokens()
      throw err
    }
  }

  // Fetch current user details
  async function fetchUser() {
    if (!accessToken.value) {
      return null
    }

    try {
      const { data } = await axios.get(`${API_URL}/auth/me`)
      
      user.value = {
        id: data.id,
        email: data.email,
        username: data.username,
        role: data.role,
        isActive: data.isActive,
        mustChangePassword: data.mustChangePassword,
        lastLogin: data.lastLogin,
        createdAt: data.createdAt
      }

      permissions.value = data.permissions

      return user.value
    } catch (err) {
      console.error('Failed to fetch user:', err)
      if (err.response?.status === 401) {
        clearTokens()
      }
      throw err
    }
  }

  // Change password
  async function changePassword(currentPassword, newPassword) {
    loading.value = true
    error.value = null

    try {
      await axios.post(`${API_URL}/auth/change-password`, {
        currentPassword,
        newPassword
      })

      // After password change, user needs to login again
      clearTokens()
      
      return true
    } catch (err) {
      error.value = err.response?.data?.error || 'Password change failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Validate password strength
  async function validatePassword(password) {
    try {
      const { data } = await axios.post(`${API_URL}/auth/validate-password`, {
        password
      })
      return data
    } catch (err) {
      throw err
    }
  }

  // Get active sessions
  async function getSessions() {
    try {
      const { data } = await axios.get(`${API_URL}/auth/sessions`)
      return data
    } catch (err) {
      throw err
    }
  }

  // Revoke a session
  async function revokeSession(sessionId) {
    try {
      await axios.delete(`${API_URL}/auth/sessions/${sessionId}`)
    } catch (err) {
      throw err
    }
  }

  // Check if user has a specific permission
  function hasPermission(permission) {
    return permissions.value[permission] === true
  }

  // Check if user has a specific role
  function hasRole(role) {
    return user.value?.role === role
  }

  // Initialize auth store
  function initialize() {
    loadTokens()
    setupAxiosInterceptors()

    // Try to fetch user if we have a token
    if (accessToken.value) {
      fetchUser().catch(() => {
        // If fetch fails, clear tokens
        clearTokens()
      })
    }
  }

  return {
    // State
    user,
    accessToken,
    refreshToken,
    permissions,
    loading,
    error,
    isAuthenticated,

    // Actions
    login,
    logout,
    refresh,
    fetchUser,
    changePassword,
    validatePassword,
    getSessions,
    revokeSession,
    hasPermission,
    hasRole,
    initialize,
    clearTokens
  }
})
