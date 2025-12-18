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
