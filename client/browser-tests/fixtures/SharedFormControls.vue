<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref } from 'vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Slider from '@/components/common/Slider.vue'
import Button from '@/components/common/Button.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import TagInput from '@/components/common/TagInput.vue'

const priority = ref(2)
const route = ref(1)
const enabled = ref(false)
const threshold = ref(50)
const disabled = ref(false)
const submissions = ref(0)
const error = ref('Review this priority')
const deliveries = ref({ input: 0, select: 0, toggle: 0, slider: 0, button: 0 })
const credential = ref('')
const credentialDisabled = ref(false)
const credentialError = ref('Check the sample key')
const credentialDeliveries = ref(0)
const credentialSubmissions = ref(0)
const submittedInputType = ref('')
const tags = ref(['first', 'last'])
const tagsDisabled = ref(false)
const tagDeliveries = ref(0)
const tagSubmissions = ref(0)

/** @param {SubmitEvent} event */
function submitCredential(event) {
  event.preventDefault()
  const input = event.currentTarget instanceof globalThis.HTMLFormElement ? event.currentTarget.querySelector('input') : null
  submittedInputType.value = input?.type ?? ''
  credentialSubmissions.value++
}
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
        :on-update:model-value.camel="() => deliveries.input++"
      />
      <Select
        v-model="route"
        label="Route"
        :options="[{ value: 1, label: 'One' }, { value: 2, label: 'Two' }]"
        :disabled="disabled"
        :on-update:model-value.camel="() => deliveries.select++"
      />
      <Toggle
        v-model="enabled"
        label="Enabled"
        :disabled="disabled"
        :on-update:model-value.camel="() => deliveries.toggle++"
      />
      <Slider
        v-model="threshold"
        label="Threshold"
        :step="5"
        :disabled="disabled"
        :on-update:model-value.camel="() => deliveries.slider++"
      />
      <Button
        :disabled="disabled"
        :on-click.camel="() => deliveries.button++"
      >
        Confirm choice
      </Button>
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
    <output
      class="block wrap-anywhere"
      aria-label="Model values"
    >{{ JSON.stringify({ priority, route, enabled, threshold }) }}</output>
    <output aria-label="Submissions">{{ submissions }}</output>
    <output
      class="block wrap-anywhere"
      aria-label="Listener deliveries"
    >{{ JSON.stringify(deliveries) }}</output>
    <section class="space-y-4">
      <h2>Sample credential</h2>
      <p id="credential-help">
        Use a dummy value only.
      </p>
      <form
        class="space-y-4"
        @submit="submitCredential"
      >
        <PasswordInput
          v-model="credential"
          label="Provider key"
          name="credential"
          hint="Paste the complete key."
          aria-describedby="credential-help"
          required
          :error="credentialError"
          :disabled="credentialDisabled"
          :on-update:model-value.camel="() => credentialDeliveries++"
        />
        <button type="submit">
          Save sample credential
        </button>
      </form>
      <PasswordInput
        label="Read-only token"
        model-value="dummy-readonly"
        readonly
      />
      <label>
        <input
          v-model="credentialDisabled"
          type="checkbox"
        > Disable credential
      </label>
      <button
        type="button"
        @click="credentialError = ''"
      >
        Clear credential error
      </button>
      <output aria-label="Credential deliveries">{{ credentialDeliveries }}</output>
      <output aria-label="Credential submissions">{{ credentialSubmissions }}</output>
      <output aria-label="Submitted input type">{{ submittedInputType }}</output>
    </section>
    <section class="space-y-4">
      <h2>Sample tags</h2>
      <form @submit.prevent="tagSubmissions++">
        <fieldset :disabled="tagsDisabled">
          <TagInput
            v-model="tags"
            label="Keywords"
            :on-update:model-value.camel="() => tagDeliveries++"
          />
        </fieldset>
        <button type="submit">
          Save sample tags
        </button>
      </form>
      <TagInput
        label="Read-only tags"
        :model-value="['protected']"
        readonly
      />
      <label>
        <input
          v-model="tagsDisabled"
          type="checkbox"
        > Disable tags
      </label>
      <output
        class="block wrap-anywhere"
        aria-label="Tag values"
      >{{ JSON.stringify(tags) }}</output>
      <output aria-label="Tag deliveries">{{ tagDeliveries }}</output>
      <output aria-label="Tag submissions">{{ tagSubmissions }}</output>
    </section>
  </main>
</template>
