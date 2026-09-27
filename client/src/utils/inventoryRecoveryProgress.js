/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const RECOVERY_STAGES = [
  { id: 'waiting', label: 'Waiting', color: '#fbbf24' },
  { id: 'ready', label: 'Ready', color: '#93c5fd' },
  { id: 'queued', label: 'Queued', color: '#c4b5fd' },
  { id: 'checking', label: 'Checking', color: '#67e8f9' },
  { id: 'blocked', label: 'Source blocked', color: '#fda4af' },
  { id: 'recovered', label: 'Recovered', color: '#6ee7b7' },
  { id: 'unknown', label: 'Unmeasured', color: '#d1d5db' },
]
const READINESS = {
  disabled: 'Learning is disabled. Metadata recovery is independent.',
  waiting_for_libraries: 'Connect a media server and select movie or TV libraries.',
  waiting_for_inventory: 'Waiting for library ingestion. Learning starts when items are available.',
  ingesting: 'Library ingestion is active. Learning will resume after ingestion and queued work finish.',
  backfilling: 'Foreground work is queued or running. Learning waits; recovery continues.',
  ready: 'Learning prerequisites are available. Each job still checks its own evidence and configuration.',
  unavailable: 'Readiness could not be established. Learning waits for the next check.',
}
export const recoveryReadinessLabel = value => READINESS[value]
export function parseInventoryRecoveryProgress(value) {
  const count = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000
  if (value?.version !== 1 || value.limit !== 1000 || value.windowDays !== 30 ||
    !Object.hasOwn(READINESS, value.readiness) || typeof value.truncated !== 'boolean' ||
    !Number.isFinite(Date.parse(value.asOf)) || !count(value.total) ||
    !RECOVERY_STAGES.every(({ id }) => count(value.stages?.[id])) ||
    RECOVERY_STAGES.reduce((sum, { id }) => sum + value.stages[id], 0) !== value.total ||
    !Number.isSafeInteger(value.oldestReadySeconds) || value.oldestReadySeconds < 0) throw new TypeError('Invalid recovery progress')
  for (const timing of [value.eligibleToQueue, value.queueToRecovery]) {
    if (!timing || !count(timing.samples) || timing.samples > value.total ||
      (timing.samples === 0 ? timing.seconds !== null : !Number.isSafeInteger(timing.seconds) || timing.seconds < 0)) throw new TypeError('Invalid recovery timing')
  }
  return value
}
export function recoveryDuration(seconds) {
  if (seconds === null) return 'Not measured'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h`
}
export function recoveryNextStep(report) {
  if (['waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling', 'unavailable'].includes(report.readiness)) return READINESS[report.readiness]
  if (!report.total) return 'No credential-released cases measured yet. Existing retries continue; do not reset them to populate this chart.'
  if (report.stages.blocked) return 'Review source conflicts in the case list. Correct the source match before automatic recovery can continue.'
  if (report.stages.unknown) return 'Some milestones could not be verified. Check the case details; no success is assumed.'
  if (report.stages.ready) return `The oldest ready case has waited ${recoveryDuration(report.oldestReadySeconds)}. Check queue activity if that wait keeps growing.`
  if (report.stages.queued || report.stages.checking) return 'Recovery is working through admitted items. No manual retry is needed.'
  if (report.stages.waiting) return 'Scheduled cooldowns are still active. Let automatic recovery retry when due.'
  return 'All cases in this measured cohort recovered. No action is needed.'
}
