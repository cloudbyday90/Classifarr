<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref } from 'vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Slider from '@/components/common/Slider.vue'

const priority = ref(2)
const route = ref(1)
const enabled = ref(false)
const threshold = ref(50)
const disabled = ref(false)
const submissions = ref(0)
const error = ref('Review this priority')
</script>

<template>
  <main class="max-w-lg p-6 space-y-4">
    <h1>Shared form controls</h1>
    <p id="priority-help">
      Use a priority from 1 to 9.
    </p>
    <form
      class="space-y-4"
      @submit.prevent="submissions++"
    >
      <Input
        id="priority"
        v-model.number="priority"
        label="Priority"
        type="number"
        name="priority"
        min="1"
        max="9"
        required
        aria-describedby="priority-help"
        :error="error"
        :disabled="disabled"
      />
      <Select
        v-model="route"
        label="Route"
        :options="[{ value: 1, label: 'One' }, { value: 2, label: 'Two' }]"
        :disabled="disabled"
      />
      <Toggle
        v-model="enabled"
        label="Enabled"
        :disabled="disabled"
      />
      <Slider
        v-model="threshold"
        label="Threshold"
        :step="5"
        :disabled="disabled"
      />
    </form>
    <label>
      <input
        v-model="disabled"
        type="checkbox"
      > Disable controls
    </label>
    <button
      type="button"
      @click="error = ''"
    >
      Clear error
    </button>
    <output aria-label="Model values">{{ JSON.stringify({ priority, route, enabled, threshold }) }}</output>
    <output aria-label="Submissions">{{ submissions }}</output>
  </main>
</template>
