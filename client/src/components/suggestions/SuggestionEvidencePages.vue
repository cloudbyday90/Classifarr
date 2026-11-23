<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section :aria-labelledby="headingId">
    <h4
      :id="headingId"
      class="font-semibold"
    >
      Supporting Evidence
    </h4>
    <p
      role="status"
      aria-atomic="true"
      class="my-2 text-sm text-gray-300"
    >
      {{ statusMessage }}
    </p>
    <button
      v-if="showAction"
      type="button"
      :aria-disabled="!canLoad"
      class="mb-3 rounded border border-gray-500 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary aria-disabled:opacity-60"
      @click="loadNext"
    >
      {{ state === 'error' ? 'Retry evidence' : 'Next page' }}
    </button>
    <ul
      v-if="page?.items.length"
      role="list"
      class="space-y-2"
    >
      <li
        v-for="item in page.items"
        :key="item.position"
        class="rounded bg-background p-3 text-sm wrap-anywhere"
      >
        <p
          v-if="item.status === 'unavailable'"
          class="text-gray-300"
        >
          Evidence reference {{ item.position }} is unavailable.
        </p>
        <template v-else>
          <p class="font-medium">
            {{ item.title || 'Untitled item' }}
          </p>
          <p class="text-gray-300">
            {{ correctionLabel(item.wasCorrection) }}
          </p>
          <dl class="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <dt>Original library</dt>
            <dd>{{ item.originalLibrary || 'Unknown' }}</dd>
            <dt>Selected library</dt>
            <dd>{{ item.selectedLibrary || 'Unknown' }}</dd>
          </dl>
        </template>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId } from 'vue'
import api from '@/api'
import { isSuggestionAdministratorRefusal } from '@/utils/suggestionReviewErrors'

const props = defineProps({
  suggestionId: { type: [Number, String], required: true },
})

const headingId = `suggestion-evidence-${useId()}`
const page = shallowRef(null)
const state = ref('loading')
const usedAction = ref(false)
let requestedAfter
let active = true

const canLoad = computed(() => state.value === 'error' ||
  (state.value === 'ready' && page.value?.nextAfterPosition != null))
const showAction = computed(() => canLoad.value || usedAction.value)
const statusMessage = computed(() => {
  if (state.value === 'loading') return 'Loading supporting evidence…'
  if (state.value === 'error') return 'Could not load supporting evidence. Try again.'
  if (state.value === 'restricted') return 'Only administrators can view supporting evidence.'
  if (page.value?.referenceCount == null) return 'Supporting evidence is unavailable.'
  if (page.value.referenceCount === 0) return 'No supporting evidence.'
  const { items, referenceCount } = page.value
  if (!items.length) return 'No evidence at this position.'
  const unavailable = items.filter(item => item.status === 'unavailable').length
  const range = items.length === 1 ? items[0].position : `${items[0].position}–${items.at(-1).position}`
  return `Evidence references ${range} of ${referenceCount}.${unavailable ? ` ${unavailable} unavailable.` : ''}`
})

function correctionLabel(value) {
  if (value === true) return 'Correction recorded'
  if (value === false) return 'No correction recorded'
  return 'Correction status unknown'
}

async function loadPage() {
  state.value = 'loading'
  try {
    const result = await api.getSuggestionEvidence(props.suggestionId, requestedAfter)
    if (!active) return
    if (String(result?.suggestionId) !== String(props.suggestionId) || !Array.isArray(result?.items) ||
        result.items.length > 20 || result.items.some(item => !Number.isInteger(item?.position))) {
      throw new Error('Invalid suggestion evidence response')
    }
    page.value = result
    state.value = 'ready'
  } catch (error) {
    if (!active) return
    const status = error?.response?.status
    if ([401, 403, 404].includes(status)) page.value = null
    if (isSuggestionAdministratorRefusal(error)) state.value = 'restricted'
    else state.value = status === 404 ? 'unavailable' : 'error'
  }
}

function loadNext() {
  if (!canLoad.value) return
  usedAction.value = true
  if (state.value !== 'error') requestedAfter = page.value.nextAfterPosition
  void loadPage()
}

onMounted(loadPage)
onBeforeUnmount(() => { active = false })
</script>
