<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="border border-gray-600 rounded-lg p-4 space-y-3"
    aria-label="Legacy import review"
  >
    <h3 class="font-semibold">
      Review older import records
    </h3>
    <p class="text-sm text-gray-300">
      Administrator maintenance only. Imported media is preserved; this does not finish an import.
    </p>
    <Button
      :disabled="busy || !!pending"
      @click="refresh"
    >
      {{ opened ? 'Refresh review' : 'Review blocked import' }}
    </Button>
    <p
      v-if="opened && loading"
      role="status"
    >
      Loading review…
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
      <p class="text-sm">
        {{ preview.syncs.length }} unfinished sync records; {{ preview.capture ? '1 unfinished source capture' : 'no unfinished source capture' }}.
      </p>
      <details>
        <summary class="cursor-pointer">
          Records to reconcile
        </summary>
        <ul class="list-disc pl-5 mt-2 text-sm">
          <li
            v-for="sync in preview.syncs"
            :key="sync.id"
          >
            Sync #{{ sync.id }} — {{ sync.status }}; {{ sync.processed ?? 0 }} items processed.
          </li>
          <li v-if="preview.capture">
            Capture generation {{ preview.capture.generation }} — {{ preview.capture.source }}.
          </li>
        </ul>
      </details>
      <template v-if="preview.canReconcile">
        <p class="text-sm">
          Stop older Classifarr instances and external capture scripts first. An absent lock cannot prove they stopped.
        </p>
        <label class="flex items-start gap-2">
          <input
            v-model="acknowledged"
            type="checkbox"
            class="mt-1"
            :disabled="busy || !!pending"
          >
          <span>I verified that older instances and external capture scripts for this library have stopped and will remain stopped during recovery.</span>
        </label>
        <Button
          :disabled="!acknowledged || busy || !!error && !pending"
          @click="confirm"
        >
          {{ pending ? 'Retry same confirmation' : 'Reconcile reviewed records' }}
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
    <div
      v-if="receipt"
      role="status"
    >
      <p>Reconciliation recorded — receipt #{{ receipt.auditId }}.</p>
      <p class="text-sm">
        When older workers remain stopped, enable this library and save. The scheduler will replay the import; learning waits for completion.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, toRef } from 'vue'
import Button from '@/components/common/Button.vue'
import { useLegacyIngestionReview } from '@/composables/useLegacyIngestionReview'
const props = defineProps({ libraryId: { type: Number, required: true } })
const emit = defineEmits(['reconciled'])
const { opened, preview, acknowledged, receipt, busy, error, pending, loading, refresh, confirm, checkOutcome } =
  useLegacyIngestionReview(toRef(props, 'libraryId'), () => emit('reconciled'))
const explanations = {
  disable_library: 'Turn off “Library enabled” above and save, then refresh this review.',
  active_owner: 'A current import still owns this library. Wait for it to stop; do not force takeover.',
  too_many_markers: 'Too many unfinished records for a safe single review. No records will be changed.',
  not_needed: 'No legacy reconciliation is needed. Owned imports use automatic recovery.',
  unsupported_library: 'Only movie and TV libraries with a media server can be reconciled.',
  confirmation_required: 'Ready for your stopped-worker confirmation. The library will remain disabled.',
}
const explanation = computed(() => explanations[preview.value?.reason] ?? 'Review unavailable; no records will be changed.')
</script>
