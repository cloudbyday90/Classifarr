<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="activity">
    <p v-if="!activity">
      Policy-work and AI-capture status are not available from this server. Saved comparison counts are shown separately.
    </p>
    <template v-else>
      <h3>Latest policy work</h3>
      <template v-if="activity.policy.counts">
        <p><strong>{{ activity.policy.counts.cases }} cases evaluated by policy replay.</strong> No AI calls were needed for this pass.</p>
        <p>
          With source evidence: {{ activity.policy.counts.sourceAware.automatic }} automatic ·
          {{ activity.policy.counts.sourceAware.review }} review · {{ activity.policy.counts.sourceAware.manual }} manual ·
          {{ activity.policy.counts.sourceAware.unavailable }} unavailable.
        </p>
        <p>
          Baseline: {{ activity.policy.counts.baseline.automatic }} automatic ·
          {{ activity.policy.counts.baseline.review }} review · {{ activity.policy.counts.baseline.manual }} manual ·
          {{ activity.policy.counts.baseline.unavailable }} unavailable.
        </p>
        <p>These are replay outcomes, not media moved or an accuracy score.</p>
      </template>
      <p v-else>
        {{ evaluationPolicyStatus[activity.policy.status] }}
      </p>
      <p v-if="activity.policy.observedAt">
        Policy snapshot: <time :datetime="activity.policy.observedAt">{{ new Date(activity.policy.observedAt).toLocaleString() }}</time>.
      </p>
      <h3>AI-response capture</h3>
      <p v-if="activity.capture.enabled === false">
        <strong>Disabled — no AI calls are scheduled for evaluation capture.</strong>
        An administrator must explicitly configure a capture budget to fill supported response-cache gaps.
        Enabling capture does not repair unsupported comparison paths.
      </p>
      <p v-else-if="activity.capture.enabled === true">
        <strong>Budget configured:</strong> {{ activity.capture.dailyCalls }} calls and {{ activity.capture.dailyTokens }} tokens per UTC day.
        This does not guarantee capture can run; worker admission and safeguards still apply.
        Last saved capture outcome: {{ evaluationCaptureOutcome[activity.capture.lastOutcome] }}.
        Reservations for {{ activity.capture.quotaDay }} (UTC): {{ activity.capture.callsReserved }} calls,
        {{ activity.capture.tokensReserved }} tokens. Reservations are not measured usage.
      </p>
      <p v-else>
        Capture configuration is unknown. No disabled or ready state is assumed.
      </p>
      <p>
        Status checked: <time :datetime="activity.checkedAt">{{ new Date(activity.checkedAt).toLocaleString() }}</time>.
        Policy work and comparison history are separate snapshots; do not add their counts.
      </p>
    </template>
  </div>
</template>

<script setup>
import { evaluationPolicyStatus, evaluationCaptureOutcome } from '@/utils/evaluationActivity'
defineProps({ activity: { type: Object, default: null } })
</script>

<style scoped>
h3 { font-weight: 600; margin-top: .75rem; }
p { margin-top: .4rem; font-size: .875rem; line-height: 1.5; }
</style>
