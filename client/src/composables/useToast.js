import { ref } from 'vue'

// Global toast ref that will be set by App.vue
const toastRef = ref(null)

export function setToastRef(ref) {
  toastRef.value = ref
}

export function useToast() {
  const toast = {
    success: (message, title = null, duration = 4000) => {
      if (toastRef.value) {
        toastRef.value.success(message, title, duration)
      } else {
        console.log('[Toast] Success:', message)
      }
    },
    error: (message, title = null, duration = 6000) => {
      if (toastRef.value) {
        toastRef.value.error(message, title, duration)
      } else {
        console.error('[Toast] Error:', message)
      }
    },
    warning: (message, title = null, duration = 5000) => {
      if (toastRef.value) {
        toastRef.value.warning(message, title, duration)
      } else {
        console.warn('[Toast] Warning:', message)
      }
    },
    info: (message, title = null, duration = 4000) => {
      if (toastRef.value) {
        toastRef.value.info(message, title, duration)
      } else {
        console.log('[Toast] Info:', message)
      }
    }
  }
  
  return toast
}
