<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <form
    class="mt-4 space-y-2 max-w-md"
    novalidate
    @submit.prevent="verify"
  >
    <label
      :for="inputId"
      class="block font-medium"
    >Discord message ID</label>
    <p
      :id="`${inputId}-help`"
      class="text-xs text-gray-300"
    >
      Copy the message ID from Discord's developer mode. Checks this channel only; nothing is resent.
    </p>
    <input
      :id="inputId"
      v-model="messageId"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      maxlength="20"
      :readonly="busy || confirmed"
      :aria-invalid="invalid"
      :aria-describedby="`${inputId}-help ${inputId}-result`"
      class="block w-full rounded border border-gray-500 bg-gray-900 p-2 focus-visible:outline-2 focus-visible:outline-blue-300"
    >
    <button
      type="submit"
      :aria-disabled="busy || confirmed"
      class="rounded border border-gray-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-300 aria-disabled:opacity-60"
    >
      {{ busy ? 'Checking…' : confirmed ? 'Confirmed' : 'Verify delivery' }}
    </button>
    <p
      :id="`${inputId}-result`"
      role="status"
      class="text-sm text-gray-200"
    >
      {{ feedback }}
    </p>
  </form>
</template>

<script setup>
import { useId } from 'vue'
import { useDiscordDeliveryVerification } from '../../composables/useDiscordDeliveryVerification'

const props = defineProps({ classificationId: { type: String, required: true } })
const emit = defineEmits(['confirmed'])
const inputId = useId()
const { messageId, busy, confirmed, feedback, invalid, verify } = useDiscordDeliveryVerification(
  props.classificationId, messageId => emit('confirmed', messageId),
)
</script>
