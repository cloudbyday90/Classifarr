/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const EDITABLE_PURPOSE_RULE_FIELDS = Object.freeze([
  'signal_type',
  'operator',
  'values',
  'constraint_mode',
  'semantics',
]);

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * Removes stored-evidence provenance before an active rule is canonicalized as
 * an explicit change command. The change endpoint owns the provenance written
 * after an administrator approves the command; a browser must never replay
 * profile provenance as a write instruction.
 */
export function projectStoredPurposeRulesForNativeIntentChange(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(asRecord)
    .filter(Boolean)
    .map(rule => EDITABLE_PURPOSE_RULE_FIELDS.reduce((projected, field) => {
      if (Object.hasOwn(rule, field)) projected[field] = rule[field];
      return projected;
    }, {}));
}
