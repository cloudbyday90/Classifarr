<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">
        Library Policy Setup
      </h1>
      <p class="mt-1 text-sm text-gray-400">
        Classifarr checks each connected library and shows the one safe next policy-authoring state.
      </p>
    </div>

    <div
      v-if="libraryLoadError"
      class="rounded-lg border border-red-500/40 bg-red-900/20 p-4 text-sm text-red-100"
      role="alert"
    >
      <p class="font-semibold">
        Connected libraries are unavailable
      </p>
      <p class="mt-1">
        {{ libraryLoadError }}
      </p>
      <button
        type="button"
        class="mt-3 rounded border border-red-400/70 px-3 py-1.5 font-medium hover:bg-red-950/50 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 focus:ring-offset-gray-950"
        @click="loadAuthoringEntries"
      >
        Try again
      </button>
    </div>

    <section
      v-else-if="selectedEntry"
      :id="`policy-authoring-selection-${selectedEntry.library.id}`"
      ref="selectedLifecycleElement"
      class="rounded-lg border border-primary/70 bg-primary/10 p-5"
      tabindex="-1"
      aria-labelledby="policy-authoring-selection-heading"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary-200">
            Destination proposal
          </p>
          <h2
            id="policy-authoring-selection-heading"
            class="mt-1 text-xl font-semibold text-white"
          >
            {{ selectedEntry.library.name }}
          </h2>
        </div>
        <span
          :class="selectedBadgeClass"
          class="rounded-full border px-3 py-1 text-xs font-semibold"
        >
          {{ selectedEntry.label }}
        </span>
      </div>
      <p class="mt-4 text-sm leading-6 text-gray-200">
        {{ selectedEntry.message }}
      </p>
      <p
        v-if="selectedEntry.policy?.name"
        class="mt-2 text-sm text-gray-300"
      >
        Current policy: <span class="font-medium text-gray-100">{{ selectedEntry.policy.name }}</span>
      </p>
      <div
        v-if="proposalOutcomeRecoveryNotice"
        class="mt-4 rounded border border-primary/60 bg-primary/10 p-4 text-sm text-primary-100"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :aria-busy="proposalOutcomeRecoveryLoading"
      >
        {{ proposalOutcomeRecoveryNotice.message }}
      </div>
      <div v-if="selectedEntry.canSelect">
        <p
          v-if="!destinationProposalLifecycle || destinationProposalLifecycle.canSelect"
          class="mt-2 text-sm leading-6 text-gray-300"
        >
          No policy has been created. Classifarr prepares one server-confirmed destination proposal from the current library profile.
        </p>
        <div
          v-if="destinationProposalLoading"
          class="mt-5 rounded border border-primary/60 bg-primary/10 p-4 text-sm text-primary-100"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Preparing the current destination proposal...
        </div>
        <PolicyDestinationProposalCard
          v-else-if="destinationProposalPresentation"
          :proposal="destinationProposalPresentation"
          :loading="proposalAdmissionLoading"
          :feedback="proposalAdmissionFeedback"
          :completed-policy="successfulAdmission?.policy || null"
          :adjustment-commands="proposalAdjustmentCommands"
          @admit="admitDestinationProposal"
          @update:adjustment-commands="setProposalAdjustmentCommands"
        />
        <div
          v-else-if="destinationProposalLifecycle"
          class="mt-5 rounded border border-amber-600/70 bg-amber-950/30 p-4 text-sm text-amber-100"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ destinationProposalLifecycle.message }}
        </div>
        <div
          v-else-if="destinationProposalError"
          class="mt-5 rounded border border-red-600/70 bg-red-950/30 p-4 text-sm text-red-100"
          role="alert"
        >
          {{ destinationProposalError }}
        </div>
      </div>
      <p
        v-else
        class="mt-2 text-sm leading-6 text-gray-300"
      >
        Classifarr will not create another policy from this route.
      </p>
      <p
        v-if="successfulAdmission?.policy && successfulAdmission.policy.libraryId === selectedEntry.library.id"
        class="mt-5 rounded border border-green-700/70 bg-green-950/40 p-4 text-sm font-medium text-green-100"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Policy created: {{ successfulAdmission.policy.name }}
      </p>
      <button
        type="button"
        class="mt-5 rounded border border-gray-600 px-4 py-2 text-sm font-medium text-gray-100 hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950"
        @click="clearSelectedLibrary"
      >
        Back to library policy setup
      </button>
    </section>

    <div
      v-else-if="selectedLibraryId && !lifecycleLoading"
      class="rounded-lg border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-100"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      The selected library is no longer available. Return to the current library policy setup list.
      <button
        type="button"
        class="ml-2 font-semibold underline underline-offset-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-200"
        @click="clearSelectedLibrary"
      >
        Return to list
      </button>
    </div>

    <div
      v-if="librariesLoading || lifecycleLoading"
      class="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-sm text-gray-300"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      Checking current library authoring states...
    </div>

    <div
      v-else-if="lifecycleEntries.length === 0"
      class="rounded-lg border border-gray-700 bg-gray-900/40 p-6 text-center"
    >
      <h2 class="text-lg font-semibold text-white">
        No connected libraries
      </h2>
      <p class="mt-2 text-sm text-gray-400">
        Connect a media server library before setting up policy authoring.
      </p>
    </div>

    <section
      v-else
      aria-labelledby="policy-authoring-lifecycle-heading"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="policy-authoring-lifecycle-heading"
            class="text-lg font-semibold text-white"
          >
            Connected libraries
          </h2>
          <p class="mt-1 text-sm text-gray-400">
            Each library has one server-confirmed authoring outcome.
          </p>
        </div>
        <button
          v-if="hasUnavailableEntries"
          type="button"
          class="rounded border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950"
          @click="reloadLifecycleEntries"
        >
          Reload authoring states
        </button>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PolicyAuthoringLifecycleEntry
          v-for="entry in lifecycleEntries"
          :key="entry.library.id"
          :entry="entry"
          @select="selectLibrary"
          @review-maintenance="reviewPolicyMaintenance"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getLibraries } from '@/api/libraryCatalogApi'
