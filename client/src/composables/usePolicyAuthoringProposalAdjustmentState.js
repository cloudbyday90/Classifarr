/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import {
  normalizePolicyAuthoringProposalAdjustmentCommands,
} from '@/utils/policyAuthoringProposalAdjustment'

/**
 * Holds browser-local proposal adjustments only for the current prepared
 * proposal. Invalid values fail closed rather than surviving a lifecycle reset.
 */
export function usePolicyAuthoringProposalAdjustmentState() {
  const commands = ref([])

  const replace = value => {
    commands.value = normalizePolicyAuthoringProposalAdjustmentCommands(value) || []
  }

  const clear = () => {
    commands.value = []
  }

  return {
    commands,
    replace,
    clear,
  }
}
