<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details
    v-for="group in evidence.groups"
    :key="group.mediaType"
  >
    <summary class="cursor-pointer rounded py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      Common observed traits: {{ mediaLabels[group.mediaType] }} ({{ group.typedSelectedLibraryCount }} selected libraries)
    </summary>
    <p class="mb-3 text-sm text-gray-300">
      Each value below appears in at least two selected libraries of this media type. These observations do not establish policy intent, classification accuracy, confidence, eligibility, or routing.
    </p>
    <p
      v-if="evidence.scopeStatus === 'partial_active_library_scope'"
      class="mb-3 text-sm text-gray-300"
    >
      Some active libraries are outside this bounded comparison.
    </p>
    <ul class="space-y-4 text-sm">
      <li
        v-for="trait in group.traits"
        :key="trait.field"
      >
        <p class="font-semibold">
          {{ labels[trait.field] }}
        </p>
        <p class="text-gray-300">
          Observed in {{ trait.knownLibraryCount }} of {{ trait.typedSelectedLibraryCount }} selected libraries.
        </p>
        <p v-if="trait.status === 'insufficient_selected_library_coverage'">
          Fewer than two selected libraries contain this media type.
        </p>
        <p v-else-if="trait.status === 'insufficient_trait_coverage'">
          Fewer than two selected libraries have an observation for this trait.
        </p>
        <p v-else-if="!trait.entries.length">
          No observed value repeats across two selected libraries.
        </p>
        <ul
          v-else
          class="ml-5 list-disc"
        >
          <li
            v-for="entry in trait.entries"
            :key="entry.value"
          >
            {{ entry.value }} — {{ entry.matchingIdentityObservationCount }} observed identity occurrences across {{ entry.observedLibraryCount }} libraries.
            <span v-if="evidence.policyPurposeProvenanceIncluded">
              Administrator policy-purpose context: {{ policyPurposeSummary(entry.policyPurpose) }}.
            </span>
          </li>
        </ul>
        <p v-if="trait.truncated">
          Showing {{ trait.entries.length }} of {{ trait.commonValueCount }} recurring values.
        </p>
      </li>
    </ul>
  </details>
</template>

<script setup>
defineProps({
  evidence: { type: Object, required: true },
})

const labels = {
  rating: 'Rating',
  genres: 'Genres',
  studio: 'Studio',
  keywords: 'Keywords',
  language: 'Original language',
}

const mediaLabels = { movie: 'Movies', tv: 'TV' }

const policyPurposeSummary = (purpose) => [
  `${purpose.retainedDeclaredPurposeLibraryCount} with retained declared purpose`,
  `${purpose.profileOnlySpecializedPurposeLibraryCount} profile-only`,
  `${purpose.noRetainedDeclaredPurposeLibraryCount} without retained declared purpose`,
  `${purpose.noActiveValidatedPolicyLibraryCount} without an active validated native policy`,
].join('; ')
</script>
