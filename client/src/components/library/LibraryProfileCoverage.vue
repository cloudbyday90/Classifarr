<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-2 text-sm text-gray-200">
    <template v-if="rows.length">
      <p>Trait percentages show the share of all {{ observation.itemCount }} inventory items. An item can have several genres, so percentages can total more than 100%.</p>
      <table class="w-full text-left">
        <caption class="mb-2 text-left font-semibold">
          Metadata coverage
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Trait
            </th><th scope="col">
              Known
            </th><th scope="col">
              Missing
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.field"
          >
            <th
              scope="row"
              class="py-1 font-normal"
            >
              {{ row.label }}
            </th><td>{{ row.known }}</td><td>{{ row.missing }}</td>
          </tr>
        </tbody>
      </table>
      <p>Missing values and uncommon traits do not establish library restrictions.</p>
      <p v-if="observation.duplicateIdentifiedRowCount > 0">
        {{ observation.duplicateIdentifiedRowCount }} entries repeat a known movie or TV identity. These statistics count inventory entries.
      </p>
    </template>
    <p v-else-if="historical">
      Metadata coverage was not recorded for this historical profile. Its percentage denominator is unverified.
    </p>
    <p v-else>
      Metadata coverage has not been measured for this profile. The automatic profile refresh will populate it. Absent values do not establish library restrictions.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ observation: { type: Object, default: null }, historical: Boolean })
const fields = { rating: 'Ratings', genres: 'Genres', studio: 'Studios', keywords: 'Keywords', language: 'Languages' }
const rows = computed(() => {
  const data = props.observation
  if (data?.version !== 'library.profile_observation.v1' || data.population !== 'inventory_rows' || !Number.isInteger(data.itemCount) || data.itemCount < 0) return []
  const result = Object.entries(fields).map(([field, label]) => ({ field, label, known: data.traits?.[field]?.observedCount, missing: data.traits?.[field]?.unknownCount }))
  return result.every(row => Number.isInteger(row.known) && Number.isInteger(row.missing) && row.known >= 0 && row.missing >= 0 && row.known + row.missing === data.itemCount) ? result : []
})
</script>
