<template>
  <router-view />
  <Toast ref="toastRef" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toast from '@/components/common/Toast.vue'
import { setToastRef } from '@/composables/useToast'

const toastRef = ref(null)

onMounted(() => {
  setToastRef(toastRef.value)
})
</script>
