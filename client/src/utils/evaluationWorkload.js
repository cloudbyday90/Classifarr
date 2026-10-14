/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const workloadModes = Object.freeze({ off: 'Off', when_idle: 'When idle', scheduled: 'Scheduled' })
const minute = value => Number.isInteger(value) && value >= 0 && value < 1440
export function readEvaluationWorkload(value) {
  if (!value || value.version !== 'evaluation_workload.v1' || value.scope !== 'installation' || value.timezone !== 'UTC' ||
    !Object.hasOwn(workloadModes, value.mode) || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
    !Number.isInteger(value.dailyRequests) || value.dailyRequests < 0 || value.dailyRequests > 200 ||
    (value.mode === 'off' ? value.dailyRequests !== 0 : value.dailyRequests === 0) ||
    (value.mode === 'scheduled' && (!minute(value.startMinute) || !minute(value.endMinute) || value.startMinute === value.endMinute)) ||
    !Number.isInteger(value.requestsReserved) || value.requestsReserved < 0 || value.requestsReserved > 200 ||
    !(value.quotaDay === null || /^\d{4}-\d{2}-\d{2}$/.test(value.quotaDay))) return null
  return Object.fromEntries(['revision', 'mode', 'dailyRequests', 'startMinute', 'endMinute', 'requestsReserved', 'quotaDay'].map(key => [key, value[key]]))
}
export function workloadTime(value) {
  return minute(value) ? `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` : ''
}
export function workloadMinute(value) {
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}
