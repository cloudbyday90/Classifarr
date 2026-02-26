<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2">Classifarr</h1>
        <p class="text-gray-400">Sign in to continue</p>
      </div>

      <div class="bg-gray-800 rounded-lg shadow-xl p-8">
        <form @submit.prevent="login" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Username or Email</label>
            <input
              v-model="form.identifier"
              type="text"
              required
              autocomplete="username"
              placeholder="admin or admin@example.com"
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
                autocomplete="current-password"
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
          </div>

          <div v-if="error" class="p-3 bg-red-900/30 text-red-400 rounded-lg text-sm">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="!canSubmit || loading"
            class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
          >
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '@/api'
import { useToast } from '@/stores/toast'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const form = ref({
  identifier: '',
  password: ''
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const canSubmit = computed(() => 
  form.value.identifier && form.value.password
)

// Check for expired session on mount
onMounted(() => {
  if (route.query.expired === 'true') {
    toast.warning('Session expired. Please log in again.')
  }
})

const login = async () => {
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''

  try {
    const response = await api.login(form.value.identifier, form.value.password)

    if (response.data.success) {
      const redirectTo = route.query.redirect || '/'
      router.push(redirectTo)
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>
