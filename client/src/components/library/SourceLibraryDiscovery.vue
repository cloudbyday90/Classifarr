<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="available && (loading || errorMessage || discovery?.libraries.length)"
    class="rounded-lg border border-gray-700 bg-gray-800 p-4"
    aria-labelledby="source-discovery-heading"
  >
    <h2
      id="source-discovery-heading"
      class="font-semibold"
    >
      Other content discovered
    </h2>
    <p class="mt-1 text-sm text-gray-300">
      Music sections are observed separately. Classifarr does not scan their items, build policies, train on them, or route content to them yet.
    </p>
    <p
      v-if="loading"
      role="status"
      class="mt-2 text-sm"
    >
      Checking source libraries…
    </p>
    <p
      v-else-if="errorMessage"
      role="status"
      class="mt-2 text-sm text-yellow-200"
    >
      {{ errorMessage }}
    </p>
    <ul
      v-else
      class="mt-2 space-y-1 text-sm"
    >
      <li
        v-for="library in discovery.libraries"
        :key="library.id"
      >
        {{ library.name }} · music · {{ library.isPresent ? 'present at last sync' : 'not seen at last sync' }} · read-only
      </li>
    </ul>
    <p
      v-if="discovery?.truncated"
      class="mt-2 text-sm text-gray-300"
    >
      More source sections exist; showing the first 64.
    </p>
  </section>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import api from '@/api'
import { parseSourceLibraryDiscovery } from '@/utils/sourceLibraryDiscovery'

const props = defineProps({ refreshKey: { type: Number, default: 0 } })
const discovery = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const available = ref(true)
let requestId = 0

async function load() {
  const current = ++requestId
  loading.value = true
  try {
    const parsed = parseSourceLibraryDiscovery(await api.getSourceLibraryDiscovery())
    if (!parsed) throw new TypeError('Invalid source library discovery response')
    if (current !== requestId) return
    discovery.value = parsed
    errorMessage.value = ''
  } catch (error) {
    if (current !== requestId) return
    if (Number(error?.response?.status) === 403) available.value = false
    else errorMessage.value = 'Source library discovery is unavailable. Try again later.'
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(() => props.refreshKey, () => { void load() }, { immediate: true })
onBeforeUnmount(() => { requestId++ })
</script>
