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
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const currentTime = ref(new Date().toLocaleTimeString())

const pageTitle = computed(() => {
  return route.meta.title || route.name || 'Classifarr'
})

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
