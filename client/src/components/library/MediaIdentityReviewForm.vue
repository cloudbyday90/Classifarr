<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="rounded-lg border border-gray-600 bg-gray-800 p-5 space-y-5 break-words"
    aria-labelledby="identity-review-heading"
  >
    <h2
      id="identity-review-heading"
      ref="heading"
      tabindex="-1"
      class="text-xl font-semibold"
    >
      Review {{ source.title }}
    </h2>
    <div class="grid gap-5 md:grid-cols-2">
      <div class="min-w-0 space-y-2">
        <h3 class="font-semibold">
          Source item
        </h3>
        <p>{{ source.title }} · {{ source.year || 'Year unknown' }} · {{ typeLabel }}</p>
        <p>Library: {{ source.libraryName || 'Unknown library' }}</p>
        <p v-if="source.imdbId">
          IMDb: {{ source.imdbId }}
        </p>
        <p v-if="source.tvdbId">
          TVDB: {{ source.tvdbId }}
        </p>
        <p class="text-gray-300">
          {{ mediaIdentityReviewReason(source.reason) }}
        </p>
      </div>
      <div
        v-if="preview"
        class="min-w-0 space-y-2"
      >
        <h3
          ref="candidateHeading"
          tabindex="-1"
          class="font-semibold"
        >
          TMDb candidate
        </h3>
        <p>{{ preview.candidate.title }} · {{ preview.candidate.releaseDate || 'Date unknown' }} · {{ typeLabel }}</p>
        <p v-if="preview.candidate.originalTitle">
          Original title: {{ preview.candidate.originalTitle }}
        </p>
        <p>TMDb ID: {{ preview.candidate.tmdbId }}</p>
        <p
          v-if="preview.candidate.overview"
          class="text-gray-300"
        >
          {{ preview.candidate.overview }}
        </p>
      </div>
    </div>
    <form
      v-if="!preview"
      class="space-y-3"
      @submit.prevent="$emit('prepare', tmdbId)"
    >
      <label
        for="review-tmdb-id"
        class="block font-medium"
      >TMDb {{ typeLabel }} ID</label>
      <input
        id="review-tmdb-id"
        v-model="tmdbId"
        required
        inputmode="numeric"
        pattern="[1-9][0-9]{0,9}"
        maxlength="10"
        autocomplete="off"
        aria-describedby="review-id-help"
        :disabled="busy"
        class="block w-full max-w-sm rounded border border-gray-500 bg-gray-900 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
      <p
        id="review-id-help"
        class="text-sm text-gray-300"
      >
        Enter the numeric ID for this {{ typeLabel }} on TMDb. Check the title, date and description in the preview.
      </p>
      <button
        type="submit"
        :disabled="busy"
        class="rounded bg-primary-dark px-4 py-2 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Preview identity
      </button>
    </form>
    <div
      v-else
      class="space-y-3"
    >
      <p class="text-sm text-gray-300">
        Preview expires {{ new Date(preview.expiresAt).toLocaleString() }}. A new preview replaces your previous one.
      </p>
      <label class="flex items-start gap-3">
        <input
          v-model="verified"
          type="checkbox"
          :disabled="busy"
          class="mt-1 h-5 w-5"
        >
        <span>I verified that this TMDb candidate is the same {{ typeLabel }} as the source item.</span>
      </label>
      <p class="text-sm text-gray-300">
        Confirmation saves the ID and an audit receipt. Classification remains a separate action.
      </p>
      <button
        type="button"
        :disabled="busy || !verified"
        class="rounded bg-primary-dark px-4 py-2 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        @click="$emit('confirm')"
      >
        Confirm identity
      </button>
    </div>
    <button
      type="button"
      :disabled="busy && !!preview"
      class="rounded px-3 py-2 underline focus-visible:outline focus-visible:outline-2"
      @click="$emit('cancel')"
    >
      Back to review queue
    </button>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { mediaIdentityReviewReason } from '@/utils/mediaIdentityReviewReasons'

const props = defineProps({ source: { type: Object, required: true }, preview: { type: Object, default: null }, busy: Boolean })
defineEmits(['prepare', 'confirm', 'cancel'])
const heading = ref(null)
const candidateHeading = ref(null)
const tmdbId = ref('')
const verified = ref(false)
const typeLabel = computed(() => props.source.mediaType === 'tv' ? 'TV series' : 'movie')
onMounted(() => heading.value?.focus())
watch(() => props.preview, async value => {
  verified.value = false
  await nextTick()
  if (value) candidateHeading.value?.focus()
  else heading.value?.focus()
})
</script>
