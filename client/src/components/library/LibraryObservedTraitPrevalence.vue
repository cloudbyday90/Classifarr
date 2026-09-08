<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details>
    <summary class="cursor-pointer rounded py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      Observed trait prevalence: {{ libraryName }} ({{ cohort.mediaType }})
    </summary>
    <p class="mb-3 text-sm text-gray-300">
      These are observed inventory frequencies, compared with selected libraries of the same media type.
      They do not establish policy intent, exclusions, classification accuracy, or routing.
    </p>
    <p
      v-if="scopeStatus === 'partial_active_library_scope'"
      class="mb-3 text-sm text-gray-300"
    >
      Some active libraries are outside this bounded comparison, so peer frequencies are partial.
    </p>
    <ul class="space-y-4 text-sm">
      <li
        v-for="trait in cohort.traits"
        :key="trait.field"
      >
        <p class="font-semibold">
          {{ labels[trait.field] }}
        </p>
        <p class="text-gray-300">
          Known locally: {{ trait.localObservedIdentityCount }} / {{ trait.localIdentityCount }} identities.
          Peer observations: {{ trait.peerObservedIdentityCount }} across {{ trait.peerKnownLibraryCount }} libraries.
        </p>
        <p v-if="trait.localConflictingIdentityCount">
          {{ trait.localConflictingIdentityCount }} conflicting local duplicate observations are withheld from this trait.
        </p>
        <p v-if="trait.status === 'insufficient_local_coverage'">
          No local observations are available for this trait.
        </p>
        <p v-else-if="trait.status === 'partial_local_coverage'">
          Partial local coverage; missing or conflicting observations limit these frequencies.
        </p>
        <p v-if="!trait.entries.length">
          No observed values are available for this trait.
        </p>
        <ul
          v-else
          class="ml-5 list-disc"
        >
          <li
            v-for="entry in trait.entries"
            :key="entry.value"
          >
            {{ entry.value }} — local: {{ entry.localCount }} / {{ trait.localObservedIdentityCount }}
            ({{ entry.localPercentOfObservedIdentities }}%); selected peers: {{ entry.peerCount }} /
            {{ trait.peerObservedIdentityCount }}
            <template v-if="entry.peerPercentOfObservedIdentities !== null">
              ({{ entry.peerPercentOfObservedIdentities }}%; difference {{ signedDifference(entry.differencePercentPoints) }} points).
            </template>
            <template v-else>
              (no peer observation baseline).
            </template>
          </li>
        </ul>
        <p v-if="trait.truncated">
          Showing {{ trait.entries.length }} of {{ trait.valueCount }} observed values.
        </p>
      </li>
    </ul>
  </details>
</template>

<script setup>
defineProps({
  libraryName: { type: String, required: true },
  cohort: { type: Object, required: true },
  scopeStatus: { type: String, required: true },
})

const labels = {
  rating: 'Rating',
  genres: 'Genres',
  studio: 'Studio',
  keywords: 'Keywords',
  language: 'Original language',
}

const signedDifference = (value) => value === null ? 'unknown' : `${value > 0 ? '+' : ''}${value}`
</script>
