<template>
  <div class="w-full">
    <div class="flex items-center justify-between mb-1">
      <div class="flex items-center space-x-2">
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
        class="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300 ease-out"
        :style="{ width: `${task.progress}%` }"
      ></div>
    </div>
    
    <div class="flex justify-between mt-1">
      <span class="text-[10px] text-slate-500">Step {{ task.phaseIndex || 1 }}/7</span>
      <span class="text-[10px] text-slate-500 font-mono">{{ formatDuration(task.phaseDuration) }}</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  task: {
    type: Object,
    required: true
  }
});

const phaseLabels = {
  queued: 'Queued',
  metadata_fetch: 'Metadata',
  policy_eval: 'Policy',
  rag_analysis: 'RAG',
  signal_combine: 'Combining',
  decision: 'Decision',
  notification: 'Notify'
};

function getPhaseLabel(phase) {
  return phaseLabels[phase] || phase;
}

function formatDuration(ms) {
  if (!ms) return '0s';
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}
</script>
