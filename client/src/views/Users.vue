<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-white">User Management</h1>
        <p class="text-gray-400 mt-1">Manage user accounts and permissions</p>
      </div>
      <button
        @click="openCreateModal"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add User
      </button>
    </div>

    <!-- Users Table -->
    <div class="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
      <div v-if="loading" class="p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p class="text-gray-400 mt-4">Loading users...</p>
      </div>

      <div v-else-if="error" class="p-8 text-center">
        <p class="text-red-400">{{ error }}</p>
      </div>

      <table v-else class="w-full">
        <thead class="bg-gray-700">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Last Login</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-750">
            <td class="px-6 py-4">
              <div>
                <div class="text-white font-medium">{{ user.username }}</div>
                <div class="text-gray-400 text-sm">{{ user.email }}</div>
              </div>
            </td>
            <td class="px-6 py-4">
              <span
                :class="{
                  'bg-red-500/20 text-red-400': user.role === 'admin',
                  'bg-blue-500/20 text-blue-400': user.role === 'editor',
                  'bg-gray-500/20 text-gray-400': user.role === 'viewer'
                }"
                class="px-3 py-1 rounded-full text-xs font-medium"
              >
                {{ user.role.toUpperCase() }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span
                :class="{
                  'bg-green-500/20 text-green-400': user.is_active,
                  'bg-gray-500/20 text-gray-400': !user.is_active
                }"
                class="px-3 py-1 rounded-full text-xs font-medium"
              >
                {{ user.is_active ? 'Active' : 'Inactive' }}
              </span>
              <span v-if="user.locked_until && new Date(user.locked_until) > new Date()" class="ml-2 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
                Locked
              </span>
            </td>
            <td class="px-6 py-4 text-gray-400 text-sm">
              {{ user.last_login ? formatDate(user.last_login) : 'Never' }}
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex justify-end gap-2">
                <button
                  @click="openEditModal(user)"
                  class="px-3 py-1 text-blue-400 hover:text-blue-300 text-sm"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  v-if="user.locked_until && new Date(user.locked_until) > new Date()"
                  @click="unlockUser(user.id)"
                  class="px-3 py-1 text-yellow-400 hover:text-yellow-300 text-sm"
                  title="Unlock"
                >
                  Unlock
                </button>
                <button
                  @click="openResetPasswordModal(user)"
                  class="px-3 py-1 text-purple-400 hover:text-purple-300 text-sm"
                  title="Reset Password"
                >
                  Reset
                </button>
                <button
                  v-if="user.id !== currentUserId"
                  @click="toggleUserStatus(user)"
                  :class="user.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'"
                  class="px-3 py-1 text-sm"
                  :title="user.is_active ? 'Deactivate' : 'Activate'"
                >
                  {{ user.is_active ? 'Deactivate' : 'Activate' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit User Modal -->
    <div
      v-if="showUserModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50"
      @click.self="closeUserModal"
    >
      <div class="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 class="text-2xl font-bold text-white mb-6">
          {{ editingUser ? 'Edit User' : 'Create User' }}
        </h2>

        <form @submit.prevent="saveUser" class="space-y-4">
          <div v-if="userModalError" class="bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p class="text-red-400 text-sm">{{ userModalError }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              v-model="userForm.email"
              type="email"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="savingUser"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <input
              v-model="userForm.username"
              type="text"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="savingUser"
            />
          </div>

          <div v-if="!editingUser">
            <label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              v-model="userForm.password"
              type="password"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="savingUser"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Role</label>
            <select
              v-model="userForm.role"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="savingUser"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="button"
              @click="closeUserModal"
              class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              :disabled="savingUser"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              :disabled="savingUser"
            >
              {{ savingUser ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <div
      v-if="showResetPasswordModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50"
      @click.self="closeResetPasswordModal"
    >
      <div class="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 class="text-2xl font-bold text-white mb-6">Reset Password</h2>

        <form @submit.prevent="resetPassword" class="space-y-4">
          <div v-if="resetPasswordError" class="bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p class="text-red-400 text-sm">{{ resetPasswordError }}</p>
          </div>

          <p class="text-gray-400">
            Reset password for <strong class="text-white">{{ resetPasswordUser?.username }}</strong>
          </p>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">New Password</label>
            <input
              v-model="newPassword"
              type="password"
              required
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="resettingPassword"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="button"
              @click="closeResetPasswordModal"
              class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              :disabled="resettingPassword"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              :disabled="resettingPassword"
            >
              {{ resettingPassword ? 'Resetting...' : 'Reset Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

const authStore = useAuthStore()
const currentUserId = computed(() => authStore.user?.id)

const users = ref([])
const loading = ref(false)
const error = ref(null)

const showUserModal = ref(false)
const editingUser = ref(null)
const userForm = ref({
  email: '',
  username: '',
  password: '',
  role: 'viewer'
})
const savingUser = ref(false)
const userModalError = ref(null)

const showResetPasswordModal = ref(false)
const resetPasswordUser = ref(null)
const newPassword = ref('')
const resettingPassword = ref(false)
const resetPasswordError = ref(null)

async function fetchUsers() {
  loading.value = true
  error.value = null

  try {
    const { data } = await axios.get('/api/users')
    users.value = data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingUser.value = null
  userForm.value = {
    email: '',
    username: '',
    password: '',
    role: 'viewer'
  }
  userModalError.value = null
  showUserModal.value = true
}

function openEditModal(user) {
  editingUser.value = user
  userForm.value = {
    email: user.email,
    username: user.username,
    role: user.role
  }
  userModalError.value = null
  showUserModal.value = true
}

function closeUserModal() {
  showUserModal.value = false
  editingUser.value = null
  userModalError.value = null
}

async function saveUser() {
  savingUser.value = true
  userModalError.value = null

  try {
    if (editingUser.value) {
      // Update existing user
      await axios.put(`/api/users/${editingUser.value.id}`, userForm.value)
    } else {
      // Create new user
      await axios.post('/api/users', userForm.value)
    }

    closeUserModal()
    await fetchUsers()
  } catch (err) {
    userModalError.value = err.response?.data?.error || 'Failed to save user'
  } finally {
    savingUser.value = false
  }
}

async function toggleUserStatus(user) {
  const action = user.is_active ? 'deactivate' : 'activate'
  if (!confirm(`Are you sure you want to ${action} ${user.username}?`)) {
    return
  }

  try {
    await axios.put(`/api/users/${user.id}`, {
      is_active: !user.is_active
    })
    await fetchUsers()
  } catch (err) {
    alert(err.response?.data?.error || `Failed to ${action} user`)
  }
}

function openResetPasswordModal(user) {
  resetPasswordUser.value = user
  newPassword.value = ''
  resetPasswordError.value = null
  showResetPasswordModal.value = true
}

function closeResetPasswordModal() {
  showResetPasswordModal.value = false
  resetPasswordUser.value = null
  resetPasswordError.value = null
}

async function resetPassword() {
  resettingPassword.value = true
  resetPasswordError.value = null

  try {
    await axios.post(`/api/users/${resetPasswordUser.value.id}/reset-password`, {
      newPassword: newPassword.value
    })

    closeResetPasswordModal()
    alert('Password reset successfully. User will be required to change it on next login.')
  } catch (err) {
    resetPasswordError.value = err.response?.data?.error || 'Failed to reset password'
  } finally {
    resettingPassword.value = false
  }
}

async function unlockUser(userId) {
  try {
    await axios.post(`/api/users/${userId}/unlock`)
    await fetchUsers()
    alert('User account unlocked successfully')
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to unlock user')
  }
}

function formatDate(date) {
  return new Date(date).toLocaleString()
}

onMounted(() => {
  fetchUsers()
})
</script>
