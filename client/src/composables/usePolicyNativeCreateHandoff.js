/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref } from 'vue'
import { getPolicy } from '@/api/policiesApi'
import { buildPolicyNativeCreateHandoff } from '@/utils/policyNativeCreateHandoff'

export function usePolicyNativeCreateHandoff({ loadPolicy = getPolicy } = {}) {
  const handoff = ref(null)
  const loading = ref(false)

  const establishHandoff = async (createResponse) => {
    const initialHandoff = buildPolicyNativeCreateHandoff({ createResponse })
    if (!initialHandoff) return false

    handoff.value = initialHandoff
    loading.value = true

    try {
      const persistedPolicy = await loadPolicy(initialHandoff.policy.id)
      handoff.value = buildPolicyNativeCreateHandoff({
        createResponse,
        persistedPolicy,
      }) || initialHandoff
    } catch {
      // The create receipt is authoritative even if the follow-up read is unavailable.
      handoff.value = initialHandoff
    } finally {
      loading.value = false
    }

    return true
  }

  return {
    handoff,
    loading,
    establishHandoff,
  }
}
