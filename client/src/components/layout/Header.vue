<template>
  <header class="bg-sidebar border-b border-gray-800 px-6 py-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">{{ pageTitle }}</h2>
      </div>
      <div class="flex items-center space-x-4">
        <div class="text-sm text-gray-400">
          {{ currentTime }}
        </div>
        
        <!-- User Menu -->
        <div class="relative">
          <button
            @click="showUserMenu = !showUserMenu"
            class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
              {{ userInitials }}
            </div>
            <span class="text-white text-sm">{{ username }}</span>
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="showUserMenu"
            v-click-outside="() => showUserMenu = false"
            class="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-50"
          >
            <div class="px-4 py-3 border-b border-gray-700">
              <p class="text-white font-medium">{{ username }}</p>
              <p class="text-gray-400 text-sm">{{ userEmail }}</p>
              <p class="text-gray-500 text-xs mt-1 capitalize">{{ userRole }}</p>
            </div>

            <router-link
              v-if="authStore.hasPermission('can_manage_users')"
              to="/users"
              class="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-700 transition-colors"
              @click="showUserMenu = false"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              User Management
            </router-link>

            <button
              @click="showChangePasswordModal = true; showUserMenu = false"
              class="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Change Password
            </button>

            <button
              @click="handleLogout"
              class="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Change Password Modal -->
    <div
      v-if="showChangePasswordModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50"
      @click.self="showChangePasswordModal = false"
    >
      <div class="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 class="text-2xl font-bold text-white mb-6">Change Password</h2>

        <form @submit.prevent="changePassword" class="space-y-4">
          <div v-if="changePasswordError" class="bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p class="text-red-400 text-sm">{{ changePasswordError }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
            <input
              v-model="currentPassword"
              type="password"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="changingPassword"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">New Password</label>
            <input
              v-model="newPassword"
              type="password"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="changingPassword"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="changingPassword"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="button"
              @click="showChangePasswordModal = false"
              class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              :disabled="changingPassword"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              :disabled="changingPassword"
            >
              {{ changingPassword ? 'Changing...' : 'Change Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const currentTime = ref(new Date().toLocaleTimeString())
const showUserMenu = ref(false)
const showChangePasswordModal = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)
const changePasswordError = ref('')

const pageTitle = computed(() => {
  return route.meta.title || route.name || 'Classifarr'
})

const username = computed(() => authStore.user?.username || 'User')
const userEmail = computed(() => authStore.user?.email || '')
const userRole = computed(() => authStore.user?.role || 'viewer')
const userInitials = computed(() => {
  const name = authStore.user?.username || 'U'
  return name.substring(0, 2).toUpperCase()
})

async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await authStore.logout()
    router.push('/login')
  }
}

async function changePassword() {
  changePasswordError.value = ''

  if (newPassword.value !== confirmPassword.value) {
    changePasswordError.value = 'Passwords do not match'
    return
  }

  changingPassword.value = true

  try {
    await authStore.changePassword(currentPassword.value, newPassword.value)
    showChangePasswordModal.value = false
    alert('Password changed successfully. Please login again.')
    router.push('/login')
  } catch (error) {
    changePasswordError.value = error.response?.data?.error || 'Password change failed'
  } finally {
    changingPassword.value = false
  }
}

// Click outside directive
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = function(event) {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent)
  }
}

let timer
onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = new Date().toLocaleTimeString()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