import PolicyDestinationProposalCard from '@/components/policies/PolicyDestinationProposalCard.vue'
import PolicyAuthoringLifecycleEntry from '@/components/policies/PolicyAuthoringLifecycleEntry.vue'
import { usePolicyAuthoringDestinationProposal } from '@/composables/usePolicyAuthoringDestinationProposal'
import { usePolicyAuthoringLifecycleList } from '@/composables/usePolicyAuthoringLifecycleList'
import { usePolicyAuthoringProposalAdmission } from '@/composables/usePolicyAuthoringProposalAdmission'
import { usePolicyAuthoringProposalAdjustmentState } from '@/composables/usePolicyAuthoringProposalAdjustmentState'
import { usePolicyAuthoringProposalOutcomeRecovery } from '@/composables/usePolicyAuthoringProposalOutcomeRecovery'

const route = useRoute()
const router = useRouter()
const libraries = ref([])
const librariesLoading = ref(false)
const libraryLoadError = ref('')
const selectedLifecycleElement = ref(null)
let activeLibraryRequestId = 0
let focusSelection = false
let restoreFocusLibraryId = null
const successfulAdmission = ref(null)

const {
  commands: proposalAdjustmentCommands,
  replace: replaceProposalAdjustmentCommands,
  clear: clearProposalAdjustmentCommands,
} = usePolicyAuthoringProposalAdjustmentState()

const {
  entries: lifecycleEntries,
  loading: lifecycleLoading,
  hasUnavailableEntries,
  load: loadLifecycleEntries,
} = usePolicyAuthoringLifecycleList()

const {
  presentation: destinationProposalPresentation,
  admission: destinationProposalAdmission,
  lifecycle: destinationProposalLifecycle,
  loading: destinationProposalLoading,
  error: destinationProposalError,
  clear: clearDestinationProposal,
  load: loadDestinationProposal,
} = usePolicyAuthoringDestinationProposal()

const {
  loading: proposalAdmissionLoading,
  feedback: proposalAdmissionFeedback,
  recovery: proposalAdmissionRecovery,
  clear: clearProposalAdmission,
  admit: admitProposal,
} = usePolicyAuthoringProposalAdmission()

function normalizeLibraryId(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function normalizeRouteLibraryId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null

  return normalizeLibraryId(value)
}

function selectedQueryWithoutLibrary() {
  const query = { ...route.query }
  delete query.library
  return query
}

const selectedLibraryId = computed(() => normalizeRouteLibraryId(route.query.library))
const selectedEntry = computed(() => lifecycleEntries.value.find(entry => (
  entry.library.id === selectedLibraryId.value
)) || null)
const destinationProposalSelectionKey = computed(() => {
  const entry = selectedEntry.value
  return entry?.canSelect ? `${entry.library.id}:${entry.statusId}` : null
})
const destinationProposalRevision = computed(() => destinationProposalAdmission.value?.revision || null)
const selectedBadgeClass = computed(() => {
  switch (selectedEntry.value?.tone) {
    case 'success':
      return 'border-green-700/80 bg-green-950/50 text-green-200'
    case 'warning':
      return 'border-amber-700/80 bg-amber-950/50 text-amber-100'
    case 'danger':
      return 'border-red-700/80 bg-red-950/50 text-red-100'
    default:
      return 'border-gray-600 bg-gray-800 text-gray-200'
  }
})

