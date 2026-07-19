<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border border-green-800/70 bg-green-950/30 p-5 text-green-100"
    aria-labelledby="policy-native-create-handoff-title"
  >
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      Policy created. {{ handoff.policy.name }} is ready for review.
    </p>
    <h4
      id="policy-native-create-handoff-title"
      ref="heading"
      tabindex="-1"
      class="text-lg font-semibold outline-none"
    >
      Policy created
    </h4>
    <p class="mt-2 text-sm text-green-50">
      {{ handoff.policy.name }} now has declared destination intent for {{ handoff.policy.libraryName }}.
    </p>

    <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
      <div class="rounded border border-green-800/70 bg-gray-900/30 p-3">
        <dt class="font-medium text-green-200">
          Saved intent
        </dt>
        <dd class="mt-1 text-green-50">
          {{ handoff.declaredIntent.ruleCount }} declared destination {{ handoff.declaredIntent.ruleCount === 1 ? 'rule' : 'rules' }}
        </dd>
      </div>
      <div class="rounded border border-green-800/70 bg-gray-900/30 p-3">
        <dt class="font-medium text-green-200">
          Policy authority
        </dt>
        <dd class="mt-1 text-green-50">
          {{ handoff.declaredIntent.authorityLabel }}
        </dd>
      </div>
      <div class="rounded border border-green-800/70 bg-gray-900/30 p-3">
        <dt class="font-medium text-green-200">
          Routing
        </dt>
        <dd class="mt-1 text-green-50">
          {{ handoff.routing.label }}
        </dd>
      </div>
    </dl>

    <p
      v-if="handoff.detailsAvailable"
      class="mt-4 text-sm text-green-50"
    >
      {{ handoff.routing.message }}
    </p>
    <p
      v-else
      class="mt-4 text-sm text-green-50"
    >
      The policy is saved. Its detailed summary could not be reloaded, so review it from the policy list when the connection is available.
    </p>

    <Button
      class="mt-5"
      variant="success"
      @click="emit('done')"
    >
      Done
    </Button>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import Button from '@/components/common/Button.vue'

defineProps({
  handoff: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  done: () => true,
})

const heading = ref(null)

defineExpose({
  focus: () => heading.value?.focus(),
})
</script>
