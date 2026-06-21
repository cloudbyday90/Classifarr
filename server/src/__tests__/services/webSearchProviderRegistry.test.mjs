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

  test('resolves Brave and Serper as active adapter-backed providers', () => {
    expect(enrichWebSearchProviderConfig({
      providerKey: 'brave',
      displayName: 'Brave Search',
      configured: false,
    })).toEqual(expect.objectContaining({
      providerKey: 'brave',
      displayName: 'Brave Search',
      adapterAvailable: true,
      docsUrl: expect.stringContaining('brave'),
    }));
    expect(getWebSearchProviderAdapter('serper')).toEqual(expect.objectContaining({
      providerKey: 'serper',
      contractVersion: 1,
    }));
  });
});
