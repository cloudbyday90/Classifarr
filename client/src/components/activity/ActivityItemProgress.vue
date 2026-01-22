<template>
  <div class="w-full">
    <div class="flex items-center justify-between mb-1">
      <div class="flex items-center space-x-2">
        <button
          @click="toggleExpanded"
          class="text-slate-400 hover:text-slate-200 transition-colors focus:outline-hidden"
          :aria-label="expanded ? 'Collapse phase details' : 'Expand phase details'"
        >
          <svg
            class="w-4 h-4 transition-transform duration-200"
            :class="{ 'rotate-90': expanded }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span class="text-xs font-medium text-slate-300">{{ task.title }}</span>
        <span class="text-xs text-slate-500" v-if="task.mediaType">({{ task.mediaType }})</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-xs text-blue-400 font-medium">{{ getPhaseLabel(task.currentPhase) }}</span>
        <span class="text-xs text-slate-500">{{ task.progress }}%</span>
      </div>
    </div>
    
    <div class="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
      <div 
        class="h-1.5 rounded-full bg-linear-to-r from-blue-500 to-cyan-500 transition-all duration-300 ease-out"
        :style="{ width: `${task.progress}%` }"
      ></div>
    </div>
    
    <div class="flex justify-between mt-1">
      <span class="text-[10px] text-slate-500">Step {{ task.phaseIndex || 1 }}/7</span>
      <span class="text-[10px] text-slate-500 font-mono">{{ formatDuration(task.phaseDuration) }}</span>
    </div>

    <!-- Expandable Phase Details -->
    <div v-if="expanded && task.phases" class="mt-3 ml-6 space-y-1.5">
      <div
        v-for="phase in task.phases"
        :key="phase.name"
        class="flex items-start space-x-2 text-xs"
      >
        <span class="shrink-0 mt-0.5">
          <span v-if="phase.status === 'complete'" class="text-green-400">✓</span>
          <span v-else-if="phase.status === 'in_progress'" class="text-blue-400">●</span>
          <span v-else class="text-slate-600">○</span>
        </span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span 
              class="font-medium"
              :class="{
                'text-slate-300': phase.status === 'complete',
                'text-blue-400': phase.status === 'in_progress',
                'text-slate-500': phase.status === 'pending'
              }"
            >
              {{ phase.label || getPhaseLabel(phase.name) }}
            </span>
            <span class="text-slate-500 font-mono ml-2">
              {{ getPhaseTimingText(phase) }}
            </span>
          </div>
          <div v-if="phase.metadata" class="text-slate-500 text-[10px] mt-0.5 truncate">
            {{ formatPhaseMetadata(phase) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
});

const expanded = ref(false);

const phaseLabels = {
  queued: 'Queued',
  metadata_fetch: 'Metadata Fetch',
  policy_eval: 'Policy Evaluation',
  rag_analysis: 'RAG Analysis',
  signal_combine: 'Signal Combination',
  decision: 'Decision',
  notification: 'Notification'
};

function toggleExpanded() {
  expanded.value = !expanded.value;
}

function getPhaseLabel(phase) {
  return phaseLabels[phase] || phase;
}

function formatDuration(ms) {
  if (!ms) return '0s';
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function getPhaseTimingText(phase) {
  if (phase.status === 'complete' && phase.duration_ms) {
    return formatDuration(phase.duration_ms);
  } else if (phase.status === 'in_progress') {
    return 'running...';
  }
  return '';
}

function formatPhaseMetadata(phase) {
  if (!phase.metadata) return '';
  
  const metadata = phase.metadata;
  const parts = [];
  
  if (metadata.tmdb_id) {
    parts.push(`TMDB: ${metadata.tmdb_id}`);
  }
  if (metadata.matched_policy) {
    parts.push(`Matched: "${metadata.matched_policy}"`);
  }
  if (metadata.embedding_count && typeof metadata.embedding_count === 'number') {
    parts.push(`Comparing to ${metadata.embedding_count.toLocaleString()} embeddings`);
  }
  if (metadata.library_id) {
    parts.push(`Library ID: ${metadata.library_id}`);
  }
  
  return parts.join(' - ');
}
</script>
