<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="migration-report"
    aria-label="Migration diagnostics"
  >
    <button
      type="button"
      :aria-disabled="loading"
      @click="load"
    >
      {{ loading ? 'Reading diagnostics…' : 'View migration diagnostics' }}
    </button>
    <p
      role="status"
      aria-atomic="true"
    >
      {{ statusText }}
    </p>
    <template v-if="result?.status === 'available'">
      <p>This is the last saved migration failure, not proof of the cause of this library issue.</p>
      <p>Attempt {{ result.report.attemptId }} · {{ result.report.finishedAt }}</p>
      <p>{{ result.guidance }}</p>
      <a
        v-if="result.needsIssue === true"
        href="https://github.com/cloudbyday90/Classifarr/issues"
        target="_blank"
        rel="noopener noreferrer"
        referrerpolicy="no-referrer"
      >Open a GitHub issue (new tab)</a>
      <p>{{ result.report.limitations }}</p>
      <p v-if="result.report.omittedEvents">
        {{ result.report.omittedEvents }} earlier trace events were omitted by the size limit.
      </p>
      <details>
        <summary>View recorded steps and error chain</summary>
        <pre
          tabindex="0"
          aria-label="Sanitized migration diagnostic JSON"
        >{{ serialized }}</pre>
      </details>
      <a
        :href="downloadUrl"
        download="classifarr-migration-diagnostic.json"
      >Download sanitized report</a>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { getMigrationDiagnostics } from '@/api/migrationDiagnosticsApi'

const loading = ref(false)
const result = ref(null)
const downloadUrl = ref('')
const serialized = computed(() => result.value ? JSON.stringify(result.value, null, 2) : '')
const messages = {
  none: 'No failure report is saved. This does not prove that migrations succeeded; older versions and interrupted attempts may have no report.',
  unavailable: 'The report could not be read. Use the maintenance identity to run node src/scripts/readMigrationDiagnostics.mjs with the existing app-data mount.',
  target_mismatch: 'The saved report belongs to a different configured database target. It was not displayed.',
}
const statusText = computed(() => {
  if (!result.value) return ''
  if (result.value.status !== 'available') return messages[result.value.status] || messages.unavailable
  if (result.value.ledgerStatus === 'applied_since_failure') return 'Historical failure: this migration is now recorded as applied.'
  if (result.value.report.outcome === 'recovered') return 'The attempt recovered from an earlier failure and completed.'
  return result.value.ledgerStatus === 'not_recorded'
    ? 'The failed migration is not recorded as applied. Review the diagnostic report.'
    : 'A migration attempt failed. Its current database status is not established.'
})
let disposed = false
function revoke() {
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  downloadUrl.value = ''
}
async function load() {
  if (loading.value) return
  loading.value = true
  revoke()
  try {
    const response = await getMigrationDiagnostics()
    if (disposed) return
    result.value = response
    if (response.status === 'available') downloadUrl.value = URL.createObjectURL(new Blob([serialized.value], { type: 'application/json' }))
  } catch {
    if (!disposed) result.value = { status: 'unavailable' }
  } finally { loading.value = false }
}
onBeforeUnmount(() => { disposed = true; revoke() })
</script>

<style scoped>
.migration-report { margin-top: 1rem; overflow-wrap: anywhere; }
p { margin: 0.5rem 0; line-height: 1.5; }
button { border: 1px solid currentColor; border-radius: 0.375rem; padding: 0.5rem 0.75rem; }
button[aria-disabled="true"] { opacity: 0.6; cursor: wait; }
summary, a { display: block; padding: 0.5rem 0; cursor: pointer; }
a { text-decoration: underline; }
pre { max-height: 24rem; overflow: auto; white-space: pre-wrap; padding: 0.75rem; border: 1px solid currentColor; }
button:focus-visible, summary:focus-visible, a:focus-visible, pre:focus-visible { outline: 2px solid #60a5fa; outline-offset: 3px; }
</style>
