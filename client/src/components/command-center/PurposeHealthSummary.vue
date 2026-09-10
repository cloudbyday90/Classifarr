<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="shouldRender"
    id="library-purpose-health"
    class="purpose-health"
    aria-labelledby="library-purpose-health-heading"
  >
    <div class="purpose-health-heading-row">
      <div>
        <h2 id="library-purpose-health-heading">
          Library purpose health
        </h2>
        <p class="purpose-health-intro">
          A compact check that active library policies express distinct, declared destinations.
        </p>
      </div>
      <span
        v-if="health"
        class="purpose-health-status"
        :class="`purpose-health-status-${health.statusId}`"
      >{{ statusLabel }}</span>
    </div>

    <p
      v-if="loading && !health"
      class="purpose-health-message"
      role="status"
    >
      Checking library purpose health…
    </p>
    <p
      v-else-if="errorMessage"
      class="purpose-health-message purpose-health-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <template v-else-if="health">
      <p class="purpose-health-summary">
        {{ summaryText }}
      </p>
      <ul
        v-if="attentionItems.length"
        class="purpose-health-exceptions"
      >
        <li
          v-for="item in attentionItems"
          :key="item.id"
        >
          {{ item.label }}
        </li>
      </ul>
      <p
        v-if="health.statusId === STATUS_IDS.REVIEW_WINDOW_TRUNCATED"
        class="purpose-health-note"
      >
        This safe snapshot is capped at a bounded policy window. Open the detailed review before treating it as complete.
      </p>
      <p
        v-else-if="health.statusId === STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY"
        class="purpose-health-note"
      >
        No active validated native policies are available to assess yet.
      </p>
      <RouterLink
        :to="{ name: 'PolicyNativeIntentReconciliation', query: { focus: 'purpose-coverage' } }"
        class="purpose-health-link"
      >
        {{ attentionItems.length ? 'Review exceptions' : 'Open detailed review' }} <span aria-hidden="true">→</span>
      </RouterLink>
      <p class="purpose-health-boundary">
        Read-only summary. It does not change routing, invoke AI/RAG, or change learning.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { POLICY_PURPOSE_HEALTH_STATUS_IDS as STATUS_IDS } from '@/utils/policyPurposeHealth'

const props = defineProps({
  health: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
})

const shouldRender = computed(() => Boolean(props.health || props.loading || props.errorMessage))
const summary = computed(() => props.health?.summary || {})

const statusLabel = computed(() => {
  switch (props.health?.statusId) {
    case STATUS_IDS.READY:
      return 'Ready'
    case STATUS_IDS.ATTENTION_REQUIRED:
      return `${summary.value.needsAttentionLibraryCount} need review`
    case STATUS_IDS.REVIEW_WINDOW_TRUNCATED:
      return 'Window limited'
    default:
      return 'Not assessed'
  }
})

const summaryText = computed(() => {
  const reviewedCount = summary.value.reviewedLibraryCount || 0
  const declaredCount = summary.value.declaredPurposeLibraryCount || 0
  return `${declaredCount} of ${reviewedCount} assessed libraries have a declared purpose.`
})

const attentionItems = computed(() => {
  if (!props.health) return []
  const items = []
  const counts = summary.value
  if (counts.missingPurposeLibraryCount > 0) {
    items.push({ id: 'missing', label: `${counts.missingPurposeLibraryCount} lack a declared purpose.` })
  }
  if (counts.competingDestinationLibraryCount > 0) {
    items.push({ id: 'competing', label: `${counts.competingDestinationLibraryCount} have a competing destination.` })
  }
  if (counts.profileDerivedPurposeLibraryCount > 0) {
    items.push({ id: 'profile', label: `${counts.profileDerivedPurposeLibraryCount} still rely on observed profile suggestions.` })
  }
  if (counts.unverifiedPurposeLibraryCount > 0) {
    items.push({ id: 'source', label: `${counts.unverifiedPurposeLibraryCount} require a purpose-source review.` })
  }
  return items
})
</script>

<style scoped>
.purpose-health {
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  background: #1f2937;
}

.purpose-health-heading-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #f3f4f6;
}

.purpose-health-intro,
.purpose-health-boundary,
.purpose-health-note {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: #9ca3af;
}

.purpose-health-status {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid #4b5563;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.purpose-health-status-ready {
  border-color: #166534;
  color: #86efac;
}

.purpose-health-status-attention_required,
.purpose-health-status-review_window_truncated {
  border-color: #92400e;
  color: #fcd34d;
}

.purpose-health-status-no_active_validated_native_policy {
  color: #d1d5db;
}

.purpose-health-message,
.purpose-health-summary {
  margin: 0.875rem 0 0;
  color: #e5e7eb;
  font-size: 0.875rem;
}

.purpose-health-error {
  color: #fca5a5;
}

.purpose-health-exceptions {
  display: grid;
  gap: 0.375rem;
  margin: 0.75rem 0 0;
  padding-left: 1.125rem;
  color: #d1d5db;
  font-size: 0.8125rem;
}

.purpose-health-link {
  display: inline-block;
  margin-top: 0.875rem;
  color: #93c5fd;
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
}

.purpose-health-link:hover {
  color: #bfdbfe;
  text-decoration: underline;
}

.purpose-health-boundary {
  margin-top: 0.75rem;
}

@media (max-width: 1023px) {
  .purpose-health {
    padding: 1rem;
  }
}
</style>
