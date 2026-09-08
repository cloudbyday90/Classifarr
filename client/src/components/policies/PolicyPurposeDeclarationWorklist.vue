<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="worklist"
    id="policy-purpose-declaration-worklist"
    class="border-b border-gray-700 bg-background/50 p-5"
    aria-labelledby="policy-purpose-declaration-worklist-heading"
  >
    <h3
      id="policy-purpose-declaration-worklist-heading"
      class="text-base font-semibold text-white"
    >
      Purpose declaration review
    </h3>
    <p class="mt-1 max-w-3xl text-sm leading-6 text-gray-300">
      This server-generated worklist groups policies with the same current stored-purpose draft. It exposes no purpose terms and cannot change a policy, select a study case, or route media. Review opens the existing revision-checked declaration form for one policy.
    </p>

    <p
      v-if="worklist.statusId === 'no_declaration_review_required'"
      class="mt-3 text-sm text-green-200"
      role="status"
    >
      No active policy in the full report needs a purpose declaration review.
    </p>

    <template v-else>
      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">Policies requiring declaration</dt>
          <dd class="mt-1 text-lg font-semibold text-amber-200">{{ worklist.summary.declarationRequiredPolicyCount }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">Shared stored-purpose groups</dt>
          <dd class="mt-1 text-lg font-semibold text-white">{{ worklist.summary.groupCount }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-gray-400">Policies reviewed</dt>
          <dd class="mt-1 text-lg font-semibold text-white">{{ worklist.summary.reviewedPolicyCount }}</dd>
        </div>
      </dl>

      <p
        v-if="worklist.summary.truncated"
        class="mt-4 rounded border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100"
        role="status"
        aria-live="polite"
      >
        {{ truncatedReportDescription }}
      </p>

      <div
        v-if="worklist.groups.length > 0"
        class="mt-4 overflow-x-auto rounded border border-gray-700"
      >
        <table class="min-w-full text-left text-sm">
          <caption class="sr-only">Active policy purpose declaration review worklist</caption>
          <thead class="bg-background text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th scope="col" class="px-4 py-3">Policy</th>
              <th scope="col" class="px-4 py-3">Library</th>
              <th scope="col" class="px-4 py-3">Stored-purpose provenance</th>
              <th scope="col" class="px-4 py-3"><span class="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody
            v-for="group in worklist.groups"
            :key="group.id"
            class="divide-y divide-gray-800"
          >
            <tr class="bg-gray-900/40">
              <th scope="rowgroup" colspan="4" class="px-4 py-3 text-sm font-medium text-gray-200">
                Shared stored-purpose group {{ groupLabel(group) }} · {{ group.policyCount }} {{ pluralize(group.policyCount, 'policy') }} · {{ group.libraryCount }} {{ pluralize(group.libraryCount, 'library') }}
              </th>
            </tr>
            <tr v-for="entry in group.entries" :key="entry.policy.id">
              <td class="px-4 py-3 font-medium text-white">{{ entry.policy.name }}</td>
              <td class="px-4 py-3 text-gray-300">
                {{ entry.library.name }}<span v-if="entry.library.mediaType"> · {{ entry.library.mediaType }}</span>
              </td>
              <td class="px-4 py-3 text-amber-100">{{ provenancePresentation(entry.purposeProvenance)?.title || 'Purpose provenance requires review' }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light"
                  @click="emit('review-purpose', entry)"
                >
                  Review and declare purpose
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  getNativeIntentPurposeProvenancePresentation,
} from '@/utils/policyNativeIntentPurposeProvenance'
import {
  normalizePolicyPurposeDeclarationWorklist,
} from '@/utils/policyPurposeDeclarationWorklist'

const props = defineProps({
  worklist: { type: Object, default: null },
})

const emit = defineEmits({
  'review-purpose': entry => Boolean(entry?.policy?.id),
})

const worklist = computed(() => normalizePolicyPurposeDeclarationWorklist(props.worklist))
const truncatedReportDescription = computed(() => {
  if (!worklist.value?.summary.truncated) return ''

  return worklist.value.summary.declarationRequiredPolicyCount > 0
    ? 'This bounded worklist omits active policies. The displayed declaration requests and shared groups apply only to the current report window; it does not change omitted policies.'
    : 'This bounded worklist found no declaration request in the current report window. It cannot determine whether omitted active policies need review and does not change them.'
})

function groupLabel(group) {
  const number = Number(String(group?.id || '').split('_').at(-1))
  return Number.isInteger(number) && number > 0 ? number : '—'
}

function pluralize(count, singular) {
  return count === 1 ? singular : `${singular}s`
}

function provenancePresentation(value) {
  return getNativeIntentPurposeProvenancePresentation(value)
}
</script>
