<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details>
    <summary class="cursor-pointer rounded py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      Common traits: {{ leftName }} / {{ rightName }} ({{ pair.mediaType }})
    </summary>
    <p class="mb-3 text-sm text-gray-300">
      Counts describe each whole identified cohort. Each identity counts once per
      value. Multiple values can total more than 100%. Unknown traits are gaps,
      not evidence that a library excludes a trait.
    </p>
    <ul class="space-y-4 text-sm">
      <li
        v-for="trait in pair.traits"
        :key="trait.field"
      >
        <p class="font-semibold">
          {{ labels[trait.field] }}
        </p>
        <p class="text-gray-300">
          Known: {{ leftName }} {{ trait.leftObservedIdentityCount }} / {{ pair.leftIdentityCount }} identities;
          {{ rightName }} {{ trait.rightObservedIdentityCount }} / {{ pair.rightIdentityCount }} identities.
        </p>
        <p v-if="trait.leftConflictingIdentityCount || trait.rightConflictingIdentityCount">
          Conflicting duplicate observations are unknown: {{ leftName }} {{ trait.leftConflictingIdentityCount }};
          {{ rightName }} {{ trait.rightConflictingIdentityCount }} identities.
        </p>
        <p v-if="trait.status === 'insufficient_coverage'">
          Insufficient coverage to compare this trait.
        </p>
        <template v-else>
          <p v-if="trait.status === 'partial_coverage'">
            Partial coverage; missing identities or traits limit this comparison.
          </p>
          <p v-if="!trait.entries.length">
            No common values among observed traits.
          </p>
          <ul
            v-else
            class="ml-5 list-disc"
          >
            <li
              v-for="entry in trait.entries"
              :key="entry.value"
            >
              {{ entry.value }} — {{ leftName }}: {{ entry.leftCount }} / {{ pair.leftIdentityCount }}
              ({{ entry.leftPercentOfIdentities }}%);
              {{ rightName }}: {{ entry.rightCount }} / {{ pair.rightIdentityCount }}
              ({{ entry.rightPercentOfIdentities }}%).
            </li>
          </ul>
          <p v-if="trait.truncated">
            Showing {{ trait.entries.length }} of {{ trait.commonValueCount }} common values.
          </p>
        </template>
      </li>
    </ul>
  </details>
</template>

<script setup>
defineProps({ pair: { type: Object, required: true }, leftName: { type: String, required: true }, rightName: { type: String, required: true } })
const labels = { rating: 'Rating', genres: 'Genres', studio: 'Studio', keywords: 'Keywords', language: 'Original language' }
</script>
