/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_PURPOSE_PROVENANCE_IDS,
  buildPolicyPurposeProvenance,
  isPolicyPurposeProvenance,
} from './policyDeclaredPurposeProvenance.mjs';

export const POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS = POLICY_PURPOSE_PROVENANCE_IDS;

/**
 * Reduces stored rule provenance to one fixed status for the administrator
 * purpose-maintenance read. It deliberately omits the per-rule source and
 * inference state so a profile remains descriptive evidence, never browser
 * authority or a configuration projection.
 */
export function buildPolicyNativeIntentPurposeChangeProvenance(purposeRules = []) {
  return buildPolicyPurposeProvenance(purposeRules);
}

export function isPolicyNativeIntentPurposeChangeProvenance(value = {}) {
  return isPolicyPurposeProvenance(value);
}
