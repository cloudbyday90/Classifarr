<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="recovery?.requiresAction"
    class="mt-4 rounded-lg border px-3 py-3"
    :class="recoveryClass"
    :role="announcementRole"
    :aria-live="announcementLive"
    :aria-atomic="announce ? 'true' : null"
    aria-labelledby="policy-native-evidence-recovery-title"
  >
    <h6
      id="policy-native-evidence-recovery-title"
      class="text-sm font-semibold"
    >
      {{ recovery.heading }}
    </h6>
    <p
      id="policy-native-evidence-recovery-message"
      class="mt-1 text-sm"
    >
      {{ recovery.message }}
    </p>
    <Button
      v-if="recovery.actionId"
      class="mt-3"
      size="sm"
      variant="outline-solid"
      :disabled="refreshing"
      aria-describedby="policy-native-evidence-recovery-message"
      @click="emitRecoveryAction"
    >
      {{ recoveryActionLabel }}
    </Button>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/components/common/Button.vue'
import {
  POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS,
  POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS,
} from '@/utils/policyNativeEvidenceRecovery'

const props = defineProps({
  recovery: {
    type: Object,
    default: null,
  },
  refreshing: {
    type: Boolean,
    default: false,
  },
  announce: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits({
  'refresh-profile': () => true,
  'reload-workflow': () => true,
})

const announcementRole = computed(() => {
  if (!props.announce) return null

  return props.recovery?.statusId === POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.REFRESH_FAILED
    ? 'alert'
    : 'status'
})

const announcementLive = computed(() => (
  announcementRole.value === 'alert'
    ? 'assertive'
    : announcementRole.value === 'status'
      ? 'polite'
      : null
))

const recoveryClass = computed(() => (
  props.recovery?.tone === 'success'
    ? 'border-green-800/70 bg-green-950/30 text-green-100'
    : 'border-amber-700/70 bg-amber-950/30 text-amber-100'
))

const recoveryActionLabel = computed(() => (
  props.refreshing
    ? props.recovery?.busyLabel || 'Working on library evidence...'
    : props.recovery?.actionLabel || ''
))

const emitRecoveryAction = () => {
  if (props.refreshing) return

  if (props.recovery?.actionId === POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.REFRESH_PROFILE) {
    emit('refresh-profile')
  } else if (props.recovery?.actionId === POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.RELOAD_WORKFLOW) {
    emit('reload-workflow')
  }
}
</script>
