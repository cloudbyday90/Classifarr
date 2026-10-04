/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function slugifyPresetName(name) {
  const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'preset';
}

export function buildCustomPresetKey(id, name) {
  return `custom_${id}_${slugifyPresetName(name)}`.slice(0, 50);
}
