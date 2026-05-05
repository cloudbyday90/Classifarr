/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { resolveRouteDependency } from '../routes/shared/resolveRouteDependency.mjs';

describe('resolveRouteDependency', () => {
  test('returns non-function dependencies unchanged', async () => {
    const dependency = { value: 42 };

    await expect(resolveRouteDependency(dependency)).resolves.toBe(dependency);
  });

  test('invokes function dependencies and returns their resolved value', async () => {
    const dependency = { value: 42 };
    const loader = async () => dependency;

    await expect(resolveRouteDependency(loader)).resolves.toBe(dependency);
  });
});
