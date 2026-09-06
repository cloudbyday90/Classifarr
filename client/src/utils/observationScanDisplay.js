/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const reasons = Object.freeze({
  inventory_changed: 'The scan restarted because inventory or observed metadata changed.',
  observation_clocks_changed: 'The scan restarted because observation timestamps changed.',
  sampling_gap: 'The scan restarted after sampling was interrupted.',
  configuration_changed: 'The scan restarted because acquisition configuration changed.',
  expired: 'The scan restarted after reaching its seven-day age limit.',
  clock_anomaly: 'The scan restarted because its clock was ahead of the current time.',
  changed_before_write: 'The page was discarded because its inputs changed before saving.',
})
export function observationScanRestart(reason) {
  return reasons[reason] || 'The scan restarted; earlier partial counts were discarded.'
}
