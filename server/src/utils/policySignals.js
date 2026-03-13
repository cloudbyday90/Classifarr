/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

function normalizeSignalConfig(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }
  return value;
}

function mergePresetSignals(baseSignals, customSignals) {
  const base = normalizeSignalConfig(baseSignals) || {};
  const custom = normalizeSignalConfig(customSignals) || null;

  const merged = JSON.parse(JSON.stringify(base));

  if (!custom) {
    return merged;
  }

  const removed = custom.removed || {};
  Object.entries(removed).forEach(([signalType, keyMap]) => {
    if (!merged[signalType]) return;
    Object.entries(keyMap || {}).forEach(([key, values]) => {
      if (!Array.isArray(merged[signalType][key])) return;
      merged[signalType][key] = merged[signalType][key].filter(item => !values.includes(item));
    });
  });

  Object.entries(custom).forEach(([signalType, config]) => {
    if (signalType === 'removed') return;
    if (!merged[signalType]) merged[signalType] = {};
    Object.entries(config || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const existing = Array.isArray(merged[signalType][key]) ? merged[signalType][key] : [];
        merged[signalType][key] = Array.from(new Set([...existing, ...value]));
      } else {
        merged[signalType][key] = value;
      }
    });
  });

  return merged;
}

module.exports = {
  normalizeSignalConfig,
  mergePresetSignals,
};
