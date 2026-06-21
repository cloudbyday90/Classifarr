/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildWebSearchProviderMutationPayload } from '../routes/helpers/webSearchProviderSettingsSupport.mjs';

describe('webSearchProviderSettingsSupport', () => {
  test('normalizes provider-specific regional options to their documented bounded forms', () => {
    expect(buildWebSearchProviderMutationPayload({
      providerKey: 'brave',
      isEnabled: true,
      config: { country: 'ca', safeSearch: true },
    })).toEqual(expect.objectContaining({
      config: { country: 'CA', safeSearch: true },
    }));
    expect(buildWebSearchProviderMutationPayload({
      providerKey: 'serper',
      isEnabled: true,
      config: { gl: 'US', hl: 'en-US' },
    })).toEqual(expect.objectContaining({
      config: { gl: 'us', hl: 'en-us' },
    }));
  });

  test('drops invalid regional values instead of storing ineffective provider configuration', () => {
    expect(buildWebSearchProviderMutationPayload({
      providerKey: 'brave',
      config: { country: 'USA' },
    }).config).toEqual({});
    expect(buildWebSearchProviderMutationPayload({
      providerKey: 'serper',
      config: { gl: 'usa', hl: 'english' },
    }).config).toEqual({});
  });
});
