<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-5">
    <RouterLink
      to="/libraries"
      class="underline"
    >
      Back to Libraries
    </RouterLink>
    <h1
      ref="heading"
      tabindex="-1"
      class="text-2xl font-bold"
    >
      Review media IDs
    </h1>
    <p class="max-w-3xl text-gray-300">
      Verify unresolved inventory identities using TMDb details. An active administrator account is required to review and confirm an ID.
    </p>
    <p
      role="status"
      aria-live="polite"
      class="text-gray-300"
    >
      {{ status }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="rounded border border-red-400 p-3 text-red-200"
    >
      {{ error }}
    </p>
    <MediaIdentityReviewForm
      v-if="selected"
      :key="selected.id"
      :source="selected"
      :preview="preview"
      :busy="busy"
      @prepare="prepare"
      @confirm="save"
      @cancel="cancel"
    />
    <template v-else>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label
            for="review-media-type"
            class="mb-1 block"
          >Media type</label>
          <select
            id="review-media-type"
            v-model="mediaType"
            :disabled="busy"
            class="rounded border border-gray-500 bg-gray-800 p-2"
            @change="load()"
          >
            <option value="">
              Movies and TV series
            </option>
            <option value="movie">
              Movies
            </option>
            <option value="tv">
              TV series
            </option>
          </select>
        </div>
        <button
          type="button"
          :disabled="busy"
          class="rounded border border-gray-500 px-3 py-2"
          @click="load()"
        >
          Refresh queue
        </button>
      </div>
      <ul
        class="space-y-3"
        aria-label="Items needing identity review"
      >
        <li
          v-for="item in items"
          :key="item.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-700 bg-gray-800 p-4"
        >
          <div>
            <h2 class="font-semibold">
              {{ item.title }} · {{ item.year || 'Year unknown' }}
            </h2>
            <p class="text-sm text-gray-300">
              {{ item.libraryName || 'Unknown library' }} · {{ item.mediaType === 'tv' ? 'TV series' : 'Movie' }}
            </p>
            <p class="mt-1 text-gray-300">
              {{ mediaIdentityReviewReason(item.reason) }}
            </p>
          </div>
          <button
            type="button"
            :disabled="busy"
            :aria-label="`Review ${item.title}`"
            class="rounded border border-gray-400 px-3 py-2"
            @click="select(item)"
          >
            Review
          </button>
        </li>
      </ul>
      <p v-if="!busy && !error && !items.length">
        No items currently need identity review for this filter.
      </p>
      <button
        v-if="nextCursor"
        type="button"
        :disabled="busy"
        class="rounded border border-gray-500 px-3 py-2"
        @click="load(true)"
      >
        Load more items
      </button>
    </template>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import MediaIdentityReviewForm from '@/components/library/MediaIdentityReviewForm.vue'
import { useMediaIdentityReview } from '@/composables/useMediaIdentityReview'
import { mediaIdentityReviewReason } from '@/utils/mediaIdentityReviewReasons'

const { items, mediaType, nextCursor, selected, preview, busy, error, status, select, load, prepare, confirm } = useMediaIdentityReview()
const heading = ref(null)
onMounted(() => load())
async function cancel() {
  select(null)
  await nextTick()
  heading.value?.focus()
}
async function save() {
  await confirm()
  await nextTick()
  if (!selected.value) heading.value?.focus()
}
</script>
