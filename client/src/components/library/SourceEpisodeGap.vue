<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="episode-gap">
    <p>{{ episodeIdGuidance[gap.sourceIds] }}</p>
    <p>
      Proposed catalog position: TMDb series {{ gap.target.tmdbSeriesId }},
      season {{ gap.target.season }}, episode {{ gap.target.episode }}.
      {{ episodePositionGuidance[gap.catalogPosition] }}
    </p>
    <p>After verifying any correction, rerun “Check source and catalog evidence”. This episode remains unresolved; no source metadata was changed.</p>
  </div>
</template>

<script setup>
import { episodeIdGuidance, episodePositionGuidance } from '@/utils/sourceEpisodeGap'
defineProps({ gap: { type: Object, required: true } })
</script>

<style scoped>
.episode-gap { border-left: 2px solid #94a3b8; padding-left: .75rem; }
p { margin: .5rem 0; overflow-wrap: anywhere; }
</style>
