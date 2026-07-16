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
  UNKNOWN_RUNTIME_APP_VERSION,
  getNativeIntentReconciliationRuntimeProvenance,
  normalizeNativeIntentReconciliationRuntimeProvenance,
} from '../../services/nativeIntentReconciliationRuntimeProvenance.mjs';

describe('nativeIntentReconciliationRuntimeProvenance', () => {
  test('returns only a release-shaped version and immutable build revision', () => {
    const provenance = getNativeIntentReconciliationRuntimeProvenance({
      environment: {
        CLASSIFARR_APP_VERSION: '0.47.5-c.beta',
        CLASSIFARR_BUILD_REVISION: 'A0B1C2D3E4F5678901234567890ABCDEF1234567',
      },
      packageVersion: '0.1.0',
    });

    expect(provenance).toEqual({
      appVersion: '0.47.5-c.beta',
      buildRevision: 'a0b1c2d3e4f5678901234567890abcdef1234567',
      rawPayloadExposed: false,
    });
  });

  test('uses the package version when no release override is present', () => {
    const provenance = getNativeIntentReconciliationRuntimeProvenance({
      environment: {},
      packageVersion: '0.47.5-c.beta',
    });

    expect(provenance).toEqual({
      appVersion: '0.47.5-c.beta',
      buildRevision: null,
      rawPayloadExposed: false,
    });
  });

  test('rejects unbounded environment values rather than persisting diagnostics or secrets', () => {
    const provenance = normalizeNativeIntentReconciliationRuntimeProvenance({
      appVersion: '0.47.5-c.beta\nDATABASE_PASSWORD=must-not-escape',
      buildRevision: 'sha256:must-not-escape',
      imageTag: 'latest',
      containerId: 'must-not-escape',
    });

    expect(provenance).toEqual({
      appVersion: UNKNOWN_RUNTIME_APP_VERSION,
      buildRevision: null,
      rawPayloadExposed: false,
    });
    expect(JSON.stringify(provenance)).not.toContain('must-not-escape');
    expect(provenance).not.toHaveProperty('imageTag');
    expect(provenance).not.toHaveProperty('containerId');
  });
});
