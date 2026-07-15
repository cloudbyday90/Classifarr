<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <dialog
    ref="dialog"
    class="w-full max-w-lg rounded-lg border border-yellow-600/70 bg-background-light p-0 text-white backdrop:bg-black/75"
    aria-labelledby="native-intent-conversion-title"
    @cancel="handleCancel"
    @close="handleNativeClose"
  >
    <form
      class="space-y-5 p-6"
      @submit.prevent="submit"
    >
      <div class="space-y-2">
        <h2
          id="native-intent-conversion-title"
          class="text-xl font-semibold"
        >
          Confirm native intent conversion
        </h2>
        <p class="text-sm text-gray-300">
          Convert {{ selectedCount }} {{ selectedCount === 1 ? 'selected policy' : 'selected policies' }}
          to native intent storage. This does not configure routing or change
          automation readiness.
        </p>
      </div>

      <ul class="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-700 bg-background p-3 text-sm text-gray-200">
        <li
          v-for="candidate in selectedCandidates"
          :key="candidate.policyId"
        >
          {{ candidate.policyName }}<span v-if="candidate.libraryName">, {{ candidate.libraryName }}</span>
        </li>
      </ul>

      <div>
        <label
          for="native-intent-conversion-confirmation"
          class="block text-sm font-medium text-white"
        >
          Type {{ confirmationValue }} to confirm
        </label>
        <input
          id="native-intent-conversion-confirmation"
          ref="confirmationInput"
          v-model="confirmation"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="mt-2 w-full rounded border border-gray-600 bg-background px-3 py-2 font-mono text-sm text-white focus:border-primary focus:outline-none"
          :aria-describedby="confirmationError ? 'native-intent-conversion-confirmation-error' : undefined"
        >
        <p
          v-if="confirmationError"
          id="native-intent-conversion-confirmation-error"
          class="mt-2 text-sm text-red-300"
          role="alert"
        >
          {{ confirmationError }}
        </p>
      </div>

      <div class="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          class="rounded border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:border-gray-400"
          :disabled="isApplying"
          @click="close"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="rounded bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isApplying || confirmation !== confirmationValue"
        >
          {{ isApplying ? 'Converting...' : 'Convert selected policies' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  selectedCandidates: {
    type: Array,
    default: () => [],
  },
  confirmationValue: {
    type: String,
    required: true,
  },
  isApplying: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const dialog = ref(null)
const confirmationInput = ref(null)
const confirmation = ref('')
const confirmationError = ref('')

const selectedCount = computed(() => props.selectedCandidates.length)

function focusConfirmationInput() {
  confirmationInput.value?.focus()
}

async function openDialog() {
  await nextTick()

  if (!dialog.value?.open) {
    if (typeof dialog.value?.showModal === 'function') {
      dialog.value.showModal()
    } else {
      dialog.value.open = true
    }
  }

  focusConfirmationInput()
}

function closeDialog() {
  if (dialog.value?.open && typeof dialog.value.close === 'function') {
    dialog.value.close()
  } else if (dialog.value) {
    dialog.value.open = false
  }
}

function close() {
  confirmation.value = ''
  confirmationError.value = ''
  closeDialog()
  emit('update:modelValue', false)
}

function handleCancel(event) {
  event.preventDefault()
  close()
}

function handleNativeClose() {
  confirmation.value = ''
  confirmationError.value = ''
  emit('update:modelValue', false)
}

function submit() {
  if (confirmation.value !== props.confirmationValue) {
    confirmationError.value = `Type ${props.confirmationValue} exactly to confirm.`
    focusConfirmationInput()
    return
  }

  confirmationError.value = ''
  emit('confirm', confirmation.value)
}

watch(() => props.modelValue, isOpen => {
  if (isOpen) {
    openDialog()
  } else {
    closeDialog()
  }
}, { immediate: true })
</script>
