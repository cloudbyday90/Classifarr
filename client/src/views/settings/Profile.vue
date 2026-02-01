<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">👤 Profile Settings</h1>

    <!-- Username Section -->
    <Card class="mb-6">
      <template #header>
        <h2 class="text-xl font-semibold">Account Information</h2>
      </template>
      
      <form @submit.prevent="saveUsername">
        <div class="mb-4">
          <label for="username" class="block text-sm font-medium mb-2">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autocomplete="username"
            :disabled="savingUsername"
            :aria-invalid="usernameError ? 'true' : 'false'"
            aria-describedby="username-error"
          />
          <div v-if="usernameError" id="username-error" class="text-red-400 text-sm mt-1" role="alert">
            {{ usernameError }}
          </div>
        </div>
        
        <div v-if="userRole" class="mb-4">
          <label class="block text-sm font-medium mb-2">Role</label>
          <div class="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-400">
            {{ userRole === 'admin' ? '👑 Administrator' : '👤 User' }}
          </div>
        </div>
        
        <button
          type="submit"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="username === originalUsername || savingUsername || !username"
        >
          💾 {{ savingUsername ? 'Saving...' : 'Save Changes' }}
        </button>
      </form>
    </Card>

    <!-- Password Section -->
    <Card class="mb-6">
      <template #header>
        <h2 class="text-xl font-semibold">Change Password</h2>
      </template>
      
      <form @submit.prevent="changePassword">
        <div class="mb-4">
          <label for="currentPassword" class="block text-sm font-medium mb-2">Current Password</label>
          <div class="relative">
            <input
              id="currentPassword"
              v-model="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              class="w-full px-4 py-2 pr-12 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autocomplete="current-password"
            />
            <button
              type="button"
              @click="showCurrentPassword = !showCurrentPassword"
              class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200 text-xl"
              :aria-label="showCurrentPassword ? 'Hide current password' : 'Show current password'"
            >
              {{ showCurrentPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label for="newPassword" class="block text-sm font-medium mb-2">New Password</label>
          <div class="relative">
            <input
              id="newPassword"
              v-model="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              class="w-full px-4 py-2 pr-12 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autocomplete="new-password"
              :aria-describedby="newPassword ? 'password-requirements' : undefined"
            />
            <button
              type="button"
              @click="showNewPassword = !showNewPassword"
              class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200 text-xl"
              :aria-label="showNewPassword ? 'Hide new password' : 'Show new password'"
            >
              {{ showNewPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <div v-if="newPassword" id="password-requirements" class="text-xs text-gray-400 mt-2">
            Password must be at least 8 characters and contain uppercase, lowercase, number, and special character
          </div>
        </div>

        <div class="mb-4">
          <label for="confirmPassword" class="block text-sm font-medium mb-2">Confirm New Password</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autocomplete="new-password"
          />
          <div v-if="newPassword && confirmPassword && newPassword !== confirmPassword" class="text-red-400 text-sm mt-1" role="alert">
            Passwords do not match
          </div>
        </div>

        <button
          type="submit"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="!canChangePassword || changingPassword"
        >
          🔐 {{ changingPassword ? 'Updating...' : 'Update Password' }}
        </button>
      </form>
    </Card>

    <!-- Session Info -->
    <Card class="mb-6">
      <template #header>
        <h2 class="text-xl font-semibold">Current Session</h2>
      </template>
      
      <div v-if="session" class="space-y-2 text-sm">
        <div><strong>Started:</strong> {{ formatDate(session.started) }}</div>
        <div><strong>IP Address:</strong> {{ session.ip }}</div>
        <div><strong>Browser:</strong> {{ session.userAgent }}</div>
        <div><strong>Account Created:</strong> {{ formatDate(session.createdAt) }}</div>
      </div>
      <div v-else class="text-gray-400">Loading session information...</div>
    </Card>

    <!-- API Keys Link -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">🔑 API Keys</h2>
      </template>
      
      <p class="text-gray-400 mb-4">Manage your API keys for programmatic access to Classifarr.</p>
      <router-link 
        to="/settings?tab=security" 
        class="inline-block px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
      >
        Manage API Keys →
      </router-link>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/stores/toast'
import api from '@/api'
import Card from '@/components/common/Card.vue'

const toast = useToast()

// Username state
const username = ref('')
const originalUsername = ref('')
const userRole = ref('')
const savingUsername = ref(false)
const usernameError = ref('')

// Password state
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const changingPassword = ref(false)

// Session state
const session = ref(null)

// Computed
const canChangePassword = computed(() => {
  return currentPassword.value &&
         newPassword.value &&
         confirmPassword.value &&
         newPassword.value === confirmPassword.value &&
         newPassword.value.length >= 8
})

// Methods
const saveUsername = async () => {
  usernameError.value = ''
  
  if (!username.value || username.value.length < 3 || username.value.length > 50) {
    usernameError.value = 'Username must be between 3 and 50 characters'
    return
  }
  
  savingUsername.value = true
  try {
    await api.patch('/user/profile', { username: username.value })
    originalUsername.value = username.value
    toast.success('Username updated successfully')
  } catch (error) {
    usernameError.value = error.response?.data?.error || 'Failed to update username'
    toast.error(error.response?.data?.error || 'Failed to update username')
  } finally {
    savingUsername.value = false
  }
}

const changePassword = async () => {
  if (newPassword.value !== confirmPassword.value) {
    toast.error('Passwords do not match')
    return
  }

  changingPassword.value = true
  try {
    await api.patch('/user/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value
    })
    
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    showCurrentPassword.value = false
    showNewPassword.value = false
    toast.success('Password updated successfully')
  } catch (error) {
    toast.error(error.response?.data?.error || 'Failed to update password')
  } finally {
    changingPassword.value = false
  }
}

const fetchSessionInfo = async () => {
  try {
    const { data } = await api.get('/auth/session')
    session.value = data
  } catch (error) {
    console.error('Failed to fetch session info:', error)
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleString()
}

// Lifecycle
onMounted(async () => {
  try {
    const { data } = await api.get('/user/me')
    username.value = data.username
    originalUsername.value = data.username
    userRole.value = data.role
  } catch (error) {
    console.error('Failed to fetch user info:', error)
    toast.error('Failed to load user information')
  }
  
  await fetchSessionInfo()
})
</script>
