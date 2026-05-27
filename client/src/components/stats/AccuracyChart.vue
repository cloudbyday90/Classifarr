<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  Licensed under GPL-3.0
-->

<template>
  <div class="accuracy-chart">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
    >
      <!-- Grid lines -->
      <g class="grid">
        <line
          v-for="i in 5"
          :key="`h-${i}`" 
          :x1="padding" 
          :y1="padding + (chartHeight / 4) * (i - 1)" 
          :x2="width - padding" 
          :y2="padding + (chartHeight / 4) * (i - 1)"
          stroke="#e5e7eb" 
          stroke-width="1"
        />
      </g>

      <!-- Decisions line -->
      <polyline 
        v-if="decisionsPoints"
        :points="decisionsPoints"
        fill="none"
        stroke="#3b82f6"
        stroke-width="2"
      />

      <!-- Corrections line -->
      <polyline 
        v-if="correctionsPoints"
        :points="correctionsPoints"
        fill="none"
        stroke="#ef4444"
        stroke-width="2"
      />

      <!-- Data points -->
      <g
        v-for="(point, idx) in dataPoints"
        :key="`point-${idx}`"
      >
        <circle 
          :cx="point.x" 
          :cy="point.decisionsY" 
          r="4" 
          fill="#3b82f6"
        >
          <title>{{ point.date }}: {{ point.decisions }} decisions</title>
        </circle>
        <circle 
          :cx="point.x" 
          :cy="point.correctionsY" 
          r="4" 
          fill="#ef4444"
        >
          <title>{{ point.date }}: {{ point.corrections }} corrections</title>
        </circle>
      </g>

      <!-- Legend -->
      <g
        class="legend"
        :transform="`translate(${padding}, ${height - 10})`"
      >
        <circle
          cx="0"
          cy="0"
          r="4"
          fill="#3b82f6"
        />
        <text
          x="10"
          y="4"
          font-size="12"
          fill="#6b7280"
        >Decisions</text>
        <circle
          cx="80"
          cy="0"
          r="4"
          fill="#ef4444"
        />
        <text
          x="90"
          y="4"
          font-size="12"
          fill="#6b7280"
        >Corrections</text>
      </g>
    </svg>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'AccuracyChart',
  props: {
    data: {
      type: Array,
      default: () => []
    },
    width: {
      type: Number,
      default: 800
    },
    height: {
      type: Number,
      default: 300
    }
  },
  setup(props) {
    const padding = 40;
    const chartWidth = computed(() => props.width - padding * 2);
    const chartHeight = computed(() => props.height - padding * 2);

    const maxValue = computed(() => {
      if (!props.data || props.data.length === 0) return 10;
      return Math.max(...props.data.map(d => d.decisions || 0));
    });

    const dataPoints = computed(() => {
      if (!props.data || props.data.length === 0) return [];
      
      const points = props.data.map((d, idx) => {
        // Handle single data point case - center it
        let x;
        if (props.data.length === 1) {
          x = padding + chartWidth.value / 2;
        } else {
          x = padding + (chartWidth.value / (props.data.length - 1)) * idx;
        }
        
        const decisionsY = padding + chartHeight.value - 
          ((d.decisions || 0) / maxValue.value) * chartHeight.value;
        const correctionsY = padding + chartHeight.value - 
          ((d.corrections || 0) / maxValue.value) * chartHeight.value;
        
        return {
          x,
          decisionsY,
          correctionsY,
          date: d.date,
          decisions: d.decisions || 0,
          corrections: d.corrections || 0
        };
      });
      
      return points;
    });

    const decisionsPoints = computed(() => {
      if (dataPoints.value.length === 0) return '';
      return dataPoints.value.map(p => `${p.x},${p.decisionsY}`).join(' ');
    });

    const correctionsPoints = computed(() => {
      if (dataPoints.value.length === 0) return '';
      return dataPoints.value.map(p => `${p.x},${p.correctionsY}`).join(' ');
    });

    return {
      padding,
      chartWidth,
      chartHeight,
      dataPoints,
      decisionsPoints,
      correctionsPoints
    };
  }
};
</script>

<style scoped>
.accuracy-chart {
  width: 100%;
  height: 100%;
}

svg {
  width: 100%;
  height: auto;
}
</style>
