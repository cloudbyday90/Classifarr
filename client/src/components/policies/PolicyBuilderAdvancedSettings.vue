<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-4">
    <button
      type="button"
      class="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      :aria-expanded="showAdvanced"
      :aria-controls="advancedSettingsContentId"
      @click="showAdvanced = !showAdvanced"
    >
      <span>{{ showAdvanced ? '▼' : '▶' }}</span>
      <span>⚙️ Advanced Settings</span>
    </button>

    <div
      v-if="showAdvanced"
      :id="advancedSettingsContentId"
      class="space-y-6 pl-6"
    >
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">
          Scoring Weights
        </h3>
        <p class="text-sm text-gray-400">
          Adjust how much each factor contributes to the final score
        </p>

        <div class="grid grid-cols-2 gap-4">
          <div
            v-for="weight in weightControls"
            :key="weight.field"
          >
            <label class="block text-sm font-medium mb-2">
              {{ weight.label }}: {{ formatPercent(form[weight.field]) }}
            </label>
            <input
              :value="form[weight.field]"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="w-full"
              @input="emitFieldUpdate(weight.field, $event.target.value)"
            >
          </div>
        </div>

        <div
          class="text-sm p-3 rounded-lg"
          :class="totalWeightIsValid ? 'bg-green-900/20 text-green-400' : 'bg-yellow-900/20 text-yellow-400'"
        >
          Total: {{ formatPercent(totalWeight) }}
          <span v-if="!totalWeightIsValid">(should equal 100%)</span>
          <span v-else>✓</span>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-semibold">
          Combination Mode
        </h3>
        <div class="space-y-2">
          <label
            v-for="mode in combinationModes"
            :key="mode.value"
            class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600"
          >
            <input
              :checked="form.combination_mode === mode.value"
              type="radio"
              :value="mode.value"
              class="w-4 h-4"
              @change="emitFieldUpdate('combination_mode', mode.value)"
            >
            <div>
              <div class="font-medium">{{ mode.label }}</div>
              <div class="text-xs text-gray-400">{{ mode.description }}</div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <h3 class="text-lg font-semibold">
        Classification Thresholds
      </h3>

      <div
        v-for="threshold in thresholdControls"
        :key="threshold.field"
      >
        <label class="block text-sm font-medium mb-2">
          {{ threshold.label }}: {{ form[threshold.field] }}%
        </label>
        <input
          :value="form[threshold.field]"
          type="range"
          :min="threshold.min"
          :max="threshold.max"
          class="w-full"
          @input="emitFieldUpdate(threshold.field, $event.target.value)"
        >
        <p class="text-xs text-gray-400 mt-1">
          {{ threshold.description }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import {
  POLICY_BUILDER_COMBINATION_MODE_CONTROLS,
  POLICY_BUILDER_THRESHOLD_CONTROLS,
  POLICY_BUILDER_WEIGHT_CONTROLS,
  formatPolicyBuilderPercent,
} from '@/utils/policyBuilderAdvancedControls'

const props = defineProps({
  form: {
    type: Object,
    required: true,
  },
  totalWeight: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits({
  'update-field': ({ field }) => typeof field === 'string',
})

const showAdvanced = ref(false)
const advancedSettingsContentId = `policy-builder-advanced-settings-panel-${useId()}`

const weightControls = POLICY_BUILDER_WEIGHT_CONTROLS
const combinationModes = POLICY_BUILDER_COMBINATION_MODE_CONTROLS
const thresholdControls = POLICY_BUILDER_THRESHOLD_CONTROLS

const totalWeightIsValid = computed(() => Math.abs(props.totalWeight - 1) <= 0.001)

const formatPercent = formatPolicyBuilderPercent

const emitFieldUpdate = (field, value) => {
  emit('update-field', { field, value })
}
</script>
