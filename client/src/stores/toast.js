/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])
  let idCounter = 0

  const addToast = ({ type = 'info', title = '', message = '', duration = 5000 }) => {
    const id = ++idCounter
    toasts.value.push({ id, type, title, message })
    
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    
    return id
  }

  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) toasts.value.splice(index, 1)
  }

  // Convenience methods
  const success = (message, title) => addToast({ type: 'success', title, message })
  const error = (message, title) => addToast({ type: 'error', title, message })
  const warning = (message, title) => addToast({ type: 'warning', title, message })
  const info = (message, title) => addToast({ type: 'info', title, message })

  return { toasts, addToast, removeToast, success, error, warning, info }
})

// Composable for use in components
export const useToast = () => {
  const store = useToastStore()
  return {
    success: store.success,
    error: store.error,
    warning: store.warning,
    info: store.info
  }
}
