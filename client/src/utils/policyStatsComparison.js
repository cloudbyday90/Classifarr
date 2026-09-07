/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const UNAVAILABLE = 'N/A'
const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

function finiteNumber(value) {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!DECIMAL.test(text)) return null
    value = Number(text)
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function ratePercent(value, scale) {
  const number = finiteNumber(value)
  return number !== null && number >= 0 && number <= 100 / scale ? number * scale : null
}

function count(value) {
  const number = finiteNumber(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

function percentText(value) {
  return value === null ? UNAVAILABLE : `${value.toFixed(1)}%`
}

export function formatFractionPercent(value) {
  return percentText(ratePercent(value, 100))
}

function differenceText(current, previous, isRate) {
  if (current === null || previous === null) return UNAVAILABLE
  const difference = current - previous
  const magnitude = isRate ? Math.abs(difference).toFixed(1) : String(Math.abs(difference))
  const sign = Number(magnitude) === 0 ? '' : difference > 0 ? '+' : '-'
  const unit = isRate ? ` percentage point${Number(magnitude) === 1 ? '' : 's'}` : ''
  return `${sign}${magnitude}${unit}`
}

function countRow(current, previous) {
  const currentValue = count(current)
  const previousValue = count(previous)
  return { id: 'decisions', label: 'Decisions',
    current: currentValue === null ? UNAVAILABLE : String(currentValue),
    previous: previousValue === null ? UNAVAILABLE : String(previousValue),
    change: differenceText(currentValue, previousValue, false) }
}

function rateRow(id, label, current, previous, scale) {
  const currentValue = ratePercent(current, scale)
  const previousValue = ratePercent(previous, scale)
  return { id, label, current: percentText(currentValue), previous: percentText(previousValue),
    change: differenceText(currentValue, previousValue, true) }
}

export function buildPolicyComparisonRows(periods) {
  const source = Array.isArray(periods) ? periods : []
  const current = source.find(period => period?.period === 'last_7_days') ?? {}
  const previous = source.find(period => period?.period === 'previous_7_days') ?? {}
  return [
    countRow(current.decisions, previous.decisions),
    rateRow('accuracy', 'Accuracy', current.accuracy, previous.accuracy, 100),
    rateRow('auto_rate', 'Auto Rate', current.auto_rate, previous.auto_rate, 1),
  ]
}
