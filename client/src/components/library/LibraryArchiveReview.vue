<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="border border-gray-600 rounded-lg p-4 space-y-3"
    aria-label="Library archive review"
  >
    <h3 class="font-semibold">
      Archive or restore library
    </h3>
    <p class="text-sm">
      Keep local data. Never delete media files. Administrator review required.
    </p>
    <Button
      :disabled="busy || !!pending"
      @click="refresh"
    >
      {{ opened ? 'Refresh archive review' : 'Review archive status' }}
    </Button>
    <p
      v-if="opened && loading"
      role="status"
    >
      Checking library…
    </p>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="preview && !receipt">
      <p role="status">
        {{ explanation }}
      </p>
      <p>{{ preview.library.name }} — {{ preview.itemCount }} inventory items preserved.</p>
      <p class="text-sm">
        {{ preview.effect }}
      </p>
      <template v-if="preview.canConfirm">
        <label class="flex items-start gap-2">
          <input
            v-model="acknowledged"
            type="checkbox"
            :disabled="busy || !!pending"
          >
          <span>I reviewed this change and verified older instances and external writers for this library are stopped.</span>
        </label>
        <Button
          :disabled="!acknowledged || busy || !!error && !pending"
          @click="confirm"
        >
          {{ pending ? 'Retry same confirmation' : preview.operation === 'archive' ? 'Archive reviewed library' : 'Restore library (keep disabled)' }}
        </Button>
      </template>
    </template>
    <Button
      v-if="pending"
      :disabled="busy"
      variant="secondary"
      @click="checkOutcome"
    >
      Check recorded outcome
    </Button>
    <p
      v-if="receipt"
      role="status"
    >
      {{ receipt.operation === 'archive' ? 'Archived' : 'Restored' }} — receipt #{{ receipt.auditId }}. Library remains disabled.
    </p>
  </section>
</template>
<script setup>
import { computed, toRef } from 'vue'
import Button from '@/components/common/Button.vue'
import { useLibraryArchiveReview } from '@/composables/useLibraryArchiveReview'
const props = defineProps({ libraryId: { type: Number, required: true } })
const emit = defineEmits(['changed'])
const { opened, preview, acknowledged, receipt, busy, error, pending, loading, refresh, confirm, checkOutcome } =
  useLibraryArchiveReview(toRef(props, 'libraryId'), () => emit('changed'))
const explanations = {
  active_owner: 'An import is active. Wait for it to stop, then review again.',
  unfinished_import: 'Unfinished import records need recovery before archiving. Review import status above.',
  disable_library: 'Turn off “Library enabled” and save before reviewing again.',
  still_visible: 'The media server still returns this library. No archive is needed; you can leave it disabled.',
  ready: 'Ready for your confirmation. Inventory and history will be kept.',
}
const explanation = computed(() => explanations[preview.value?.reason] ?? 'Review unavailable; nothing will be changed.')
</script>
