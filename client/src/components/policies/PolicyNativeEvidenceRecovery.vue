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
    aria-atomic="true"
    aria-labelledby="policy-native-evidence-recovery-title"
  >
    <h6
      id="policy-native-evidence-recovery-title"
      class="text-sm font-semibold"
    >
      {{ recovery.heading }}
    </h6>
    <p class="mt-1 text-sm">
      {{ recovery.message }}
    </p>
    <Button
      v-if="recovery.actionId"
      class="mt-3"
      size="sm"
      variant="outline-solid"
      :disabled="refreshing"
      @click="emitRecoveryAction"
    >
      {{ refreshing ? 'Refreshing library profile...' : recovery.actionLabel }}
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
})

const emit = defineEmits({
  'refresh-profile': () => true,
  'reload-workflow': () => true,
})

const announcementRole = computed(() => (
  props.recovery?.statusId === POLICY_NATIVE_EVIDENCE_RECOVERY_STATUS_IDS.REFRESH_FAILED
    ? 'alert'
    : 'status'
))

const announcementLive = computed(() => (
  announcementRole.value === 'alert' ? 'assertive' : 'polite'
))

const recoveryClass = computed(() => (
  props.recovery?.tone === 'success'
    ? 'border-green-800/70 bg-green-950/30 text-green-100'
    : 'border-amber-700/70 bg-amber-950/30 text-amber-100'
))

const emitRecoveryAction = () => {
  if (props.refreshing) return

  if (props.recovery?.actionId === POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.REFRESH_PROFILE) {
    emit('refresh-profile')
  }

  if (props.recovery?.actionId === POLICY_NATIVE_EVIDENCE_RECOVERY_ACTION_IDS.RELOAD_WORKFLOW) {
    emit('reload-workflow')
  }
}
</script>
