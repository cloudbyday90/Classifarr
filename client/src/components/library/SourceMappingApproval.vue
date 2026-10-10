<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section aria-label="Approve complete source mapping">
    <p>Saving a mapping keeps the source grouping unchanged. No Plex, Emby or Jellyfin data is edited. All source seasons must pass verification; partial mappings cannot clear this issue.</p>
    <label>
      <input
        v-model="confirmed"
        type="checkbox"
        :disabled="busy || attempted"
      >
      I reviewed the proposed catalog mapping and want Classifarr to use it for this source item.
    </label>
    <button
      type="button"
      :disabled="!confirmed || busy || attempted"
      @click="approve"
    >
      Save mapping for recovery
    </button>
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ busy ? 'Rechecking evidence and saving approval…' : notice }}
    </p>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>
<script setup>
import { useSourceMappingApproval } from '@/composables/useSourceMappingApproval'
const props = defineProps({ draft: { type: Object, required: true }, evidence: { type: Object, required: true }, offset: { type: Number, required: true } })
const { confirmed, busy, attempted, error, notice, approve } = useSourceMappingApproval(() => ({ key: props.draft.sourceKey,
  body: { offset: props.offset, sourceVersion: props.draft.sourceVersion,
    scope: props.draft.scope, evidenceFingerprint: props.evidence.evidenceFingerprint } }))
</script>
<style scoped>
section { padding: 1rem; margin-top: .75rem; border: 1px solid #64748b; border-radius: .4rem; }
p { margin: .75rem 0; overflow-wrap: anywhere; }
label { display: flex; align-items: center; gap: .6rem; min-height: 2.75rem; }
button { min-height: 2.75rem; padding: .5rem .75rem; margin-top: .75rem; border: 1px solid #64748b; border-radius: .4rem; color: #bfdbfe; }
button:disabled { opacity: .5; cursor: not-allowed; }
:is(button, input):focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>
