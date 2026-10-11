<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="mappings.length"
    aria-label="Human episode identity decisions"
  >
    <h5>Human episode identity decisions</h5>
    <p>These declarations are not independent provider-ID proof. Titles are review context, not proof of identity. Confirm each source episode is the intended catalog episode. Source-layout changes will require a new review.</p>
    <ul>
      <li
        v-for="edge in mappings"
        :key="`${edge.sourceSeason}:${edge.sourceEpisode}`"
      >
        Source season {{ edge.sourceSeason }}, episode {{ edge.sourceEpisode }}
        <template v-if="edge.title">
          — {{ edge.sourceTitle || 'Source title unavailable' }}
        </template>
        → TMDb series {{ edge.tmdbSeriesId }}, season {{ edge.tmdbSeason }}, episode {{ edge.tmdbEpisode }}
        (episode ID {{ edge.tmdbEpisodeId }})<template v-if="edge.title">
          — {{ edge.title }}
        </template>.
      </li>
    </ul>
  </section>
</template>
<script setup>
defineProps({ mappings: { type: Array, required: true } })
</script>
<style scoped>
section { margin-top: .75rem; } p, li { margin: .75rem 0; overflow-wrap: anywhere; }
</style>