const loadAuthoringEntries = async () => {
  const requestId = activeLibraryRequestId + 1
  activeLibraryRequestId = requestId
  librariesLoading.value = true
  libraryLoadError.value = ''

  try {
    const result = await getLibraries()
    if (requestId !== activeLibraryRequestId) return

    libraries.value = Array.isArray(result) ? result : []
    await loadLifecycleEntries(libraries.value)
  } catch {
    if (requestId === activeLibraryRequestId) {
      libraries.value = []
      libraryLoadError.value = 'Classifarr could not load connected libraries. Try again to check the current authoring states.'
    }
  } finally {
    if (requestId === activeLibraryRequestId) {
      librariesLoading.value = false
    }
  }
}

const reloadLifecycleEntries = async () => {
  await loadLifecycleEntries(libraries.value)
}

const reloadSelectedLifecycle = async libraryId => {
  const normalizedLibraryId = normalizeLibraryId(libraryId)
  if (!normalizedLibraryId) return null

  await reloadLifecycleEntries()
  return lifecycleEntries.value.find(entry => entry.library.id === normalizedLibraryId)?.statusId || null
}

const {
  loading: proposalOutcomeRecoveryLoading,
  notice: proposalOutcomeRecoveryNotice,
  clear: clearProposalOutcomeRecovery,
  recover: recoverProposalOutcome,
} = usePolicyAuthoringProposalOutcomeRecovery({
  reloadLifecycle: reloadSelectedLifecycle,
})

const reconcileProposalOutcome = async recovery => {
  const currentEntry = selectedEntry.value
  if (!recovery || !currentEntry || currentEntry.library.id !== recovery.libraryId) return

  successfulAdmission.value = null
  clearProposalAdjustmentCommands()
  clearDestinationProposal()
  clearProposalAdmission()
  await recoverProposalOutcome(recovery)
}

const admitDestinationProposal = async () => {
  const admissionResult = await admitProposal(
    destinationProposalAdmission.value,
    proposalAdjustmentCommands.value
  )
  if (!admissionResult?.policy) {
    await reconcileProposalOutcome(proposalAdmissionRecovery.value)
    return
  }

  successfulAdmission.value = admissionResult
  await reloadLifecycleEntries()
}

const setProposalAdjustmentCommands = commands => {
  replaceProposalAdjustmentCommands(commands)
}

const selectLibrary = async (libraryId) => {
  const normalizedLibraryId = normalizeLibraryId(libraryId)
  if (!normalizedLibraryId) return

  await router.push({
    name: 'Policies',
    query: {
      ...route.query,
      library: String(normalizedLibraryId),
    },
  })
}

const reviewPolicyMaintenance = async (entry) => {
  const policyId = Number(entry?.policy?.id)
  if (!Number.isInteger(policyId) || policyId <= 0) return

  await router.push({
    name: 'PolicyNativeIntentReconciliation',
    query: {
      policy: String(policyId),
    },
  })
}

const clearSelectedLibrary = async () => {
  await router.push({
    name: 'Policies',
    query: selectedQueryWithoutLibrary(),
  })
}

async function applyRouteFocus() {
  await nextTick()

  if (focusSelection && selectedLifecycleElement.value) {
    selectedLifecycleElement.value.focus()
    focusSelection = false
    return
  }

  if (restoreFocusLibraryId) {
    const action = document.getElementById(
      `policy-authoring-lifecycle-action-${restoreFocusLibraryId}`
    )
    if (action) {
      action.focus()
      restoreFocusLibraryId = null
    }
  }
}

watch(selectedLibraryId, (nextLibraryId, previousLibraryId) => {
  if (nextLibraryId && nextLibraryId !== previousLibraryId) {
    focusSelection = true
  }

  if (!nextLibraryId && previousLibraryId) {
    restoreFocusLibraryId = previousLibraryId
  }

  if (nextLibraryId !== previousLibraryId) {
    successfulAdmission.value = null
    clearProposalAdjustmentCommands()
    clearProposalOutcomeRecovery()
  }

  applyRouteFocus()
})

watch(selectedEntry, () => {
  applyRouteFocus()
})

watch(destinationProposalSelectionKey, nextSelectionKey => {
  clearDestinationProposal()
  clearProposalAdmission()
  clearProposalAdjustmentCommands()

  if (!nextSelectionKey || !selectedEntry.value) return

  loadDestinationProposal(selectedEntry.value.library)
}, { immediate: true })

watch(destinationProposalRevision, () => {
  clearProposalAdjustmentCommands()
})

onMounted(() => {
  focusSelection = selectedLibraryId.value !== null
  loadAuthoringEntries()
})
</script>
