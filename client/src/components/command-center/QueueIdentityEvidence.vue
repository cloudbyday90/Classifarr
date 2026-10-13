<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div>
    <p>{{ queueIdentityEvidenceMessage(evidence) }}</p>
    <template v-if="evidence.reason === 'candidate_for_review' && evidence.candidate">
      <p>
        Candidate: {{ evidence.candidate.title }}<span v-if="evidence.candidate.releaseDate"> ({{ evidence.candidate.releaseDate }})</span>
        · TMDb {{ evidence.candidate.mediaType === 'movie' ? 'movie' : 'TV series' }} ID {{ evidence.candidate.tmdbId }}
      </p>
      <p>Saved IDs checked: {{ queueIdentityEvidenceSources(evidence.sources) }}.</p>
      <p>Confirm that this is the same work and edition before any future repair. The saved ID and task are unchanged.</p>
    </template>
  </div>
</template>

<script setup>
import { queueIdentityEvidenceMessage, queueIdentityEvidenceSources } from '@/utils/queueIdentityEvidencePresentation'
defineProps({ evidence: { type: Object, required: true } })
</script>

<style scoped>
p { margin-top: 0.5rem; overflow-wrap: anywhere; }
</style>
