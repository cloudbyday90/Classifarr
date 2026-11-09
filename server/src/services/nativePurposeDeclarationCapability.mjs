/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readNativePurposePositiveRule } from './nativePurposePositiveSemantics.mjs';
import { normalizePolicyNativeIntentChangePurposeCommand } from './policyNativeIntentChangePurposePreflightContract.mjs';

export const UNSUPPORTED_PURPOSE_DECLARATION = 'unsupported_purpose_declaration';
export const PURPOSE_DECLARATION_ERROR_CODE = 'POLICY_PURPOSE_DECLARATION_UNSUPPORTED';
export const PURPOSE_DECLARATION_ERROR_MESSAGE =
  'Edit purpose rules to use requires any, requires every, includes or prefers with a matching term list. Use avoid rules for exclusions.';

/** Fresh-write capability only. Call after exact receipt recovery, never in a historical parser. */
export function supportsNativePurposeDeclaration(rules) {
  return Array.isArray(rules) && rules.every(rule => readNativePurposePositiveRule(rule) !== null);
}

/** Use the writer's existing normalization/defaults, without changing fingerprint material. */
export function supportsNativePurposeCommands(commands) {
  return Array.isArray(commands) && commands.every(command => {
    if ((command.commandId ?? command.command_id) !== 'update_purpose') return true;
    try {
      const normalized = normalizePolicyNativeIntentChangePurposeCommand({
        command_id: 'update_purpose', values: command.values,
      });
      return supportsNativePurposeDeclaration(normalized.values.map(rule => ({ ...rule, intent_role: 'purpose' })));
    } catch {
      return false;
    }
  });
}
