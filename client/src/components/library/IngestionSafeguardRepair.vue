<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    v-if="needed || opened"
    ref="sectionNode"
    class="border border-gray-600 rounded-lg p-4 space-y-3"
    aria-label="Repair import safeguards"
  >
    <h3 class="font-semibold">
      Repair import safeguards
    </h3>
    <p>This checks database protection—not who owns the library. An administrator can review a repair here.</p>
    <button
      ref="reviewButton"
      type="button"
      class="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2"
      :aria-disabled="busy"
      @click="review"
    >
      {{ busy ? 'Working…' : 'Check repair options' }}
    </button>
    <p
      role="status"
      aria-atomic="true"
    >
      {{ message }}
    </p>
    <template v-if="plan?.token">
      <p>
        Classifarr will back up this database, briefly pause writes to its import tables,
        and re-enable {{ plan.changes.length }} verified safeguards. This applies to all libraries in this database.
        Existing inventory and settings are kept. Other installations with separate databases are not affected.
      </p>
      <p>A private backup is kept in app-data under ingestion-repair-backups. Allow up to two minutes.</p>
      <details>
        <summary>Changes to review</summary>
        <ul class="list-disc pl-5">
          <li
            v-for="change in plan.changes"
            :key="`${change.table}/${change.trigger}`"
          >
            Enable {{ change.trigger }} on {{ change.table }} for all writes.
          </li>
        </ul>
      </details>
      <label class="flex items-start gap-2">
        <input
          v-model="confirmed"
          type="checkbox"
          :disabled="busy"
        >
        <span>I approve this database-wide repair and its brief pause to import writes.</span>
      </label>
      <button
        type="button"
        class="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2"
        :aria-disabled="busy || !confirmed"
        @click="repair"
      >
        Back up and repair
      </button>
    </template>
  </section>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import api from '@/api'
defineProps({ needed: Boolean })
const emit = defineEmits(['repaired'])
const plan = ref(null), confirmed = ref(false), busy = ref(false), opened = ref(false), message = ref('')
const sectionNode = ref(null), reviewButton = ref(null)
let alive = true
onBeforeUnmount(() => { alive = false })
const explanations = {
  not_needed: 'Database safeguards are healthy. No repair is needed.',
  confirmation_required: 'A repair is available. Review its scope before confirming.',
  migration_required: 'A database update is missing. Check the startup migration error before retrying the update; this repair cannot apply migrations.',
  protocol_required: 'Update and restart Classifarr using its normal startup command. This connection uses an older import protocol.',
  restore_required: 'Finish restore verification before repairing import safeguards.',
  definition_changed: 'A safeguard is missing or has changed. This needs a reviewed software fix; the automatic repair will not replace it.',
  maintenance_identity_required: 'This database account cannot repair schema objects. Use the repair command in your authorized database maintenance environment; do not grant the web service more permissions.',
  backup_tools_unavailable: 'The PostgreSQL backup tools are unavailable here. Use the current Classifarr image or the authorized maintenance environment.',
  busy: 'A repair is running or reviews are at capacity. Check again in a few minutes.',
}
const failures = {
  repair_backup_limit: 'Three repair backup attempts are already retained. Securely copy and review them under app-data/ingestion-repair-backups before removing a retained attempt to free a slot. No safeguards were changed.',
  repair_backup_disk_full: 'App-data storage is full. Free space without deleting library data, then review again. No safeguards were changed.',
  repair_backup_storage_unavailable: 'The private backup directory is not safely writable by Classifarr. Check app-data/ingestion-repair-backups ownership and owner-only permissions; do not make it world-writable. No safeguards were changed.',
  repair_backup_connection_unsupported: 'The backup utility cannot safely reproduce this database connection. Use the authorized maintenance environment; do not disable database transport security.',
  repair_backup_failed: 'The database backup could not be completed or fully read within its limits. No safeguards were changed. Inspect retained backup files; an incomplete file is not a usable backup.',
  repair_state_changed: 'Database status changed since the review. Check repair options again before confirming a new plan.',
  repair_review_expired: 'This review expired or was already used. Check repair options again.',
  repair_busy: 'Database maintenance is already active. Wait for it to finish, then check repair options.',
  repair_unavailable: 'Repair could not finish. No repair was committed. Check repair options again; a busy database or unavailable permissions may need attention.',
}
async function review() {
  if (busy.value) return
  opened.value = true; busy.value = true; plan.value = null; confirmed.value = false
  message.value = 'Checking repair options…'
  try {
    const result = await api.previewIngestionSafeguardRepair()
    if (!alive) return
    plan.value = result.reason === 'confirmation_required' && typeof result.token === 'string'
      && result.token.length > 0 && Array.isArray(result.changes) && result.changes.length > 0 ? result : null
    message.value = Object.hasOwn(explanations, result.reason) ? explanations[result.reason] : 'Repair is unavailable. No changes were made.'
  } catch {
    if (alive) message.value = 'Repair options could not be checked. Sign in as an administrator and check again.'
  } finally { if (alive) busy.value = false }
}
async function repair() {
  if (busy.value || !confirmed.value || !plan.value?.token) return
  const token = plan.value.token
  busy.value = true; message.value = 'Backing up and checking safeguards. Do not submit another repair.'
  try {
    const { data } = await api.repairIngestionSafeguards(token)
    if (!alive) return
    message.value = data.status === 'repaired'
      ? `Safeguards repaired. Backup ${data.backup.id} is retained. Normal import recovery can now continue.`
      : 'The result was not confirmed. Check repair options before doing anything else.'
    emit('repaired')
  } catch (error) {
    const code = error?.response?.data?.code
    if (alive) message.value = Object.hasOwn(failures, code) ? failures[code]
      : 'Repair was not confirmed. Check repair options for the current state; do not repeat the old request.'
  } finally {
    if (alive) {
      const focused = document.activeElement
      const returnFocus = sectionNode.value?.contains(focused) && focused !== reviewButton.value
      plan.value = null; confirmed.value = false; busy.value = false
      await nextTick()
      if (alive && returnFocus && (document.activeElement === focused || document.activeElement === document.body)) reviewButton.value?.focus({ preventScroll: true })
    }
  }
}
</script>
