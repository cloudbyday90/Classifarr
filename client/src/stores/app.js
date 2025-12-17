import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const appName = ref('Classifarr')
  const version = ref('1.0.0')
  const theme = ref('dark')
  const sidebarCollapsed = ref(false)
  const loading = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setLoading(state) {
    loading.value = state
  }

  return {
    appName,
    version,
    theme,
    sidebarCollapsed,
    loading,
    toggleSidebar,
    setLoading,
  }
})
