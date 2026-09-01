<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">
        Security Settings
      </h2>
      <p class="text-gray-400 text-sm">
        Manage API keys for third-party integrations and automation
      </p>
    </div>

    <section
      class="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4"
      aria-labelledby="review-corpus-control-heading"
    >
      <div>
        <h3
          id="review-corpus-control-heading"
          class="text-lg font-medium"
        >
          Reviewed Corpus Safeguards
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          After acknowledgement, eligible future operator decisions are captured automatically as redacted evaluation rows. Historic records remain unavailable, and capture gives AI, RAG, policy, and routing no authority.
        </p>
      </div>

      <div
        class="rounded-md border border-gray-700 bg-gray-900/40 p-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <template v-if="reviewCorpusControlPresentation">
          <p
            class="font-medium"
            :class="reviewCorpusControlPresentation.statusClass"
          >
            {{ reviewCorpusControlPresentation.heading }}
          </p>
          <p class="mt-1 text-sm text-gray-300">
            {{ reviewCorpusControlPresentation.message }}
          </p>
          <p
            v-if="reviewCorpusActionStatus"
            class="mt-2 text-sm text-green-400"
          >
            {{ reviewCorpusActionStatus }}
          </p>
        </template>
        <p
          v-else-if="reviewCorpusLoading"
          class="text-sm text-gray-400"
        >
          Checking reviewed-corpus safeguards…
        </p>
        <p
          v-else
          class="text-sm text-amber-300"
        >
          Reviewed-corpus safeguards are temporarily unavailable.
        </p>
      </div>

      <p
        v-if="reviewCorpusError"
        class="rounded-md bg-red-900/30 p-3 text-sm text-red-300"
        role="alert"
      >
        {{ reviewCorpusError }}
      </p>

      <form
        v-if="reviewCorpusControl"
        class="space-y-4"
        @submit.prevent="acknowledgeReviewCorpusSafeguards"
      >
        <fieldset
          class="space-y-4"
          :disabled="reviewCorpusSaving"
        >
          <div>
            <label
              for="review-record-retention-days"
              class="block text-sm font-medium text-gray-200"
            >
              Future reviewed-record retention limit (days)
            </label>
            <input
              id="review-record-retention-days"
              v-model.number="reviewRecordRetentionDays"
              type="number"
              min="7"
              max="90"
              step="1"
              class="mt-2 w-32 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
            <p class="mt-1 text-xs text-gray-400">
              This is the automatic future capture limit. No historic record access is provided.
            </p>
          </div>

          <div class="rounded-md border border-gray-700 p-4">
            <p class="text-sm font-medium text-gray-200">
              Required safeguards
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>An administrator must acknowledge the capture boundary before automatic capture starts.</li>
              <li>Classifarr stores only server-redacted outcome categories, never media, library, AI, or RAG content.</li>
              <li>Captured review rows are deleted after the selected retention limit.</li>
              <li>Capture and expiry events are recorded in an append-only operator audit trail.</li>
            </ul>
          </div>

          <label class="flex items-start gap-3 text-sm text-gray-200">
            <input
              v-model="reviewCorpusAcknowledged"
              type="checkbox"
              class="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
            >
            <span>I acknowledge these safeguards for automatic future reviewed-corpus capture.</span>
          </label>

          <button
            type="submit"
            :disabled="!reviewCorpusAcknowledged || reviewCorpusSaving"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            {{ reviewCorpusSaving ? 'Saving safeguards…' : 'Enable automatic capture' }}
          </button>
        </fieldset>
      </form>

      <details
        v-if="reviewCorpusAuditEvents.length > 0"
        class="rounded-md border border-gray-700 p-4"
      >
        <summary class="cursor-pointer text-sm font-medium text-blue-300">
          Review recent safeguard acknowledgements
        </summary>
        <ul class="mt-3 space-y-2 text-sm text-gray-300">
          <li
            v-for="event in reviewCorpusAuditEvents"
            :key="event.eventId"
          >
            Administrator #{{ event.actorId }} enabled a {{ event.reviewRecordRetentionDays }}-day automatic capture limit on {{ formatDate(event.occurredAt) }}.
          </li>
        </ul>
      </details>
    </section>

    <section
      class="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4"
      aria-labelledby="review-projection-heading"
    >
      <div>
        <h3
          id="review-projection-heading"
          class="text-lg font-medium"
        >
          Redacted Policy Evaluation Snapshot
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          A fixed representative sample for offline policy evaluation. It is read-only and never supplies AI, RAG, policy, or routing authority.
        </p>
      </div>

      <div
        class="rounded-md border border-gray-700 bg-gray-900/40 p-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <template v-if="reviewProjectionPresentation">
          <p
            class="font-medium"
            :class="reviewProjectionPresentation.statusClass"
          >
            {{ reviewProjectionPresentation.heading }}
          </p>
          <p class="mt-1 text-sm text-gray-300">
            {{ reviewProjectionPresentation.message }}
          </p>
          <p
            v-if="reviewProjectionActionStatus"
            class="mt-2 text-sm text-green-400"
          >
            {{ reviewProjectionActionStatus }}
          </p>
        </template>
        <p
          v-else-if="reviewProjectionLoading"
          class="text-sm text-gray-400"
        >
          Checking for a redacted evaluation snapshot…
        </p>
        <p
          v-else
          class="text-sm text-amber-300"
        >
          The redacted evaluation snapshot is temporarily unavailable.
        </p>
      </div>

      <p
        v-if="reviewProjectionError"
        class="rounded-md bg-red-900/30 p-3 text-sm text-red-300"
        role="alert"
      >
        {{ reviewProjectionError }}
      </p>

      <button
        v-if="reviewProjection?.statusId === 'projection_not_created'"
        type="button"
        :disabled="reviewProjectionCreating"
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
        @click="createReviewProjection"
      >
        {{ reviewProjectionCreating ? 'Creating redacted snapshot…' : 'Create redacted snapshot' }}
      </button>

      <template v-if="reviewProjection?.projection">
        <dl class="grid gap-3 text-sm sm:grid-cols-3">
          <div class="rounded-md border border-gray-700 p-3">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Snapshot created
            </dt>
            <dd class="mt-1 text-gray-200">
              {{ formatDate(reviewProjection.projection.createdAt) }}
            </dd>
          </div>
          <div class="rounded-md border border-gray-700 p-3">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Expires
            </dt>
            <dd class="mt-1 text-gray-200">
              {{ formatDate(reviewProjection.projection.expiresAt) }}
            </dd>
          </div>
          <div class="rounded-md border border-gray-700 p-3">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Sample size
            </dt>
            <dd class="mt-1 text-gray-200">
              {{ reviewProjection.projection.itemCount }} signal {{ reviewProjection.projection.itemCount === 1 ? 'row' : 'rows' }}
            </dd>
          </div>
        </dl>

        <p
          v-if="reviewProjection.projection.itemCount === 0"
          class="rounded-md border border-gray-700 p-4 text-sm text-gray-300"
        >
          No eligible attributed corrections were available in the fixed two-period evaluation frame. The snapshot will expire automatically.
        </p>

        <details
          v-else
          class="rounded-md border border-gray-700 p-4"
        >
          <summary class="cursor-pointer text-sm font-medium text-blue-300">
            Review {{ reviewProjection.projection.itemCount }} redacted signal rows
          </summary>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <caption class="mb-3 text-left text-sm text-gray-400">
                Server-selected, redacted policy-signal categories. This table has no media, library, destination, AI, provider, prompt, response, or RAG fields.
              </caption>
              <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium"
                  >
                    Period
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium"
                  >
                    Score margin
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium"
                  >
                    Operator outcome
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium"
                  >
                    Evidence states
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-700">
                <tr
                  v-for="row in reviewProjectionRows"
                  :key="row.ordinal"
                >
                  <td class="px-3 py-3 text-gray-200">
                    {{ row.periodLabel }}
                  </td>
                  <td class="px-3 py-3 text-gray-200">
                    {{ row.marginLabel }}
                  </td>
                  <td class="px-3 py-3 text-gray-200">
                    {{ row.selectionLabel }}
                  </td>
                  <td class="px-3 py-3 text-gray-300">
                    {{ row.evidenceLabel }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        <section
          class="space-y-4 rounded-md border border-gray-700 bg-gray-900/20 p-4"
          aria-labelledby="review-evaluation-report-heading"
        >
          <div>
            <h4
              id="review-evaluation-report-heading"
              class="text-base font-medium text-gray-100"
            >
              Offline correction evaluation
            </h4>
            <p class="mt-1 text-sm text-gray-400">
              This refreshes automatically from the redacted snapshot. It compares only the two completed periods already in that snapshot.
            </p>
          </div>

          <div
            class="rounded-md border border-gray-700 bg-gray-900/40 p-3"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <template v-if="reviewEvaluationReportPresentation">
              <p
                class="font-medium"
                :class="reviewEvaluationReportPresentation.statusClass"
              >
                {{ reviewEvaluationReportPresentation.heading }}
              </p>
              <p class="mt-1 text-sm text-gray-300">
                {{ reviewEvaluationReportPresentation.message }}
              </p>
            </template>
            <p
              v-else-if="reviewEvaluationReportLoading"
              class="text-sm text-gray-400"
            >
              Preparing the offline evaluation report…
            </p>
            <p
              v-else
              class="text-sm text-amber-300"
            >
              The offline evaluation report is temporarily unavailable.
            </p>
          </div>

          <p
            v-if="reviewEvaluationReportError"
            class="rounded-md bg-red-900/30 p-3 text-sm text-red-300"
            role="alert"
          >
            {{ reviewEvaluationReportError }}
          </p>

          <template v-if="reviewEvaluationReport?.report">
            <dl class="grid gap-3 text-sm sm:grid-cols-2">
              <div
                v-for="summary in reviewEvaluationReportPeriodRows"
                :key="summary.periodLabel"
                class="rounded-md border border-gray-700 p-3"
              >
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {{ summary.periodLabel }} confirmed-leading-candidate rate
                </dt>
                <dd class="mt-1 text-lg text-gray-100">
                  {{ summary.confirmationRateLabel }}
                </dd>
                <dd class="mt-1 text-xs text-gray-400">
                  {{ summary.itemCountLabel }} · 95% Wilson interval: {{ summary.intervalLabel }}
                </dd>
              </div>
            </dl>

            <p class="rounded-md border border-gray-700 p-3 text-sm text-gray-300">
              {{ reviewEvaluationReport.report.comparison.message }}
            </p>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <caption class="mb-3 text-left text-sm text-gray-400">
                  Confirmed-leading-candidate rates by period and score-margin band. Each interval is a two-sided 95% Wilson interval for the fixed redacted sample.
                </caption>
                <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th
                      scope="col"
                      class="px-3 py-2 font-medium"
                    >
                      Period
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-2 font-medium"
                    >
                      Score margin
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-2 font-medium"
                    >
                      Sample
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-2 font-medium"
                    >
                      Confirmed rate
                    </th>
                    <th
                      scope="col"
                      class="px-3 py-2 font-medium"
                    >
                      95% interval
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-700">
                  <tr
                    v-for="row in reviewEvaluationReportMarginRows"
                    :key="`${row.periodLabel}-${row.marginLabel}`"
                  >
                    <td class="px-3 py-3 text-gray-200">
                      {{ row.periodLabel }}
                    </td>
                    <td class="px-3 py-3 text-gray-200">
                      {{ row.marginLabel }}
                    </td>
                    <td class="px-3 py-3 text-gray-200">
                      {{ row.itemCountLabel }}
                    </td>
                    <td class="px-3 py-3 text-gray-200">
                      {{ row.confirmationRateLabel }}
                    </td>
                    <td class="px-3 py-3 text-gray-300">
                      {{ row.intervalLabel }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <details class="rounded-md border border-gray-700 p-4">
              <summary class="cursor-pointer text-sm font-medium text-blue-300">
                Review evidence-state breakdown
              </summary>
              <div class="mt-4 overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <caption class="mb-3 text-left text-sm text-gray-400">
                    Fixed evidence-state categories by period. These are aggregate counts only; no evidence content or media identity is available.
                  </caption>
                  <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th
                        scope="col"
                        class="px-3 py-2 font-medium"
                      >
                        Period
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 font-medium"
                      >
                        Evidence state
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 font-medium"
                      >
                        Sample
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 font-medium"
                      >
                        Confirmed rate
                      </th>
                      <th
                        scope="col"
                        class="px-3 py-2 font-medium"
                      >
                        95% interval
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-700">
                    <tr
                      v-for="row in reviewEvaluationReportEvidenceRows"
                      :key="`${row.periodLabel}-${row.evidenceLabel}`"
                    >
                      <td class="px-3 py-3 text-gray-200">
                        {{ row.periodLabel }}
                      </td>
                      <td class="px-3 py-3 text-gray-200">
                        {{ row.evidenceLabel }}
                      </td>
                      <td class="px-3 py-3 text-gray-200">
                        {{ row.itemCountLabel }}
                      </td>
                      <td class="px-3 py-3 text-gray-200">
                        {{ row.confirmationRateLabel }}
                      </td>
                      <td class="px-3 py-3 text-gray-300">
                        {{ row.intervalLabel }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>

            <div class="space-y-2 rounded-md border border-gray-700 p-4">
              <label
                for="review-evaluation-hypothesis"
                class="block text-sm font-medium text-gray-200"
              >
                Operator hypothesis (browser-only, not saved)
              </label>
              <textarea
                id="review-evaluation-hypothesis"
                v-model="reviewEvaluationHypothesis"
                rows="3"
                maxlength="1000"
                class="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                aria-describedby="review-evaluation-hypothesis-description"
              />
              <p
                id="review-evaluation-hypothesis-description"
                class="text-xs text-gray-400"
              >
                Use this to frame a manual policy-review question. It stays only in this open browser view, is not sent to Classifarr, and cannot change policy or routing.
              </p>
              <button
                v-if="reviewEvaluationHypothesis"
                type="button"
                class="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700"
                @click="reviewEvaluationHypothesis = ''"
              >
                Clear browser-only hypothesis
              </button>
            </div>
          </template>
        </section>
      </template>
    </section>

    <section
      class="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4"
      aria-labelledby="policy-change-outcome-observation-heading"
    >
      <div>
        <h3
          id="policy-change-outcome-observation-heading"
          class="text-lg font-medium"
        >
          Policy-change follow-up
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          A bounded aggregate comparison after an approved native policy change. It does not retain media, library, AI, RAG, prompt, response, or policy content.
        </p>
      </div>

      <div
        class="rounded-md border border-gray-700 bg-gray-900/40 p-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <template v-if="policyChangeOutcomeObservationPresentation">
          <p
            class="font-medium"
            :class="policyChangeOutcomeObservationPresentation.statusClass"
          >
            {{ policyChangeOutcomeObservationPresentation.heading }}
          </p>
          <p class="mt-1 text-sm text-gray-300">
            {{ policyChangeOutcomeObservationPresentation.message }}
          </p>
          <p
            v-if="policyChangeOutcomeObservationActionStatus"
            class="mt-2 text-sm text-green-400"
          >
            {{ policyChangeOutcomeObservationActionStatus }}
          </p>
        </template>
        <p
          v-else-if="policyChangeOutcomeObservationLoading"
          class="text-sm text-gray-400"
        >
          Checking policy-change follow-up status…
        </p>
        <p
          v-else
          class="text-sm text-amber-300"
        >
          Policy-change follow-up status is temporarily unavailable.
        </p>
      </div>

      <p
        v-if="policyChangeOutcomeObservationError"
        class="rounded-md bg-red-900/30 p-3 text-sm text-red-300"
        role="alert"
      >
        {{ policyChangeOutcomeObservationError }}
      </p>

      <button
        v-if="policyChangeOutcomeObservation?.startAvailable"
        type="button"
        :disabled="policyChangeOutcomeObservationStarting"
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
        @click="startPolicyChangeOutcomeObservation"
      >
        {{ policyChangeOutcomeObservationStarting ? 'Starting follow-up…' : 'Start policy-change follow-up' }}
      </button>

      <p
        v-else-if="policyChangeOutcomeObservation?.statusId === 'not_started'"
        class="rounded-md border border-gray-700 p-3 text-sm text-gray-300"
      >
        Apply an approved native policy change first. The same administrator can start its aggregate follow-up here for one hour after that change.
      </p>

      <template v-if="policyChangeOutcomeObservation?.observation">
        <dl class="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-md border border-gray-700 p-3">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Baseline
            </dt>
            <dd class="mt-1 text-gray-200">
              {{ formatDate(policyChangeOutcomeObservation.observation.baselineWindow.startAt) }} to {{ formatDate(policyChangeOutcomeObservation.observation.baselineWindow.endAt) }}
            </dd>
          </div>
          <div class="rounded-md border border-gray-700 p-3">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Follow-up
            </dt>
            <dd class="mt-1 text-gray-200">
              {{ formatDate(policyChangeOutcomeObservation.observation.followupWindow.startAt) }} to {{ formatDate(policyChangeOutcomeObservation.observation.followupWindow.endAt) }}
            </dd>
          </div>
          <div class="rounded-md border border-gray-700 p-3">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Outcome available
            </dt>
            <dd class="mt-1 text-gray-200">
              {{ formatDate(policyChangeOutcomeObservation.observation.outcomeAvailableAt) }}
            </dd>
          </div>
          <div class="rounded-md border border-gray-700 p-3">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">
              Expires
            </dt>
            <dd class="mt-1 text-gray-200">
              {{ formatDate(policyChangeOutcomeObservation.observation.expiresAt) }}
            </dd>
          </div>
        </dl>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <caption class="mb-3 text-left text-sm text-gray-400">
              Aggregate applicable-decision outcomes. This comparison is descriptive only and updates automatically while the follow-up period is active.
            </caption>
            <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th
                  scope="col"
                  class="px-3 py-2 font-medium"
                >
                  Period
                </th>
                <th
                  scope="col"
                  class="px-3 py-2 font-medium"
                >
                  Applicable decisions
                </th>
                <th
                  scope="col"
                  class="px-3 py-2 font-medium"
                >
                  Changed selections
                </th>
                <th
                  scope="col"
                  class="px-3 py-2 font-medium"
                >
                  Changed-selection rate
                </th>
                <th
                  scope="col"
                  class="px-3 py-2 font-medium"
                >
                  95% interval
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr>
                <th
                  scope="row"
                  class="px-3 py-3 font-medium text-gray-200"
                >
                  Baseline
                </th>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeBaselineSummary?.applicableDecisionLabel }}
                </td>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeBaselineSummary?.changedSelectionLabel }}
                </td>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeBaselineSummary?.changedSelectionRateLabel }}
                </td>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeBaselineSummary?.changedSelectionRateIntervalLabel }}
                </td>
              </tr>
              <tr v-if="policyChangeOutcomeFollowupSummary">
                <th
                  scope="row"
                  class="px-3 py-3 font-medium text-gray-200"
                >
                  Follow-up
                </th>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeFollowupSummary.applicableDecisionLabel }}
                </td>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeFollowupSummary.changedSelectionLabel }}
                </td>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeFollowupSummary.changedSelectionRateLabel }}
                </td>
                <td class="px-3 py-3 text-gray-200">
                  {{ policyChangeOutcomeFollowupSummary.changedSelectionRateIntervalLabel }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p
          v-if="policyChangeOutcomeObservation?.outcome"
          class="rounded-md border border-gray-700 p-3 text-sm text-gray-300"
        >
          {{ policyChangeOutcomeObservation.outcome.message }} Rate difference: {{ policyChangeOutcomeRateDifferenceLabel }} percentage points.
        </p>
      </template>
    </section>

    <PolicyChangeDecisionReview
      :outcome-observation="policyChangeOutcomeObservation"
    />

    <PolicyChangeReviewHistorySummary />

    <!-- Create New API Key Button -->
    <div class="flex justify-between items-center">
      <h3 class="text-lg font-medium">
        API Keys
      </h3>
      <button
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        @click="showCreateDialog = true"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create New API Key
      </button>
    </div>

    <!-- API Keys Table -->
    <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-900">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Name
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Key Prefix
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Permissions
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Last Used
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          <tr
            v-if="loading"
            class="bg-gray-800"
          >
            <td
              colspan="6"
              class="px-6 py-8 text-center text-gray-400"
            >
              Loading API keys...
            </td>
          </tr>
          <tr
            v-else-if="apiKeys.length === 0"
            class="bg-gray-800"
          >
            <td
              colspan="6"
              class="px-6 py-8 text-center text-gray-400"
            >
              No API keys found. Create one to get started.
            </td>
          </tr>
          <tr
            v-for="key in apiKeys"
            v-else
            :key="key.id"
            class="bg-gray-800 hover:bg-gray-750"
          >
            <td class="px-6 py-4 whitespace-nowrap">
              <input
                v-if="editingKey === key.id"
                v-model="editingName"
                class="px-2 py-1 bg-gray-700 border border-gray-600 rounded-sm focus:ring-2 focus:ring-blue-500"
                autofocus
                @keyup.enter="saveKeyName(key)"
                @keyup.esc="editingKey = null"
              >
              <span
                v-else
                class="cursor-pointer hover:text-blue-400"
                @dblclick="startEditName(key)"
              >
                {{ key.name }}
              </span>
            </td>
            <td class="px-6 py-4 font-mono text-sm">
              {{ key.key_prefix }}...
            </td>
            <td class="px-6 py-4">
              <span
                :class="permissionClass(key.permissions)"
                class="px-2 py-1 rounded-full text-xs font-medium"
              >
                {{ permissionLabel(key.permissions) }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-400">
              {{ key.last_used_at ? formatDate(key.last_used_at) : 'Never' }}
              <span
                v-if="key.last_used_ip"
                class="text-xs block"
              >{{ key.last_used_ip }}</span>
            </td>
            <td class="px-6 py-4">
              <button
                :class="key.is_active ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'"
                class="px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                @click="toggleKeyStatus(key)"
              >
                {{ key.is_active ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td class="px-6 py-4">
              <div class="flex gap-2">
                <button
                  class="text-blue-400 hover:text-blue-300 transition-colors"
                  title="View full API key"
                  @click="revealKey(key)"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
                <button
                  class="text-red-400 hover:text-red-300 transition-colors"
                  title="Revoke API key"
                  @click="confirmDelete(key)"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create API Key Dialog -->
    <div
      v-if="showCreateDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 class="text-xl font-semibold mb-4">
          Create New API Key
        </h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Name</label>
            <input
              v-model="newKey.name"
              type="text"
              placeholder="Integration Key"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Permission Level</label>
            <select
              v-model="newKey.permissions"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="read_write">
                Read-Write (Full Access)
              </option>
              <option value="read_only">
                Read-Only (GET endpoints only)
              </option>
              <option value="embed_service">
                Embedding Service (reserved sidecar credential)
              </option>
              <option value="admin">
                Admin (Full Access + Admin Routes)
              </option>
            </select>
            <p class="text-xs text-gray-400 mt-1">
              {{ permissionDescription(newKey.permissions) }}
            </p>
          </div>

          <div
            v-if="error"
            class="p-3 rounded-lg bg-red-900/30 text-red-400 text-sm"
          >
            {{ error }}
          </div>

          <div class="flex gap-3 mt-6">
            <button
              :disabled="creating || !newKey.name"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              @click="createKey"
            >
              {{ creating ? 'Creating...' : 'Create Key' }}
            </button>
            <button
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              @click="showCreateDialog = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Show API Key Dialog (after creation or reveal) -->
    <!-- NOTE: Users can view full keys again - this is intentional for usability -->
    <!-- Keys are stored encrypted so they can be retrieved when needed -->
    <div
      v-if="showKeyDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 class="text-xl font-semibold mb-4">
          {{ revealedKey.justCreated ? 'API Key Created' : 'API Key' }}
        </h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Name</label>
            <p class="text-gray-300">
              {{ revealedKey.name }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <div class="flex gap-2">
              <input
                :value="revealedKey.key"
                readonly
                class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm"
              >
              <button
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                :title="copied ? 'Copied!' : 'Copy to clipboard'"
                @click="copyKey(revealedKey.key)"
              >
                <svg
                  v-if="!copied"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div class="p-3 rounded-lg bg-yellow-900/30 text-yellow-400 text-sm">
            <svg
              class="w-5 h-5 inline mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            This key is stored encrypted and can be retrieved later when logged in. However, store it securely for convenience.
          </div>

          <div>
            <button
              class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              @click="showKeyDialog = false; revealedKey = null"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 class="text-xl font-semibold mb-4">
          Revoke API Key
        </h3>
        
        <p class="text-gray-300 mb-4">
          Are you sure you want to revoke the API key "{{ keyToDelete?.name }}"? This action cannot be undone and the key will stop working immediately.
        </p>

        <div class="flex gap-3">
          <button
            :disabled="deleting"
            class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="deleteKey"
          >
            {{ deleting ? 'Revoking...' : 'Revoke Key' }}
          </button>
          <button
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            @click="showDeleteDialog = false; keyToDelete = null"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Status Message -->
    <div
      v-if="status"
      :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']"
    >
      {{ status.message }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import api from '@/api'
import PolicyChangeDecisionReview from '@/components/settings/PolicyChangeDecisionReview.vue'
import PolicyChangeReviewHistorySummary from '@/components/settings/PolicyChangeReviewHistorySummary.vue'
import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusControlPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewCorpusControlPresentation'
import {
  getPolicyCandidateCorrectionRepresentativeReviewProjectionPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewProjection,
  presentPolicyCandidateCorrectionRepresentativeReviewProjectionItem,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewProjectionPresentation'
import {
  getPolicyCandidateCorrectionRepresentativeReviewEvaluationReportPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewEvaluationReport,
  presentPolicyCandidateCorrectionRepresentativeReviewEvaluationSummary,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewEvaluationReportPresentation'
import {
  getPolicyCandidateCorrectionPolicyChangeOutcomeObservationPresentation,
  normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation,
  presentPolicyCandidateCorrectionPolicyChangeOutcomeSummary,
} from '@/utils/policyCandidateCorrectionPolicyChangeOutcomeObservationPresentation'

const apiKeys = ref([])
const loading = ref(false)
const showCreateDialog = ref(false)
const showKeyDialog = ref(false)
const showDeleteDialog = ref(false)
const revealedKey = ref(null)
const keyToDelete = ref(null)
const creating = ref(false)
const deleting = ref(false)
const copied = ref(false)
const error = ref(null)
const status = ref(null)
const editingKey = ref(null)
const editingName = ref('')
const reviewCorpusControl = ref(null)
const reviewCorpusAuditEvents = ref([])
const reviewCorpusLoading = ref(false)
const reviewCorpusSaving = ref(false)
const reviewCorpusError = ref(null)
const reviewCorpusActionStatus = ref(null)
const reviewCorpusAcknowledged = ref(false)
const reviewRecordRetentionDays = ref(30)
const reviewProjection = ref(null)
const reviewProjectionLoading = ref(false)
const reviewProjectionCreating = ref(false)
const reviewProjectionError = ref(null)
const reviewProjectionActionStatus = ref(null)
const reviewEvaluationReport = ref(null)
const reviewEvaluationReportLoading = ref(false)
const reviewEvaluationReportError = ref(null)
const reviewEvaluationHypothesis = ref('')
const policyChangeOutcomeObservation = ref(null)
const policyChangeOutcomeObservationLoading = ref(false)
const policyChangeOutcomeObservationStarting = ref(false)
const policyChangeOutcomeObservationError = ref(null)
const policyChangeOutcomeObservationActionStatus = ref(null)
let policyChangeOutcomeObservationRefreshTimer = null

const reviewCorpusControlPresentation = computed(() => (
  getPolicyCandidateCorrectionRepresentativeReviewCorpusControlPresentation(
    reviewCorpusControl.value?.statusId
  )
))
const reviewProjectionPresentation = computed(() => (
  getPolicyCandidateCorrectionRepresentativeReviewProjectionPresentation(
    reviewProjection.value?.statusId
  )
))
const reviewProjectionRows = computed(() => (
  reviewProjection.value?.projection?.items
    ?.map(presentPolicyCandidateCorrectionRepresentativeReviewProjectionItem)
    .filter(Boolean) || []
))
const reviewEvaluationReportPresentation = computed(() => (
  getPolicyCandidateCorrectionRepresentativeReviewEvaluationReportPresentation(
    reviewEvaluationReport.value?.statusId
  )
))
const reviewEvaluationReportPeriodRows = computed(() => (
  reviewEvaluationReport.value?.report?.periodSummaries
    ?.map(presentPolicyCandidateCorrectionRepresentativeReviewEvaluationSummary)
    .filter(Boolean) || []
))
const reviewEvaluationReportMarginRows = computed(() => (
  reviewEvaluationReport.value?.report?.marginSummaries
    ?.map(presentPolicyCandidateCorrectionRepresentativeReviewEvaluationSummary)
    .filter(Boolean) || []
))
const reviewEvaluationReportEvidenceRows = computed(() => (
  reviewEvaluationReport.value?.report?.evidenceStateSummaries
    ?.map(presentPolicyCandidateCorrectionRepresentativeReviewEvaluationSummary)
    .filter(Boolean) || []
))
const policyChangeOutcomeObservationPresentation = computed(() => (
  getPolicyCandidateCorrectionPolicyChangeOutcomeObservationPresentation(
    policyChangeOutcomeObservation.value?.statusId
  )
))
const policyChangeOutcomeBaselineSummary = computed(() => (
  presentPolicyCandidateCorrectionPolicyChangeOutcomeSummary(
    policyChangeOutcomeObservation.value?.observation?.baselineSummary
  )
))
const policyChangeOutcomeFollowupSummary = computed(() => (
  presentPolicyCandidateCorrectionPolicyChangeOutcomeSummary(
    policyChangeOutcomeObservation.value?.outcome?.followupSummary
  )
))
const policyChangeOutcomeRateDifferenceLabel = computed(() => {
  const difference = policyChangeOutcomeObservation.value?.outcome?.changedSelectionRatePointDifference
  return Number.isFinite(difference) ? `${difference >= 0 ? '+' : ''}${difference.toFixed(1)}` : 'Not available'
})

const newKey = ref({
  name: '',
  permissions: 'read_write'
})

onMounted(() => {
  loadApiKeys()
  loadReviewCorpusControl()
  loadReviewProjection()
  loadReviewEvaluationReport()
  loadPolicyChangeOutcomeObservation()
})

onUnmounted(() => {
  if (policyChangeOutcomeObservationRefreshTimer) {
    clearInterval(policyChangeOutcomeObservationRefreshTimer)
  }
})

const schedulePolicyChangeOutcomeObservationRefresh = () => {
  if (policyChangeOutcomeObservationRefreshTimer ||
      policyChangeOutcomeObservation.value?.statusId !== 'observing') return
  policyChangeOutcomeObservationRefreshTimer = setInterval(() => {
    loadPolicyChangeOutcomeObservation({ background: true })
  }, 5 * 60 * 1000)
}

const stopPolicyChangeOutcomeObservationRefresh = () => {
  if (!policyChangeOutcomeObservationRefreshTimer) return
  clearInterval(policyChangeOutcomeObservationRefreshTimer)
  policyChangeOutcomeObservationRefreshTimer = null
}

const loadPolicyChangeOutcomeObservation = async ({ background = false } = {}) => {
  if (!background) policyChangeOutcomeObservationLoading.value = true
  policyChangeOutcomeObservationError.value = null
  try {
    const response = await api.getPolicyCandidateCorrectionPolicyChangeOutcomeObservation()
    const observation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation(response)
    if (!observation) {
      throw new Error('Policy-change outcome observation returned an unexpected response.')
    }
    policyChangeOutcomeObservation.value = observation
    if (observation.statusId === 'observing') {
      schedulePolicyChangeOutcomeObservationRefresh()
    } else {
      stopPolicyChangeOutcomeObservationRefresh()
    }
  } catch (err) {
    console.error('Failed to load policy-change outcome observation:', err)
    if (!background) {
      policyChangeOutcomeObservation.value = null
      policyChangeOutcomeObservationError.value = 'Unable to load the policy-change follow-up. No policy, AI, RAG, or routing change was made.'
    }
  } finally {
    if (!background) policyChangeOutcomeObservationLoading.value = false
  }
}

const startPolicyChangeOutcomeObservation = async () => {
  policyChangeOutcomeObservationStarting.value = true
  policyChangeOutcomeObservationError.value = null
  policyChangeOutcomeObservationActionStatus.value = null
  try {
    const response = await api.startPolicyCandidateCorrectionPolicyChangeOutcomeObservation()
    const observation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservation(response.data)
    if (!observation) {
      throw new Error('Policy-change outcome observation returned an unexpected response.')
    }
    policyChangeOutcomeObservation.value = observation
    policyChangeOutcomeObservationActionStatus.value = response.data.operationId === 'existing_observation'
      ? 'The existing aggregate policy-change follow-up remains active.'
      : 'The aggregate policy-change follow-up started. Its outcome will appear automatically after the completed follow-up period.'
    schedulePolicyChangeOutcomeObservationRefresh()
  } catch (err) {
    console.error('Failed to start policy-change outcome observation:', err)
    policyChangeOutcomeObservationError.value = err.response?.data?.error ||
      'Unable to start the policy-change follow-up. No policy, AI, RAG, or routing change was made.'
  } finally {
    policyChangeOutcomeObservationStarting.value = false
  }
}

const loadReviewCorpusControl = async () => {
  reviewCorpusLoading.value = true
  reviewCorpusError.value = null
  try {
    const [controlResponse, auditResponse] = await Promise.all([
      api.getPolicyCandidateCorrectionReviewCorpusControlConfiguration(),
      api.getPolicyCandidateCorrectionReviewCorpusAuditEvents(),
    ])
    const control = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(controlResponse)
    const auditEvents = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents(auditResponse)
    if (!control || !auditEvents) {
      throw new Error('Historic review-corpus safeguards returned an unexpected response.')
    }

    reviewCorpusControl.value = control
    reviewCorpusAuditEvents.value = auditEvents
    reviewRecordRetentionDays.value = control.configuration?.reviewRecordRetentionDays || 30
  } catch (err) {
    console.error('Failed to load historic review-corpus safeguards:', err)
    reviewCorpusControl.value = null
    reviewCorpusAuditEvents.value = []
    reviewCorpusError.value = 'Unable to load reviewed-corpus safeguards. No historic records are available.'
  } finally {
    reviewCorpusLoading.value = false
  }
}

const acknowledgeReviewCorpusSafeguards = async () => {
  if (!reviewCorpusControl.value || !reviewCorpusAcknowledged.value) return

  reviewCorpusSaving.value = true
  reviewCorpusError.value = null
  reviewCorpusActionStatus.value = null
  try {
    const response = await api.acknowledgePolicyCandidateCorrectionReviewCorpusControl({
      expected_revision: reviewCorpusControl.value.configuration?.revision || null,
      acknowledged_safeguard_ids: [
        'authorization',
        'redaction',
        'retention',
        'operator_audit',
      ],
      review_record_retention_days: reviewRecordRetentionDays.value,
    })
    const control = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(response.data)
    if (!control) {
      throw new Error('Historic review-corpus safeguards returned an unexpected response.')
    }

    reviewCorpusControl.value = control
    reviewCorpusAcknowledged.value = false
    reviewCorpusActionStatus.value = 'Automatic future capture is enabled. Historic record access remains disabled.'
    const auditResponse = await api.getPolicyCandidateCorrectionReviewCorpusAuditEvents()
    const auditEvents = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents(auditResponse)
    if (!auditEvents) {
      throw new Error('Historic review-corpus audit events returned an unexpected response.')
    }
    reviewCorpusAuditEvents.value = auditEvents
    await Promise.all([
      loadReviewProjection(),
      loadReviewEvaluationReport(),
    ])
  } catch (err) {
    console.error('Failed to acknowledge historic review-corpus safeguards:', err)
    reviewCorpusError.value = err.response?.data?.error ||
      'Unable to save safeguards. Refresh the page and try again.'
  } finally {
    reviewCorpusSaving.value = false
  }
}

const loadReviewProjection = async () => {
  reviewProjectionLoading.value = true
  reviewProjectionError.value = null
  try {
    const response = await api.getPolicyCandidateCorrectionReviewCorpusProjection()
    const projection = normalizePolicyCandidateCorrectionRepresentativeReviewProjection(response)
    if (!projection) {
      throw new Error('Redacted evaluation snapshot returned an unexpected response.')
    }
    reviewProjection.value = projection
  } catch (err) {
    console.error('Failed to load redacted evaluation snapshot:', err)
    reviewProjection.value = null
    reviewProjectionError.value = 'Unable to load the redacted evaluation snapshot. No source historic records were exposed.'
  } finally {
    reviewProjectionLoading.value = false
  }
}

const createReviewProjection = async () => {
  reviewProjectionCreating.value = true
  reviewProjectionError.value = null
  reviewProjectionActionStatus.value = null
  try {
    const response = await api.createPolicyCandidateCorrectionReviewCorpusProjection()
    const projection = normalizePolicyCandidateCorrectionRepresentativeReviewProjection(response.data)
    if (!projection) {
      throw new Error('Redacted evaluation snapshot returned an unexpected response.')
    }
    reviewProjection.value = projection
    reviewProjectionActionStatus.value = projection.projection?.itemCount === 0
      ? 'The redacted snapshot was created, but no eligible correction rows were found.'
      : 'The redacted snapshot was created. It will expire automatically.'
    await loadReviewEvaluationReport()
  } catch (err) {
    console.error('Failed to create redacted evaluation snapshot:', err)
    reviewProjectionError.value = err.response?.data?.error ||
      'Unable to create the redacted evaluation snapshot. No policy or routing change was made.'
  } finally {
    reviewProjectionCreating.value = false
  }
}

const loadReviewEvaluationReport = async () => {
  reviewEvaluationReportLoading.value = true
  reviewEvaluationReportError.value = null
  try {
    const response = await api.getPolicyCandidateCorrectionReviewCorpusEvaluationReport()
    const report = normalizePolicyCandidateCorrectionRepresentativeReviewEvaluationReport(response)
    if (!report) {
      throw new Error('Offline evaluation report returned an unexpected response.')
    }
    reviewEvaluationReport.value = report
  } catch (err) {
    console.error('Failed to load offline evaluation report:', err)
    reviewEvaluationReport.value = null
    reviewEvaluationReportError.value = 'Unable to load the offline evaluation report. No source historic records were exposed.'
  } finally {
    reviewEvaluationReportLoading.value = false
  }
}

const loadApiKeys = async () => {
  loading.value = true
  try {
    const response = await api.getApiKeys()
    apiKeys.value = response
  } catch (err) {
    console.error('Failed to load API keys:', err)
    error.value = 'Failed to load API keys'
  } finally {
    loading.value = false
  }
}

const createKey = async () => {
  creating.value = true
  error.value = null
  try {
    const response = await api.createApiKey(newKey.value)
    revealedKey.value = { ...response.data, justCreated: true }
    showCreateDialog.value = false
    showKeyDialog.value = true
    newKey.value = { name: '', permissions: 'read_write' }
    await loadApiKeys()
  } catch (err) {
    console.error('Failed to create API key:', err)
    error.value = err.response?.data?.error || 'Failed to create API key'
  } finally {
    creating.value = false
  }
}

const revealKey = async (key) => {
  try {
    const response = await api.revealApiKey(key.id)
    revealedKey.value = { ...response, justCreated: false }
    showKeyDialog.value = true
  } catch (err) {
    console.error('Failed to reveal API key:', err)
    status.value = { type: 'error', message: 'Failed to reveal API key' }
    setTimeout(() => status.value = null, 3000)
  }
}

const copyKey = async (key) => {
  try {
    await navigator.clipboard.writeText(key)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const confirmDelete = (key) => {
  keyToDelete.value = key
  showDeleteDialog.value = true
}

const deleteKey = async () => {
  deleting.value = true
  try {
    await api.deleteApiKey(keyToDelete.value.id)
    showDeleteDialog.value = false
    keyToDelete.value = null
    await loadApiKeys()
    status.value = { type: 'success', message: 'API key revoked successfully' }
    setTimeout(() => status.value = null, 3000)
  } catch (err) {
    console.error('Failed to delete API key:', err)
    status.value = { type: 'error', message: 'Failed to revoke API key' }
    setTimeout(() => status.value = null, 3000)
  } finally {
    deleting.value = false
  }
}

const toggleKeyStatus = async (key) => {
  try {
    await api.updateApiKey(key.id, { is_active: !key.is_active })
    await loadApiKeys()
    status.value = { type: 'success', message: `API key ${!key.is_active ? 'activated' : 'deactivated'}` }
    setTimeout(() => status.value = null, 3000)
  } catch (err) {
    console.error('Failed to update API key:', err)
    status.value = { type: 'error', message: 'Failed to update API key' }
    setTimeout(() => status.value = null, 3000)
  }
}

const startEditName = (key) => {
  editingKey.value = key.id
  editingName.value = key.name
}

const saveKeyName = async (key) => {
  try {
    await api.updateApiKey(key.id, { name: editingName.value })
    editingKey.value = null
    await loadApiKeys()
    status.value = { type: 'success', message: 'API key name updated' }
    setTimeout(() => status.value = null, 3000)
  } catch (err) {
    console.error('Failed to update API key name:', err)
    status.value = { type: 'error', message: 'Failed to update name' }
    setTimeout(() => status.value = null, 3000)
  }
}

const permissionClass = (permission) => {
  const classes = {
    'read_write': 'bg-blue-900/30 text-blue-400',
    'read_only': 'bg-purple-900/30 text-purple-400',
    'webhook_only': 'bg-green-900/30 text-green-400',
    'embed_service': 'bg-amber-900/30 text-amber-300',
    'admin': 'bg-red-900/30 text-red-400'
  }
  return classes[permission] || 'bg-gray-900/30 text-gray-400'
}

const permissionLabel = (permission) => {
  const labels = {
    'read_write': 'Read-Write',
    'read_only': 'Read-Only',
    'webhook_only': 'Webhook Only',
    'embed_service': 'Embedding Service',
    'admin': 'Admin'
  }
  return labels[permission] || permission
}

const permissionDescription = (permission) => {
  const descriptions = {
    'read_write': 'Can read and modify data (all endpoints)',
    'read_only': 'Can only read data (GET requests)',
    'webhook_only': 'Can only access webhook endpoints (for Overseerr/Seer)',
    'embed_service': 'Reserved for the image-embedding sidecar credential. Not accepted on normal Classifarr API routes.',
    'admin': 'Full access including admin-only endpoints'
  }
  return descriptions[permission] || ''
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}
</script>
