/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ValidationError } from '../utils/appError.mjs';

function canonical(value, depth = 0) {
  if (depth > 32) throw new ValidationError('Preset settings are too deeply nested');
  if (Array.isArray(value)) return `[${value.map(item => canonical(item, depth + 1)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key], depth + 1)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function normalizePresetSavePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Invalid preset');
  const { name, description = null, icon = '⚙️', category = 'custom', signals = {} } = body;
  if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new ValidationError('Preset name must contain 1 to 100 characters');
  if (description !== null && (typeof description !== 'string' || description.length > 10_000)) throw new ValidationError('Invalid preset description');
  if (typeof icon !== 'string' || icon.length > 50 || typeof category !== 'string' || category.length > 50) throw new ValidationError('Invalid preset icon or category');
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)) throw new ValidationError('Signals must be a valid object');
  const payload = { name: name.trim(), description, icon, category, signals };
  const serialized = canonical(payload);
  if (Buffer.byteLength(serialized) > 65_536) throw new ValidationError('Preset settings are too large');
  return { payload, fingerprint: createHash('sha256').update(serialized).digest('hex') };
}
