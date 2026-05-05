/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createResolvedLoader, loadResolvedDependency } from '../services/shared/resolvedLoader.mjs';

describe('resolvedLoader', () => {
  test('createResolvedLoader returns a loader that resolves the provided dependency', async () => {
    const dependency = { value: 42 };
    const loader = createResolvedLoader(dependency);

    await expect(loader()).resolves.toBe(dependency);
  });

  test('loadResolvedDependency unwraps default exports from loader results', async () => {
    const dependency = { value: 42 };
    const loader = async () => ({ default: dependency });

    await expect(loadResolvedDependency(loader)).resolves.toBe(dependency);
  });

  test('loadResolvedDependency returns namespace-like objects unchanged when no default exists', async () => {
    const dependency = { parseDaysConfig: () => [1, 2, 3] };
    const loader = createResolvedLoader(dependency);

    await expect(loadResolvedDependency(loader)).resolves.toBe(dependency);
  });

  test('loadResolvedDependency requires a loader function', async () => {
    await expect(loadResolvedDependency(null)).rejects.toThrow(
      'loadResolvedDependency requires a loader function'
    );
  });
});
