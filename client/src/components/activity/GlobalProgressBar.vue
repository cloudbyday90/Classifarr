<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <div v-if="task" class="w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg mb-6 overflow-hidden">
    <div class="px-6 py-4 bg-slate-900/50 border-b border-slate-700/50 flex justify-between items-center">
      <div class="flex items-center space-x-3">
        <div class="animate-pulse relative">
          <div class="absolute inset-0 bg-blue-500 rounded-full opacity-20 blur-xs"></div>
          <span class="relative text-2xl">🎬</span>
        </div>
        <div>
          <h3 class="text-lg font-medium text-white flex items-center gap-2">
            Classifying: <span class="text-blue-400 font-bold">"{{ task.title }}"</span>
            <span v-if="task.year" class="text-slate-500 text-sm">({{ task.year }})</span>
          </h3>
          <p class="text-xs text-slate-400 mt-0.5" v-if="task.currentPhase">
            Phase: <span class="text-slate-300">{{ getPhaseLabel(task.currentPhase) }}</span>
            <span class="mx-1">•</span>
            <span>Step {{ task.phaseIndex || 1 }} / {{ task.totalPhases || phases.length }}</span>
            <span class="mx-1">•</span>
            <span class="font-mono">{{ formatDuration(task.phaseDuration) }}</span>
          </p>
        </div>
      </div>
      <div class="text-right">
        <div class="text-2xl font-bold text-white tabular-nums">{{ task.progress }}%</div>
        <div class="text-xs text-slate-500">Overall Progress</div>
      </div>
    </div>
    
    <!-- Visual Phase Stepper -->
    <div class="p-6">
      <div class="relative">
        <!-- Connecting Line -->
        <div class="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -translate-y-1/2 rounded-full z-0"></div>
        <div 
          class="absolute top-1/2 left-0 h-1 bg-linear-to-r from-blue-600 to-cyan-500 -translate-y-1/2 rounded-full z-0 transition-all duration-500 ease-out"
          :style="{ width: `${Math.max(0, (task.progress - 5))}%` }"
        ></div>

        <!-- Steps -->
        <div class="relative z-10 flex justify-between">
          <div 
            v-for="(phase, index) in phases" 
            :key="phase.id"
            class="flex flex-col items-center group transition-all duration-300"
            :class="getStepClasses(phase.id, index)"
          >
            <div 
              class="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-slate-800 transition-all duration-300 shadow-md"
              :class="getCircleClasses(phase.id, index)"
            >
              <span class="text-lg transition-transform duration-300 group-hover:scale-110" v-if="isCompleted(index)">✓</span>
              <span class="text-lg transition-transform duration-300 group-hover:scale-110" v-else>{{ phase.icon }}</span>
            </div>
            
            <div 
              class="absolute mt-12 px-2 py-1 rounded-sm bg-slate-900 border border-slate-700 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-20"
              :class="{ 'opacity-100 font-bold text-blue-300 border-blue-500/30': isCurrent(phase.id) }"
            >
              {{ phase.label }}
            </div>
            
            <span 
              class="mt-2 text-xs font-medium transition-colors duration-300 hidden sm:block"
              :class="getTextClasses(phase.id, index)"
            >
              {{ phase.shortLabel }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  task: {
    type: Object,
    default: null
  }
});

const phases = [
  { id: 'queued', icon: '⏳', label: 'Queued', shortLabel: 'Queued' },
  { id: 'metadata_fetch', icon: '📥', label: 'Metadata Fetch', shortLabel: 'Metadata' },
  { id: 'policy_eval', icon: '📋', label: 'Policy Evaluation', shortLabel: 'Policy' },
  { id: 'rag_analysis', icon: '🧠', label: 'RAG Analysis', shortLabel: 'RAG' },
  { id: 'signal_combine', icon: '⚖️', label: 'Signal Combination', shortLabel: 'Combine' },
  { id: 'ai_analysis', icon: '🤖', label: 'AI Analysis', shortLabel: 'AI' },
  { id: 'decision', icon: '✅', label: 'Decision', shortLabel: 'Decision' },
  { id: 'notification', icon: '📤', label: 'Notification', shortLabel: 'Notify' }
];

const currentPhaseIndex = computed(() => {
  if (!props.task?.currentPhase) return 0;
  return phases.findIndex(p => p.id === props.task.currentPhase);
});

function isCompleted(index) {
  return index < currentPhaseIndex.value;
}

function isCurrent(phaseId) {
  return props.task?.currentPhase === phaseId;
}

function getPhaseLabel(phaseId) {
  const phase = phases.find(p => p.id === phaseId);
  return phase ? phase.label : phaseId;
}

function formatDuration(ms) {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  return `${seconds}.${Math.floor((ms % 1000) / 100)}s`;
}

function getStepClasses(phaseId, index) {
  if (isCurrent(phaseId)) return 'scale-110';
  return '';
}

function getCircleClasses(phaseId, index) {
  if (isCompleted(index)) {
    return 'border-blue-500 bg-blue-500/20 text-blue-400';
  } else if (isCurrent(phaseId)) {
    return 'border-blue-400 ring-2 ring-blue-500/50 ring-offset-2 ring-offset-slate-900 bg-slate-800 text-white animate-pulse-slow';
  } else {
    return 'border-slate-600 text-slate-600 grayscale';
  }
}

function getTextClasses(phaseId, index) {
  if (isCompleted(index)) {
    return 'text-blue-400';
  } else if (isCurrent(phaseId)) {
    return 'text-white';
  } else {
    return 'text-slate-600';
  }
}
</script>

<style scoped>
.animate-pulse-slow {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
