<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref } from 'vue'
import Tabs from '@/components/common/Tabs.vue'

const selected = ref('overview')
const secondary = ref('overview')
const deliveries = ref(0)
const submissions = ref(0)
const tabs = ref([
  { id: 'overview', label: 'Overview', icon: '📋', badge: 0 },
  { id: 'rules', label: 'Rules' },
  { id: 'automation', label: 'Automation details and health' },
])
const secondaryTabs = [...tabs.value]
</script>

<template>
  <main class="max-w-lg p-6 space-y-6">
    <h1 class="text-xl">
      Tabs interaction preview
    </h1>
    <button type="button">
      Before tabs
    </button>
    <form @submit.prevent="submissions++">
      <Tabs
        v-model="selected"
        label="Configuration sections"
        :tabs="tabs"
        :on-update:model-value.camel="() => deliveries++"
      >
        <template #overview>
          <p>Overview content.</p>
          <button type="button">
            Overview action
          </button>
        </template>
        <template #rules>
          <button type="button">
            Rules action
          </button>
        </template>
        <template #automation>
          <p>Automation status.</p>
        </template>
      </Tabs>
      <button type="submit">
        Save sample
      </button>
    </form>
    <button
      type="button"
      @click="tabs = tabs.filter(tab => tab.id !== 'rules')"
    >
      Remove rules
    </button>
    <button
      type="button"
      @click="selected = 'automation'"
    >
      Select automation externally
    </button>
    <Tabs
      v-model="secondary"
      label="Secondary sections"
      :tabs="secondaryTabs"
    >
      <template #overview>
        <p>Independent overview.</p>
      </template>
      <template #rules>
        <p>Independent rules.</p>
      </template>
      <template #automation>
        <p>Independent automation.</p>
      </template>
    </Tabs>
    <output aria-label="Selected section">{{ selected }}</output>
    <output aria-label="Selection deliveries">{{ deliveries }}</output>
    <output aria-label="Form submissions">{{ submissions }}</output>
  </main>
</template>
