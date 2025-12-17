<template>
  <Button
    :variant="connected ? 'success' : 'primary'"
    :loading="testing"
    @click="test"
  >
    {{ buttonText }}
  </Button>
</template>

<script setup>
import { ref, computed } from 'vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  onTest: {
    type: Function,
    required: true,
  },
  connected: {
    type: Boolean,
    default: false,
  },
})

const testing = ref(false)

const buttonText = computed(() => {
  if (testing.value) return 'Testing...'
  if (props.connected) return 'Connected ✓'
  return 'Test Connection'
})

const test = async () => {
  testing.value = true
  try {
    await props.onTest()
  } finally {
    testing.value = false
  }
}
</script>
