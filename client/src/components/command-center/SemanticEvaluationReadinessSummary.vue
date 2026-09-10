<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="shouldRender"
    id="semantic-evaluation-readiness"
    class="semantic-evaluation-readiness"
    aria-labelledby="semantic-evaluation-readiness-heading"
  >
    <div class="semantic-evaluation-readiness-heading-row">
      <div>
        <h2 id="semantic-evaluation-readiness-heading">
          Semantic evaluation
        </h2>
        <p class="semantic-evaluation-readiness-intro">
          Tracks whether Classifarr has enough protected evidence to measure whether metadata and RAG improve library placement.
        </p>
      </div>
      <span
        v-if="readiness"
        class="semantic-evaluation-readiness-status"
        :class="`semantic-evaluation-readiness-status-${readiness.statusId}`"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >{{ statusLabel }}</span>
    </div>

    <p
      v-if="loading && !readiness"
      class="semantic-evaluation-readiness-message"
      role="status"
    >
      Checking semantic evaluation readiness…
    </p>
    <p
      v-else-if="errorMessage"
      class="semantic-evaluation-readiness-message semantic-evaluation-readiness-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <template v-else-if="readiness">
      <p class="semantic-evaluation-readiness-summary">
        {{ summaryText }}
      </p>
      <RouterLink
        :to="{ name: 'PolicyNativeIntentReconciliation', hash: '#held-out-semantic-study-readiness' }"
        class="semantic-evaluation-readiness-link"
      >
        See evaluation details <span aria-hidden="true">→</span>
      </RouterLink>
      <p class="semantic-evaluation-readiness-boundary">
        Updates automatically while this page is open. It does not label media, tune AI/RAG, or change routing.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  HELD_OUT_SEMANTIC_STUDY_READINESS_STATUS_IDS as STATUS_IDS,
  normalizeHeldOutSemanticStudyReadiness,
} from '@/utils/heldOutSemanticStudyReadiness'

const props = defineProps({
  readiness: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
})

const readiness = computed(() => normalizeHeldOutSemanticStudyReadiness(props.readiness))
const shouldRender = computed(() => Boolean(readiness.value || props.loading || props.errorMessage))

const statusLabel = computed(() => {
  if (readiness.value?.privateCohortCaptureReady) return 'Private capture ready'
  switch (readiness.value?.statusId) {
    case STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE:
      return 'Checking evidence'
    case STATUS_IDS.COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED:
      return 'Needs policy evidence'
    case STATUS_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED:
      return 'Building baseline'
    default:
      return 'Not assessed'
  }
})

const summaryText = computed(() => {
  if (readiness.value?.privateCohortCaptureReady) {
    return 'The automatic aggregate audit found a balanced policy-only frame. A controlled private capture can now prepare a redacted reviewer packet; nothing is retained, routed, or labeled automatically.'
  }
  switch (readiness.value?.statusId) {
    case STATUS_IDS.ELIGIBILITY_AUDIT_AVAILABLE:
      return 'Policy evidence is available for the next private eligibility check. A study still requires a bounded cohort and independently reviewed labels before semantic quality can be measured.'
    case STATUS_IDS.COMPLETE_DECLARED_PURPOSE_EVIDENCE_REQUIRED:
      return 'Normal policy activity is present, but current declared-purpose evidence is incomplete. Classifarr will reassess after ordinary policy updates; no study action is needed here.'
    case STATUS_IDS.NORMAL_LIFECYCLE_RECEIPT_REQUIRED:
      return 'Classifarr is waiting for ordinary policy lifecycle activity before it can assess semantic evaluation. It will reassess automatically; no study action is needed here.'
    default:
      return 'Classifarr cannot currently confirm whether semantic evaluation has its protected prerequisites.'
  }
})
</script>

<style scoped>
.semantic-evaluation-readiness {
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  background: #1f2937;
}

.semantic-evaluation-readiness-heading-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.semantic-evaluation-readiness h2 {
  font-size: 1rem;
  font-weight: 700;
  color: #f3f4f6;
}

.semantic-evaluation-readiness-intro,
.semantic-evaluation-readiness-summary,
.semantic-evaluation-readiness-message,
.semantic-evaluation-readiness-boundary {
  max-width: 58rem;
  color: #d1d5db;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.semantic-evaluation-readiness-intro {
  margin-top: 0.25rem;
  color: #9ca3af;
}

.semantic-evaluation-readiness-status {
  flex: none;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.semantic-evaluation-readiness-status-eligibility_audit_available {
  background: rgba(59, 130, 246, 0.15);
  color: #bfdbfe;
}

.semantic-evaluation-readiness-status-complete_declared_purpose_evidence_required,
.semantic-evaluation-readiness-status-normal_lifecycle_receipt_required,
.semantic-evaluation-readiness-status-held_out_semantic_study_readiness_unavailable {
  background: rgba(245, 158, 11, 0.15);
  color: #fde68a;
}

.semantic-evaluation-readiness-message,
.semantic-evaluation-readiness-summary {
  margin-top: 1rem;
}

.semantic-evaluation-readiness-error {
  color: #fca5a5;
}

.semantic-evaluation-readiness-link {
  display: inline-block;
  margin-top: 0.75rem;
  color: #93c5fd;
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
}

.semantic-evaluation-readiness-link:hover {
  color: #bfdbfe;
  text-decoration: underline;
}

.semantic-evaluation-readiness-boundary {
  margin-top: 0.75rem;
  color: #9ca3af;
}

@media (max-width: 1023px) {
  .semantic-evaluation-readiness {
    padding: 1rem;
  }
}
</style>
