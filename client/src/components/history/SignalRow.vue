<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div 
    class="flex items-center justify-between py-1"
    :class="score > 0 ? 'text-white' : 'opacity-40 text-gray-500'"
  >
    <div class="flex items-center gap-2">
      <span>{{ icon }}</span>
      <span class="w-16">{{ label }}</span>
    </div>
    <div class="flex items-center gap-3">
      <template v-if="score > 0">
        <span class="w-10 text-right font-mono">{{ score }}%</span>
        <div class="w-24 bg-gray-700 rounded-full h-2">
          <div 
            class="h-2 rounded-full"
            :class="getBarColor(score)"
            :style="{ width: `${score}%` }"
          ></div>
        </div>
        <span class="text-gray-500 text-xs w-12">(×{{ weight }})</span>
      </template>
      <template v-else>
        <span class="w-10 text-right font-mono">--</span>
        <div class="w-24 bg-gray-800 rounded-full h-2"></div>
        <span class="text-gray-600 text-xs italic w-12">(not used)</span>
      </template>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  score: { type: Number, default: 0 },
  weight: { type: Number, default: 0 }
})

const getBarColor = (score) => {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}
</script>
