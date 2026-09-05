<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    aria-labelledby="identity-recovery-heading"
    class="space-y-3 rounded border border-gray-500 bg-gray-800 p-4"
  >
    <h2
      id="identity-recovery-heading"
      class="text-lg font-semibold"
    >
      Confirmation receipt
    </h2>
    <p
      role="status"
      aria-live="polite"
    >
      {{ notice }}
    </p>
    <dl
      v-if="receipt"
      class="space-y-1"
    >
      <div>
        <dt class="inline font-semibold">
          Audit receipt:
        </dt><dd class="inline">
          {{ receipt.auditId }}
        </dd>
      </div>
      <div>
        <dt class="inline font-semibold">
          Confirmed identity:
        </dt><dd class="inline">
          TMDb {{ receipt.mediaType === 'tv' ? 'TV series' : 'movie' }} {{ receipt.tmdbId }}
        </dd>
      </div>
      <div>
        <dt class="inline font-semibold">
          Recorded:
        </dt><dd class="inline">
          <time :datetime="receipt.confirmedAt">{{ receipt.confirmedAt }}</time>
        </dd>
      </div>
    </dl>
    <div class="flex flex-wrap gap-3">
      <button
        v-if="!receipt"
        type="button"
        :disabled="phase === 'checking'"
        class="rounded bg-primary-dark px-3 py-2 text-white"
        @click="$emit('check')"
      >
        Check receipt again
      </button>
      <button
        type="button"
        :disabled="phase === 'checking'"
        class="rounded border border-gray-400 px-3 py-2"
        @click="$emit('dismiss')"
      >
        {{ receipt ? 'Return to review queue' : 'Return to queue without a confirmed outcome' }}
      </button>
    </div>
  </section>
</template>

<script setup>
defineProps({ phase: { type: String, required: true }, receipt: { type: Object, default: null }, notice: { type: String, required: true } })
defineEmits(['check', 'dismiss'])
</script>
