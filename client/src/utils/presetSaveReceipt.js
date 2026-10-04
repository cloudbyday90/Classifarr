/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function presetSaveReceipt(value) {
  if (!value || typeof value.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.requestId)
    || !['pending', 'saved', 'cancelled'].includes(value.state) || typeof value.resolved !== 'boolean'
    || !(value.presetId === null || (Number.isSafeInteger(value.presetId) && value.presetId > 0))) {
    throw new Error('Invalid save receipt')
  }
  return value
}
