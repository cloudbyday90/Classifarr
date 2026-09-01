<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="presentation"
    class="pending-question-review-summary"
    :aria-labelledby="headingId"
  >
    <h4 :id="headingId">
      {{ presentation.heading }}
    </h4>
    <dl>
      <div>
        <dt>{{ presentation.destination_label }}</dt>
        <dd class="pending-question-review-summary-destination">
          {{ presentation.destination }}
        </dd>
      </div>
      <div>
        <dt>{{ presentation.review_label }}</dt>
        <dd>{{ presentation.review_message }}</dd>
      </div>
      <div>
        <dt>{{ presentation.action_label }}</dt>
        <dd>{{ presentation.action_message }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  itemId: {
    type: [Number, String],
    required: true,
  },
  presentation: {
    type: Object,
    default: () => null,
  },
})

const headingId = computed(() => {
  const safeId = String(props.itemId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  return `pending-question-review-summary-${safeId || 'item'}`
})
</script>

<style scoped>
.pending-question-review-summary {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.35);
  font-size: 0.75rem;
  color: #cbd5e1;
}

.pending-question-review-summary h4,
.pending-question-review-summary dl,
.pending-question-review-summary dt,
.pending-question-review-summary dd {
  margin: 0;
}

.pending-question-review-summary h4 {
  color: #e2e8f0;
  font-size: 0.75rem;
  font-weight: 600;
}

.pending-question-review-summary dl {
  display: grid;
  gap: 0.5rem;
}

.pending-question-review-summary dl > div {
  display: grid;
  gap: 0.125rem;
}

.pending-question-review-summary dt {
  color: #bfdbfe;
  font-weight: 600;
}

.pending-question-review-summary dd {
  color: #cbd5e1;
}

.pending-question-review-summary-destination {
  color: #f3f4f6 !important;
  font-weight: 600;
}
</style>
