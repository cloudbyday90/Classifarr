<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Card>
    <h3 class="text-lg font-medium mb-4">Authorization Header</h3>

    <div v-if="!hasSecret" class="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
      <div class="flex items-center gap-2 text-red-400 font-medium">
        <span>⚠️</span>
        <span>Authorization Header Required</span>
      </div>
      <p class="text-sm text-red-300 mt-1">
        Webhooks will be rejected until an authorization header is generated.
      </p>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Authorization Header Value</label>
        <div class="flex gap-2">
          <input
            :value="displayAuthorizationHeader"
            readonly
            :placeholder="hasSecret ? '' : 'Generating authorization header...'"
            class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm"
          />
          <Button
            v-if="hasSecret"
            @click="toggleMask"
            variant="secondary"
            size="sm"
            :disabled="revealing || regenerating"
          >
            {{ isAuthorizationHeaderVisible ? '🙈 Mask' : (revealing ? 'Loading...' : '👁️ Unmask') }}
          </Button>
          <Button @click="regenerateAuthorizationHeader" variant="primary" size="sm" :disabled="regenerating">
            {{ regenerating ? 'Generating...' : (hasSecret ? 'Regenerate' : 'Generate') }}
          </Button>
          <Button v-if="hasSecret" @click="copyAuthorizationHeader" variant="secondary" size="sm" :disabled="copying">
            {{ copying ? 'Copying...' : '📋 Copy' }}
          </Button>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          Paste this into the <strong>Authorization Header</strong> field in Overseerr/Jellyseerr.
        </p>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import { Card, Button } from '@/components/common'

const props = defineProps({
  maskedSecretKey: {
    type: String,
    default: ''
  },
  autoGenerateIfMissing: {
    type: Boolean,
    default: true
  },
  autoRemaskTimeoutMs: {
    type: Number,
    default: 60000
  }
})

const emit = defineEmits(['secret-updated'])

const toast = useToast()

const isAuthorizationHeaderVisible = ref(false)
const revealedAuthorizationHeader = ref('')
const revealing = ref(false)
const regenerating = ref(false)
const copying = ref(false)
const autoGenerationAttempted = ref(false)
let autoRemaskTimer = null

const hasSecret = computed(() => Boolean(props.maskedSecretKey))
const normalizedAutoRemaskTimeoutMs = computed(() => {
  const timeout = Number(props.autoRemaskTimeoutMs)
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 0
})

const displayAuthorizationHeader = computed(() => {
  if (isAuthorizationHeaderVisible.value && revealedAuthorizationHeader.value) {
    return revealedAuthorizationHeader.value
  }

  return props.maskedSecretKey || ''
})

const maskTokenForDisplay = (token) => {
  if (!token || typeof token !== 'string') return ''
  if (token.length <= 4) return '••••••••••••'
  return `••••••••${token.slice(-4)}`
}

const clearAutoRemaskTimer = () => {
  if (!autoRemaskTimer) return
  clearTimeout(autoRemaskTimer)
  autoRemaskTimer = null
}

const scheduleAutoRemask = () => {
  clearAutoRemaskTimer()
  if (!isAuthorizationHeaderVisible.value || !revealedAuthorizationHeader.value) return
  if (!normalizedAutoRemaskTimeoutMs.value) return

  autoRemaskTimer = setTimeout(() => {
    resetVisibleSecret()
  }, normalizedAutoRemaskTimeoutMs.value)
}

const setVisibleSecret = (fullSecret) => {
  revealedAuthorizationHeader.value = fullSecret
  isAuthorizationHeaderVisible.value = true
  scheduleAutoRemask()
}

const resetVisibleSecret = () => {
  clearAutoRemaskTimer()
  isAuthorizationHeaderVisible.value = false
  revealedAuthorizationHeader.value = ''
}

const copyText = async (text) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-9999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

const getFullAuthorizationHeader = async () => {
  const response = await api.getWebhookSecret()
  const fullSecret = response.data?.secret_key

  if (!fullSecret) {
    throw new Error('No authorization header returned by server')
  }

  return fullSecret
}

const regenerateAuthorizationHeader = async (options = {}) => {
  const {
    skipConfirm = false,
    revealAfter = true,
    silent = false
  } = options

  if (hasSecret.value && !skipConfirm) {
    const confirmed = confirm('Are you sure? This will invalidate the existing authorization header.')
    if (!confirmed) return
  }

  regenerating.value = true
  try {
    const response = await api.generateWebhookKey()
    const fullSecret = response.data?.secret_key

    if (!fullSecret) {
      throw new Error('No authorization header returned by server')
    }

    emit('secret-updated', maskTokenForDisplay(fullSecret))

    if (revealAfter) {
      setVisibleSecret(fullSecret)
    } else {
      resetVisibleSecret()
    }

    if (!silent) {
      toast.success(hasSecret.value ? 'Authorization header regenerated' : 'Authorization header generated')
    }
  } catch (error) {
    console.error('Failed to generate authorization header:', error)
    toast.error('Failed to generate authorization header')
  } finally {
    regenerating.value = false
  }
}

const toggleMask = async () => {
  if (isAuthorizationHeaderVisible.value) {
    resetVisibleSecret()
    return
  }

  revealing.value = true
  try {
    const fullSecret = await getFullAuthorizationHeader()
    setVisibleSecret(fullSecret)
  } catch (error) {
    console.error('Failed to reveal authorization header:', error)
    toast.error('Failed to reveal authorization header')
  } finally {
    revealing.value = false
  }
}

const copyAuthorizationHeader = async () => {
  if (!hasSecret.value) {
    toast.error('No authorization header to copy')
    return
  }

  copying.value = true
  try {
    const usingVisibleSecret = Boolean(isAuthorizationHeaderVisible.value && revealedAuthorizationHeader.value)
    const fullSecret = usingVisibleSecret
      ? revealedAuthorizationHeader.value
      : await getFullAuthorizationHeader()

    await copyText(fullSecret)
    if (usingVisibleSecret) {
      scheduleAutoRemask()
    }
    toast.success('Authorization header copied to clipboard')
  } catch (error) {
    console.error('Failed to copy authorization header:', error)
    toast.error('Failed to copy authorization header')
  } finally {
    copying.value = false
  }
}

watch(() => props.maskedSecretKey, (newValue) => {
  if (!newValue) {
    resetVisibleSecret()
  }
})

watch(() => normalizedAutoRemaskTimeoutMs.value, () => {
  if (isAuthorizationHeaderVisible.value) {
    scheduleAutoRemask()
  }
})

onBeforeUnmount(() => {
  clearAutoRemaskTimer()
})

onMounted(async () => {
  if (!props.autoGenerateIfMissing || hasSecret.value || autoGenerationAttempted.value) {
    return
  }

  autoGenerationAttempted.value = true
  await regenerateAuthorizationHeader({
    skipConfirm: true,
    revealAfter: false,
    silent: true
  })
})
</script>
