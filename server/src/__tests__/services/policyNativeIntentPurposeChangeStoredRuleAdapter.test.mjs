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
  projectStoredPurposeRulesForNativeIntentChange,
} from '../../services/policyNativeIntentPurposeChangeStoredRuleAdapter.mjs';

describe('policyNativeIntentPurposeChangeStoredRuleAdapter', () => {
  test('projects editable rule fields while withholding stored provenance', () => {
    const projected = projectStoredPurposeRulesForNativeIntentChange([{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Documentary'] },
      constraint_mode: 'advisory',
      semantics: 'identity',
      source: 'media_server_library_profile',
      inference_state: 'inferred',
      sort_order: 9,
    }]);

    expect(projected).toEqual([{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Documentary'] },
      constraint_mode: 'advisory',
      semantics: 'identity',
    }]);
    expect(JSON.stringify(projected)).not.toContain('media_server_library_profile');
    expect(JSON.stringify(projected)).not.toContain('inferred');
  });

  test('fails closed to an empty command input for non-array storage results', () => {
    expect(projectStoredPurposeRulesForNativeIntentChange(null)).toEqual([]);
    expect(projectStoredPurposeRulesForNativeIntentChange({})).toEqual([]);
  });
});
