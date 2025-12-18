import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Initialize auth store before mounting
const authStore = useAuthStore()
authStore.initialize()

app.use(router)

app.mount('#app')
