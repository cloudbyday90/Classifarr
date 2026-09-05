/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function observationHistoryTime(value) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? `${new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'Unknown time'
}
export function observationHistoryRatio(count, total) {
  if (count === null || total === null) return 'Unknown'
  return `${count} / ${total} (${total ? `${Math.round(count * 1000 / total) / 10}%` : 'unknown'})`
}
