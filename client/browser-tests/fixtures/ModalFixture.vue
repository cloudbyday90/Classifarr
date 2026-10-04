<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { nextTick, ref } from 'vue'
import Modal from '@/components/common/Modal.vue'

const open = ref(false)
const secondOpen = ref(false)
const mounted = ref(true)
const showOpener = ref(true)
const fallbackRef = ref(null)
const destinationRef = ref(null)
const restore = ref(true)
const escapes = ref(0)
const closes = ref(0)
const removeOpener = () => { showOpener.value = false; open.value = false }
const handoff = async () => {
  restore.value = false
  open.value = false
  await nextTick()
  destinationRef.value.focus()
}
const switchDialog = () => { open.value = false; secondOpen.value = true }
const reopen = async () => { open.value = false; await nextTick(); open.value = true }
</script>

<template>
  <main class="p-6 space-y-4">
    <h1
      ref="fallbackRef"
      tabindex="-1"
      class="text-xl focus-visible:outline-2 focus-visible:outline-primary"
    >
      Recovery workflows
    </h1>
    <button
      v-if="showOpener"
      id="opener"
      type="button"
      @click="open = true"
    >
      Open workflow
    </button>
    <button
      ref="destinationRef"
      type="button"
    >
      Route destination
    </button>
    <output aria-label="Close deliveries">{{ closes }}</output>
    <output aria-label="Handled escapes">{{ escapes }}</output>
    <Modal
      v-if="mounted"
      v-model="open"
      title="Recovery options"
      :restore-focus="restore"
      :fallback-focus-target="() => fallbackRef"
      :on-update:model-value.camel="() => closes++"
    >
      <div class="space-y-4">
        <p>Choose an action. These fixture controls do not call the server.</p>
        <fieldset disabled>
          <legend>
            <button type="button">
              Available legend action
            </button>
          </legend>
          <button type="button">
            Disabled fieldset action
          </button>
        </fieldset>
        <label class="block">Sample query
          <input
            class="block border p-2"
            @keydown.esc.prevent="escapes++"
          >
        </label>
        <button
          type="button"
          @click="removeOpener"
        >
          Remove opener and close
        </button>
        <button
          type="button"
          @click="handoff"
        >
          Continue to route
        </button>
        <button
          type="button"
          @click="switchDialog"
        >
          Open next dialog
        </button>
        <button
          type="button"
          @click="reopen"
        >
          Close and reopen
        </button>
        <button
          type="button"
          @click="mounted = false"
        >
          Unmount dialog
        </button>
      </div>
      <template #footer>
        <button
          type="button"
          @click="open = false"
        >
          Finish
        </button>
        <div hidden>
          <button type="button">
            Hidden ancestor
          </button>
        </div>
        <div style="display:none">
          <button type="button">
            Display hidden
          </button>
        </div>
        <div style="visibility:hidden">
          <button type="button">
            Visibility hidden
          </button>
        </div>
        <div inert>
          <button type="button">
            Inert content
          </button>
        </div>
        <button
          type="button"
          disabled
        >
          Disabled action
        </button>
        <button
          type="button"
          tabindex="-2"
          class="sr-only"
        >
          Programmatic only
        </button>
      </template>
    </Modal>
    <Modal
      v-model="secondOpen"
      title="Next step"
      :fallback-focus-target="() => fallbackRef"
    >
      <p>Independent dialog with a separate focus lifecycle.</p>
    </Modal>
  </main>
</template>
