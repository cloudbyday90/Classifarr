<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    class="space-y-6"
    aria-labelledby="policy-candidate-correction-analytics-heading"
  >
    <div>
      <h2
        id="policy-candidate-correction-analytics-heading"
        class="text-xl font-semibold"
      >
        Policy Correction Analytics
      </h2>
      <p class="mt-1 text-sm text-gray-400">
        Aggregate-only comparison of the original leading evidence state and later validated operator confirmation or destination change. It never exposes media, library, candidate, destination, provider, model, RAG text, or actor identity.
      </p>
    </div>

    <p
      class="sr-only"
      role="status"
      aria-atomic="true"
    >
      {{ monitoringStatusAnnouncement }}
    </p>

    <div
      v-if="loading"
      class="rounded-lg border border-gray-700 bg-gray-800 p-6 text-sm text-gray-400"
    >
      Loading policy correction analytics...
    </div>

    <div
      v-else-if="errorMessage"
      class="rounded-lg border border-red-700/60 bg-red-950/30 p-6 text-sm text-red-200"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <template v-else-if="report">
      <article
        class="rounded-lg border p-5"
        :class="readinessClass"
      >
        <h3 class="text-base font-medium">
          {{ report.readiness.label }}
        </h3>
        <p class="mt-1 text-sm text-gray-300">
          {{ report.readiness.message }}
        </p>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <MetricRow
            label="Validated outcomes"
            :value="report.summary.outcomeCount"
          />
          <MetricRow
            label="Confirmed leading candidate"
            :value="report.summary.confirmedLeaderOutcomeCount"
          />
          <MetricRow
            label="Changed destination (applicable decisions)"
            :value="formatRate(
              report.summary.changedSelectionOutcomeCount,
              report.summary.changedSelectionRatePercent,
            )"
          />
        </dl>
        <p class="mt-3 text-xs text-gray-400">
          {{ report.window.days }} complete UTC days ending {{ report.window.endDate || '—' }}.
        </p>

        <div class="mt-5 border-t border-gray-700 pt-4">
          <h4 class="text-sm font-medium text-white">
            Overall selection-change review readiness
          </h4>
          <p
            class="mt-1 text-sm"
            :class="overallCalibrationReadinessPresentation.className"
          >
            {{ overallCalibrationReadinessPresentation.label }}
          </p>
          <p class="mt-1 text-sm text-gray-300">
            {{ overallCalibrationReadinessPresentation.message }}
          </p>
          <dl class="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <MetricRow
              label="Applicable decisions"
              :value="report.calibrationReadiness.applicableDecisionCount"
            />
            <MetricRow
              label="Changed selection"
              :value="formatRate(
                report.calibrationReadiness.changedSelectionOutcomeCount,
                report.calibrationReadiness.changedSelectionRatePercent,
              )"
            />
            <MetricRow
              label="Uncertainty"
              :value="formatConfidenceInterval(
                report.calibrationReadiness.changedSelectionConfidenceInterval,
              )"
            />
          </dl>
          <p class="mt-3 text-xs text-gray-400">
            Scores are not probabilities. This fixed 20% review floor evaluates later operator selection changes, not score correctness.
          </p>
        </div>
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Stability across adjacent completed windows
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          The same fixed aggregate is compared in the current and immediately preceding complete UTC-day windows. A repeated signal is an advisory reason to review representative decisions, never an automatic maintenance or routing change.
        </p>
        <p
          class="mt-4 text-sm font-medium"
          :class="overallTemporalStabilityPresentation.className"
        >
          {{ overallTemporalStabilityPresentation.label }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ overallTemporalStabilityPresentation.message }}
        </p>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <MetricRow
            label="Current window"
            :value="windowLabel(report.window)"
          />
          <MetricRow
            label="Previous window"
            :value="windowLabel(report.previousWindow)"
          />
          <MetricRow
            label="Applicable decisions"
            :value="`${report.temporalStability.summary.currentApplicableDecisionCount} current / ${report.temporalStability.summary.previousApplicableDecisionCount} previous`"
          />
        </dl>

        <table class="mt-5 min-w-full text-left text-sm">
          <caption class="sr-only">
            Adjacent completed-window stability for fixed policy-score margin bands.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Margin band
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Current readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Previous readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Adjacent-window status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in marginTemporalBuckets"
              :key="bucket.marginBandId"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ bucket.label }}
              </th>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket.current).className">
                  {{ calibrationReadinessPresentation(bucket.current).label }}
                </span>
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket.previous).className">
                  {{ calibrationReadinessPresentation(bucket.previous).label }}
                </span>
              </td>
              <td class="px-3 py-3">
                <span :class="temporalStabilityPresentation(bucket.stability).className">
                  {{ temporalStabilityPresentation(bucket.stability).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <table
          v-if="evidenceTemporalBuckets.length"
          class="mt-5 min-w-full text-left text-sm"
        >
          <caption class="sr-only">
            Adjacent completed-window stability for fixed original evidence-source states.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Evidence source
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Original state
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Current readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Previous readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Adjacent-window status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in evidenceTemporalBuckets"
              :key="`${bucket.evidenceSourceId}:${bucket.evidenceStateId}`"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ bucket.sourceLabel }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.stateLabel }}
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket.current).className">
                  {{ calibrationReadinessPresentation(bucket.current).label }}
                </span>
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket.previous).className">
                  {{ calibrationReadinessPresentation(bucket.previous).label }}
                </span>
              </td>
              <td class="px-3 py-3">
                <span :class="temporalStabilityPresentation(bucket.stability).className">
                  {{ temporalStabilityPresentation(bucket.stability).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Cohort-composition context
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          This checks whether the current and previous windows contain a similar mix of fixed score margins and original evidence states. A material mix shift is a reason to interpret a review signal cautiously; it never changes policy, AI, RAG, learning, or routing.
        </p>
        <p
          class="mt-4 text-sm font-medium"
          :class="overallCohortCompositionPresentation.className"
        >
          {{ overallCohortCompositionPresentation.label }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ overallCohortCompositionPresentation.message }}
        </p>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <MetricRow
            label="Fixed cohort floor"
            :value="`${report.cohortComposition.marginBands.minimumObservationCount} per window`"
          />
          <MetricRow
            label="Material-shift screen"
            :value="`${report.cohortComposition.marginBands.materialShiftThresholdPercent}% total variation`"
          />
          <MetricRow
            label="Compared dimensions"
            :value="report.cohortComposition.comparableDimensionCount + report.cohortComposition.materialShiftDimensionCount"
          />
        </dl>
        <table class="mt-5 min-w-full text-left text-sm">
          <caption class="sr-only">
            Fixed policy-score margin mix in the current and previous completed windows.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Score-margin band
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Current mix
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Previous mix
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in report.cohortComposition.marginBands.buckets"
              :key="bucket.bucketId"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ report.marginBuckets.find((marginBucket) => marginBucket.marginBandId === bucket.bucketId)?.label || 'Score margin' }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(bucket.currentObservationCount, bucket.currentSharePercent) }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(bucket.previousObservationCount, bucket.previousSharePercent) }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatSignedPercentage(bucket.sharePointChangePercent) }}
              </td>
            </tr>
          </tbody>
        </table>
        <table
          v-if="evidenceCohortCompositionSources.length"
          class="mt-5 min-w-full text-left text-sm"
        >
          <caption class="sr-only">
            Fixed original evidence-source state mix comparison for the current and previous completed windows.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Evidence source
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Current observations
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Previous observations
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Variation distance
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Cohort status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="source in evidenceCohortCompositionSources"
              :key="source.evidenceSourceId"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ source.sourceLabel }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ source.comparison.currentObservationCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ source.comparison.previousObservationCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatVariationDistance(source.comparison.totalVariationDistancePercent) }}
              </td>
              <td class="px-3 py-3">
                <span :class="cohortCompositionPresentation(source.comparison).className">
                  {{ cohortCompositionPresentation(source.comparison).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="mt-4 text-xs text-gray-400">
          Score-margin variation distance: {{ formatVariationDistance(report.cohortComposition.marginBands.totalVariationDistancePercent) }}.
        </p>
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Longer-horizon trend context
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          Two fixed adjacent 28-day completed UTC periods are compared. This advisory screen is available only when both periods are representative and their aggregate cohort mix is comparable; it never changes policy, AI, RAG, learning, or routing.
        </p>
        <p
          class="mt-4 text-sm font-medium"
          :class="overallLongHorizonTrendPresentation.className"
        >
          {{ overallLongHorizonTrendPresentation.label }}
        </p>
        <p class="mt-1 text-sm text-gray-300">
          {{ overallLongHorizonTrendPresentation.message }}
        </p>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <MetricRow
            label="Current 28-day period"
            :value="windowLabel(report.longHorizonTrend.current.window)"
          />
          <MetricRow
            label="Previous 28-day period"
            :value="windowLabel(report.longHorizonTrend.previous.window)"
          />
          <MetricRow
            label="Cohort guard"
            :value="longHorizonCohortCompositionPresentation.label"
          />
        </dl>
        <table class="mt-5 min-w-full text-left text-sm">
          <caption class="sr-only">
            Fixed 28-day aggregate selection-change readiness for current and previous completed periods.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Period
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Applicable decisions
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Changed selection
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Review readiness
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="period in longHorizonPeriods"
              :key="period.id"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ period.label }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ period.summary.applicableDecisionCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(
                  period.summary.changedSelectionOutcomeCount,
                  period.summary.changedSelectionRatePercent,
                ) }}
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(period).className">
                  {{ calibrationReadinessPresentation(period).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="mt-4 text-xs text-gray-400">
          The long-horizon cohort guard is based on aggregate counts only. Interpret any sustained signal by reviewing a representative cohort; do not infer correctness or causality from it.
        </p>
      </article>

      <PolicyCandidateBroadDeclaredPolicyRecommendation
        :long-horizon-trend="report.longHorizonTrend"
      />

      <article
        v-if="representativeReviewHandoff"
        class="rounded-lg border border-amber-700/60 bg-amber-950/20 p-5"
        aria-labelledby="policy-candidate-correction-representative-review-heading"
      >
        <h3
          id="policy-candidate-correction-representative-review-heading"
          class="text-base font-medium text-amber-100"
        >
          {{ representativeReviewHandoff.heading }}
        </h3>
        <p class="mt-1 text-sm text-gray-300">
          {{ representativeReviewHandoff.message }}
        </p>
        <RouterLink
          :to="representativeReviewHandoff.to"
          class="mt-4 inline-flex rounded bg-amber-500 px-3 py-2 text-sm font-medium text-gray-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-800"
          aria-describedby="policy-candidate-correction-representative-review-description"
        >
          {{ representativeReviewHandoff.linkLabel }}
        </RouterLink>
        <p
          id="policy-candidate-correction-representative-review-description"
          class="mt-3 text-xs text-gray-400"
        >
          {{ representativeReviewHandoff.description }}
        </p>
      </article>

      <article
        v-if="representativeReviewCorpusPresentation"
        class="rounded-lg border border-gray-700 bg-gray-800 p-5"
        aria-labelledby="policy-candidate-correction-historical-review-heading"
      >
        <h3
          id="policy-candidate-correction-historical-review-heading"
          class="text-base font-medium"
        >
          {{ representativeReviewCorpusPresentation.heading }}
        </h3>
        <p class="mt-1 text-sm text-gray-300">
          {{ representativeReviewCorpusPresentation.message }}
        </p>
        <details class="mt-4 rounded border border-gray-700 bg-gray-900/50 p-3 text-sm">
          <summary class="cursor-pointer font-medium text-gray-100">
            {{ representativeReviewCorpusPresentation.disclosureLabel }}
          </summary>
          <dl class="mt-3 space-y-3 text-gray-300">
            <template
              v-for="safeguard in representativeReviewCorpusPresentation.safeguards"
              :key="safeguard.id"
            >
              <dt class="font-medium text-white">
                {{ safeguard.label }}
              </dt>
              <dd class="mt-1 text-gray-400">
                {{ safeguard.description }}
              </dd>
            </template>
          </dl>
        </details>
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Score-margin outcome association
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          The score margin is the original rounded difference between the leading and runner-up policy candidates. It is not a confidence guarantee.
        </p>
        <table class="mt-4 min-w-full text-left text-sm">
          <caption class="sr-only">
            Aggregate original policy-score margin bands and later validated operator outcomes.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Margin band
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Outcomes
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Confirmed leader
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Changed, candidate set
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Outside candidate set
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Changed destination
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Review readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Uncertainty
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in report.marginBuckets"
              :key="bucket.marginBandId"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ bucket.label }}
                <span class="block text-xs font-normal text-gray-400">{{ bucket.description }}</span>
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.outcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.confirmedLeaderOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.changedToCandidateOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.changedOutsideCandidatesOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(bucket.changedSelectionOutcomeCount, bucket.changedSelectionRatePercent) }}
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket).className">
                  {{ calibrationReadinessPresentation(bucket).label }}
                </span>
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatConfidenceInterval(bucket.calibrationReadiness.changedSelectionConfidenceInterval) }}
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h3 class="text-base font-medium">
          Original evidence-state outcome association
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          Each row is one fixed state from the original leading candidate. A changed destination is a review signal, not proof that one source caused an error.
        </p>
        <table
          v-if="report.evidenceSourceStateBuckets.length"
          class="mt-4 min-w-full text-left text-sm"
        >
          <caption class="sr-only">
            Aggregate original leading-candidate evidence states and later validated operator outcomes.
          </caption>
          <thead class="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Evidence source
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Original state
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Outcomes
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Confirmed leader
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Changed destination
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Review readiness
              </th>
              <th
                scope="col"
                class="px-3 py-3 font-medium"
              >
                Uncertainty
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bucket in report.evidenceSourceStateBuckets"
              :key="`${bucket.evidenceSourceId}:${bucket.evidenceStateId}`"
              class="border-b border-gray-700/70 last:border-b-0"
            >
              <th
                scope="row"
                class="px-3 py-3 font-medium text-white"
              >
                {{ bucket.sourceLabel }}
              </th>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.stateLabel }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.outcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ bucket.confirmedLeaderOutcomeCount }}
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatRate(bucket.changedSelectionOutcomeCount, bucket.changedSelectionRatePercent) }}
              </td>
              <td class="px-3 py-3">
                <span :class="calibrationReadinessPresentation(bucket).className">
                  {{ calibrationReadinessPresentation(bucket).label }}
                </span>
              </td>
              <td class="px-3 py-3 text-gray-300">
                {{ formatConfidenceInterval(bucket.calibrationReadiness.changedSelectionConfidenceInterval) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-else
          class="mt-4 text-sm text-gray-400"
        >
          No fixed evidence-source outcomes are available in this completed UTC-day window yet.
        </p>
      </article>

      <p class="text-sm text-gray-400">
        Review a representative cohort before adjusting any policy threshold, evidence weight, RAG behavior, or AI configuration. This view has no tuning or routing control.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'

import api from '@/api'
import {
  normalizePolicyCandidateCorrectionAnalyticsMetricsReport,
} from '@/utils/policyCandidateCorrectionAnalyticsPresentation'
import {
  formatPolicyCandidateCorrectionConfidenceInterval,
  getPolicyCandidateCorrectionCalibrationReadinessPresentation,
} from '@/utils/policyCandidateCorrectionCalibrationReadinessPresentation'
import {
  getPolicyCandidateCorrectionTemporalStabilityPresentation,
} from '@/utils/policyCandidateCorrectionTemporalStabilityPresentation'
import {
  getPolicyCandidateCorrectionCohortCompositionPresentation,
} from '@/utils/policyCandidateCorrectionCohortCompositionPresentation'
import {
  getPolicyCandidateCorrectionLongHorizonTrendPresentation,
} from '@/utils/policyCandidateCorrectionLongHorizonTrendPresentation'
import {
  getPolicyCandidateCorrectionRepresentativeReviewHandoff,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewHandoffPresentation'
import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusPresentation,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewCorpusReadinessPresentation'
import PolicyCandidateBroadDeclaredPolicyRecommendation from '@/components/statistics/PolicyCandidateBroadDeclaredPolicyRecommendation.vue'

const MetricRow = defineComponent({
  name: 'PolicyCandidateCorrectionAnalyticsMetricRow',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
  },
  setup(props) {
    return () => h('div', { class: 'rounded border border-gray-700 bg-gray-900/50 px-3 py-2' }, [
      h('dt', { class: 'text-gray-400' }, props.label),
      h('dd', { class: 'mt-1 font-medium text-white' }, String(props.value)),
    ])
  },
})

const loading = ref(true)
const errorMessage = ref('')
const report = ref(null)

const readinessClass = computed(() => ({
  observing: 'border-blue-700/60 bg-blue-950/20',
  insufficient_data: 'border-gray-700 bg-gray-800',
}[report.value?.readiness?.statusId] || 'border-gray-700 bg-gray-800'))
const representativeReviewHandoff = computed(() => (
  getPolicyCandidateCorrectionRepresentativeReviewHandoff(
    report.value?.longHorizonTrend?.trend?.statusId,
  )
))
const representativeReviewCorpusPresentation = computed(() => (
  getPolicyCandidateCorrectionRepresentativeReviewCorpusPresentation(
    report.value?.longHorizonTrend?.representativeReviewCorpus?.statusId,
  )
))
const monitoringStatusAnnouncement = computed(() => {
  if (loading.value) return 'Loading policy correction analytics.'
  if (errorMessage.value || !report.value) return 'Policy correction analytics are currently unavailable.'

  return `${report.value.readiness.label}. ${overallCalibrationReadinessPresentation.value.label}. ${overallCohortCompositionPresentation.value.label}. ${overallLongHorizonTrendPresentation.value.label}.${representativeReviewHandoff.value ? ` ${representativeReviewHandoff.value.announcement}` : ''}${representativeReviewCorpusPresentation.value ? ` ${representativeReviewCorpusPresentation.value.announcement}` : ''}`
})

const overallCalibrationReadinessPresentation = computed(() => (
  getPolicyCandidateCorrectionCalibrationReadinessPresentation(
    report.value?.calibrationReadiness?.statusId,
  ) || getPolicyCandidateCorrectionCalibrationReadinessPresentation('insufficient_data')
))
const overallTemporalStabilityPresentation = computed(() => (
  temporalStabilityPresentation(report.value?.temporalStability?.summary)
))
const overallCohortCompositionPresentation = computed(() => (
  cohortCompositionPresentation(report.value?.cohortComposition)
))
const overallLongHorizonTrendPresentation = computed(() => (
  longHorizonTrendPresentation(report.value?.longHorizonTrend?.trend)
))
const longHorizonCohortCompositionPresentation = computed(() => (
  cohortCompositionPresentation(report.value?.longHorizonTrend?.cohortComposition)
))
const longHorizonPeriods = computed(() => {
  const longHorizonTrend = report.value?.longHorizonTrend
  if (!longHorizonTrend) return []

  return [
    { id: 'current', label: 'Current 28-day period', ...longHorizonTrend.current },
    { id: 'previous', label: 'Previous 28-day period', ...longHorizonTrend.previous },
  ]
})
const marginTemporalBuckets = computed(() => report.value?.temporalStability?.marginBuckets
  .map((entry) => ({
    ...report.value.marginBuckets.find((bucket) => bucket.marginBandId === entry.key),
    current: report.value.marginBuckets.find((bucket) => bucket.marginBandId === entry.key)
      ?.calibrationReadiness,
    previous: report.value.previousMarginBuckets.find((bucket) => bucket.marginBandId === entry.key)
      ?.calibrationReadiness,
    stability: entry.stability,
  })) || [])
const evidenceTemporalBuckets = computed(() => report.value?.temporalStability?.evidenceSourceStateBuckets
  .map((entry) => {
    const [evidenceSourceId, evidenceStateId] = entry.key.split(':')
    const current = report.value.evidenceSourceStateBuckets.find((bucket) => (
      bucket.evidenceSourceId === evidenceSourceId && bucket.evidenceStateId === evidenceStateId
    ))
    const previous = report.value.previousEvidenceSourceStateBuckets.find((bucket) => (
      bucket.evidenceSourceId === evidenceSourceId && bucket.evidenceStateId === evidenceStateId
    ))
    const displayed = current || previous

    return {
      ...displayed,
      current: current?.calibrationReadiness,
      previous: previous?.calibrationReadiness,
      stability: entry.stability,
    }
  }) || [])
const evidenceCohortCompositionSources = computed(() => report.value?.cohortComposition?.evidenceSources
  .map((entry) => {
    const displayed = report.value.evidenceSourceStateBuckets.find((bucket) => (
      bucket.evidenceSourceId === entry.evidenceSourceId
    )) || report.value.previousEvidenceSourceStateBuckets.find((bucket) => (
      bucket.evidenceSourceId === entry.evidenceSourceId
    ))

    return {
      ...entry,
      sourceLabel: displayed?.sourceLabel || 'Evidence source',
    }
  }) || [])

function formatRate(count, percentage) {
  return `${Number(count) || 0} (${Number(percentage) || 0}%)`
}

function calibrationReadinessPresentation(bucket) {
  return getPolicyCandidateCorrectionCalibrationReadinessPresentation(
    bucket?.calibrationReadiness?.statusId,
  ) || getPolicyCandidateCorrectionCalibrationReadinessPresentation('insufficient_data')
}

function temporalStabilityPresentation(stability) {
  return getPolicyCandidateCorrectionTemporalStabilityPresentation(stability?.statusId) ||
    getPolicyCandidateCorrectionTemporalStabilityPresentation('insufficient_comparison_data')
}

function cohortCompositionPresentation(composition) {
  return getPolicyCandidateCorrectionCohortCompositionPresentation(composition?.statusId) ||
    getPolicyCandidateCorrectionCohortCompositionPresentation('insufficient_data')
}

function longHorizonTrendPresentation(trend) {
  return getPolicyCandidateCorrectionLongHorizonTrendPresentation(trend?.statusId) ||
    getPolicyCandidateCorrectionLongHorizonTrendPresentation('needs_representative_periods')
}

function windowLabel(window) {
  if (!window?.startDate || !window?.endDate) return 'Unavailable'
  return `${window.startDate} to ${window.endDate}`
}

function formatConfidenceInterval(interval) {
  return formatPolicyCandidateCorrectionConfidenceInterval(interval)
}

function formatSignedPercentage(value) {
  const percentage = Number(value) || 0
  return `${percentage > 0 ? '+' : ''}${percentage}%`
}

function formatVariationDistance(value) {
  return value === null || value === undefined ? 'Not calculated' : `${Number(value) || 0}%`
}

async function loadMetrics() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.getPolicyCandidateCorrectionAnalyticsMetrics()
    report.value = normalizePolicyCandidateCorrectionAnalyticsMetricsReport(response)
    if (!report.value) {
      errorMessage.value = 'Policy correction analytics are currently unavailable.'
    }
  } catch (_error) {
    errorMessage.value = 'Policy correction analytics are currently unavailable.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMetrics)
</script>
