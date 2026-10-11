<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section aria-label="Combined identity and scope check">
    <h5>Identity and scope checked together</h5>
    <p v-if="audit.status === 'catalog_and_scope_agreement'">
      Parent identifiers and complete source membership agree with this proposal in TMDb.
    </p>
    <p v-else>
      This check still needs review. Matching episodes alone do not settle competing parent IDs.
    </p>
    <ul>
      <li>Parent identifiers: {{ audit.parentBlockers.length ? 'unresolved evidence remains' : 'agree in TMDb' }}.</li>
      <li>Source membership: {{ audit.scopeComplete ? 'complete for this proposal' : 'incomplete; review the exclusions below' }}.</li>
      <li v-if="!audit.parentBlockers.length && !audit.proposalMatchesIdentity">
        The proposed scope is not the single work confirmed by the parent lookups. Preserve any intended grouping and review the mapping.
      </li>
      <li
        v-for="code in audit.parentBlockers"
        :key="code"
      >
        {{ identityAgreementBlockers[code] }}
      </li>
    </ul>
    <p>Both checks were repeated against the same source revision. This is not independent identity proof. No repair or backfill was authorized.</p>
  </section>
</template>
<script setup>
import { identityAgreementBlockers } from '@/utils/sourceIdentityAgreement'
defineProps({ audit: { type: Object, required: true } })
</script>

<style scoped>
section { margin: 1rem 0; padding: .75rem; border: 1px solid #64748b; border-radius: .35rem; overflow-wrap: anywhere; }
h5 { font-weight: 600; }
p, ul { margin-top: .75rem; }
ul { list-style: disc; padding-left: 1.25rem; }
li + li { margin-top: .5rem; }
</style>
