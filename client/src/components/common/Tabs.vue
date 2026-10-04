<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div>
    <div
      v-if="items.length"
      class="border-b border-gray-700"
    >
      <div
        ref="listRef"
        role="tablist"
        :aria-label="label"
        aria-orientation="horizontal"
        class="flex overflow-x-auto gap-4 sm:gap-8 p-1"
        :onFocusout="leaveList"
      >
        <button
          v-for="tab in items"
          :id="tabId(tab.id)"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="selectedId === tab.id"
          :aria-controls="panelId(tab.id)"
          :tabindex="entryId === tab.id ? 0 : -1"
          :class="[
            'whitespace-nowrap flex-shrink-0 py-4 px-2 border-b-2 font-medium text-sm rounded-sm scroll-m-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            selectedId === tab.id
              ? 'border-primary-light text-primary-light'
              : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
          ]"
          :onClick="event => activate(tab.id, event)"
          :onFocus="event => focusTab(tab.id, event)"
          :onKeydown="handleKeydown"
        >
          <span
            v-if="tab.icon"
            class="mr-2"
            aria-hidden="true"
          >{{ tab.icon }}</span>
          {{ tab.label }}
          <span
            v-if="tab.badge !== undefined && tab.badge !== ''"
            class="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary-light"
          >
            {{ tab.badge }}
          </span>
        </button>
      </div>
    </div>
    <div
      v-for="tab in items"
      :id="panelId(tab.id)"
      :key="tab.id"
      role="tabpanel"
      :aria-labelledby="tabId(tab.id)"
      :hidden="selectedId !== tab.id"
      tabindex="0"
      class="mt-6 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <slot
        v-if="selectedId === tab.id"
        :name="tab.id"
      />
    </div>
  </div>
</template>

<script setup>
import { useTemplateRef } from 'vue'
import { useTabs } from '@/composables/useTabs.js'

const listRef = useTemplateRef('listRef')
const props = defineProps({
  modelValue: { type: String, required: true },
  tabs: { type: /** @type {import('vue').PropType<import('@/composables/useTabs.js').TabItem[]>} */ (Array), required: true },
  label: { type: String, default: 'Sections' },
})
const emit = defineEmits({
  'update:modelValue': /** @param {string} id */ id => typeof id === 'string',
})
const { items, selectedId, entryId, tabId, panelId, focusTab, leaveList, activate, handleKeydown } = useTabs({
  getTabs: () => props.tabs,
  getValue: () => props.modelValue,
  list: listRef,
  onUpdate: id => emit('update:modelValue', id),
})
</script>
