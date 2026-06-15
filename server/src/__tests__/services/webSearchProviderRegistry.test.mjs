/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  enrichWebSearchProviderConfig,
  getWebSearchProviderAdapter,
  getWebSearchProviderMetadata,
} from '../../services/webSearchProviderRegistry.mjs';

describe('webSearchProviderRegistry', () => {
  test('resolves Tavily as the active adapter-backed provider', () => {
    expect(getWebSearchProviderMetadata('Tavily')).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      displayName: 'Tavily',
      adapterAvailable: true,
    }));
    expect(getWebSearchProviderAdapter('tavily')).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      contractVersion: 1,
    }));
  });

  test('marks staged providers as configurable but not adapter-backed', () => {
    expect(enrichWebSearchProviderConfig({
      providerKey: 'brave',
      displayName: 'Brave Search',
      configured: false,
    })).toEqual(expect.objectContaining({
      providerKey: 'brave',
      displayName: 'Brave Search',
      adapterAvailable: false,
      docsUrl: expect.stringContaining('brave'),
    }));
  });
});
