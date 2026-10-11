<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section aria-label="Human-reviewed episode mappings">
    <p>For a missing ID or a different episode order, explicitly identify the catalog episode. These are your identity decisions, not automatic matches. Plex, Emby and Jellyfin remain unchanged.</p>
    <fieldset
      v-for="(edge, index) in modelValue"
      :key="index"
    >
      <legend>Episode mapping {{ index + 1 }}</legend>
      <div
        v-for="(label, field) in episodeMappingFields"
        :key="field"
      >
        <label :for="`${id}-${index}-${field}`">{{ label }}</label>
        <input
          :id="`${id}-${index}-${field}`"
          :value="edge[field]"
          type="number"
          step="1"
          required
          :min="field.endsWith('Id') ? 1 : 0"
          :max="field.endsWith('Id') ? 2147483647 : 10000"
          @input="update(index, field, $event.target.value)"
        >
      </div>
      <button
        type="button"
        :aria-label="`Remove episode mapping ${index + 1}`"
        @click="remove(index)"
      >
        Remove episode mapping
      </button>
    </fieldset>
    <button
      ref="addButton"
      type="button"
      :disabled="modelValue.length >= 64"
      @click="add"
    >
      Add reviewed episode mapping
    </button>
    <p v-if="modelValue.length">
      Every row needs a real TMDb episode ID and its series/season/episode coordinates. Review the returned title before saving. Unmapped or ambiguous episodes keep the entire group unresolved.
    </p>
  </section>
</template>
<script setup>
import { nextTick, ref, useId } from 'vue'
import { episodeMappingFields } from '@/utils/reviewedEpisodeMappings'
const props = defineProps({ modelValue: { type: Array, required: true } })
const emit = defineEmits(['update:modelValue'])
const id = useId(), addButton = ref(null)
function add() {
  if (props.modelValue.length < 64) emit('update:modelValue', [...props.modelValue, Object.fromEntries(Object.keys(episodeMappingFields).map(key => [key, '']))])
}
function update(index, field, value) {
  emit('update:modelValue', props.modelValue.map((edge, i) => i === index ? { ...edge, [field]: value === '' ? '' : Number(value) } : edge))
}
async function remove(index) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
  await nextTick(); addButton.value?.focus()
}
</script>
<style scoped>
section, fieldset { margin-top: .75rem; padding: .75rem; border: 1px solid #64748b; border-radius: .4rem; min-width: 0; }
p { margin: .75rem 0; overflow-wrap: anywhere; }
label { display: block; margin-top: .75rem; }
input, button { min-height: 2.75rem; max-width: 100%; padding: .5rem; border: 1px solid #64748b; border-radius: .35rem; background: #1e293b; color: #f1f5f9; }
button { margin-top: .75rem; } button:disabled { opacity: .5; }
:is(input, button):focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>
