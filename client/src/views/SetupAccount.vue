<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2">Welcome to Classifarr</h1>
        <p class="text-gray-400">Let's create your admin account to get started</p>
      </div>

      <div class="bg-gray-800 rounded-lg shadow-xl p-8">
        <form @submit.prevent="createAccount" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Username</label>
            <input
              v-model="form.username"
              type="text"
              required
              autocomplete="username"
              placeholder="admin"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Password</label>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
              >
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            
            <div class="mt-2 space-y-1 text-xs">
              <p :class="['flex items-center', hasMinLength ? 'text-green-400' : 'text-gray-500']">
                <span class="mr-1">{{ hasMinLength ? '✓' : '○' }}</span>
                At least 8 characters
              </p>
              <p :class="['flex items-center', hasUppercase ? 'text-green-400' : 'text-gray-500']">
                <span class="mr-1">{{ hasUppercase ? '✓' : '○' }}</span>
                One uppercase letter
              </p>
              <p :class="['flex items-center', hasLowercase ? 'text-green-400' : 'text-gray-500']">
                <span class="mr-1">{{ hasLowercase ? '✓' : '○' }}</span>
                One lowercase letter
              </p>
              <p :class="['flex items-center', hasNumber ? 'text-green-400' : 'text-gray-500']">
                <span class="mr-1">{{ hasNumber ? '✓' : '○' }}</span>
                One number
              </p>
              <p :class="['flex items-center', hasSpecial ? 'text-green-400' : 'text-gray-500']">
                <span class="mr-1">{{ hasSpecial ? '✓' : '○' }}</span>
                One special character (!@#$%^&*)
              </p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Confirm Password</label>
            <input
              v-model="form.confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="new-password"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p v-if="form.confirmPassword && !passwordsMatch" class="text-red-400 text-xs mt-1">
              Passwords do not match
            </p>
          </div>

          <div v-if="error" class="p-3 bg-red-900/30 text-red-400 rounded-lg text-sm">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="!canSubmit || loading"
            class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
          >
            {{ loading ? 'Creating Account...' : 'Create Admin Account' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const form = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

// Password strength checks
const hasMinLength = computed(() => form.value.password.length >= 8)
const hasUppercase = computed(() => /[A-Z]/.test(form.value.password))
const hasLowercase = computed(() => /[a-z]/.test(form.value.password))
const hasNumber = computed(() => /[0-9]/.test(form.value.password))
const hasSpecial = computed(() => /[!@#$%^&*(),.?":{}|<>]/.test(form.value.password))

const passwordsMatch = computed(() => 
  form.value.password === form.value.confirmPassword
)

const passwordValid = computed(() => 
  hasMinLength.value && 
  hasUppercase.value && 
  hasLowercase.value && 
  hasNumber.value && 
  hasSpecial.value
)

const canSubmit = computed(() => 
  form.value.username &&
  form.value.password &&
  form.value.confirmPassword &&
  passwordValid.value &&
  passwordsMatch.value
)

const createAccount = async () => {
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''

  try {
    const response = await axios.post('/api/setup/create-admin', {
      username: form.value.username,
      password: form.value.password,
      confirmPassword: form.value.confirmPassword
    })

    if (response.data.success) {
      // Store the token for authenticated requests
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`
      }

      // Redirect to the main setup wizard for TMDB, etc.
      router.push('/setup')
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to create admin account'
  } finally {
    loading.value = false
  }
}
</script>
