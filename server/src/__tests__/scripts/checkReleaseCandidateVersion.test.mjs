/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { resolve } from 'node:path';

import { checkReleaseCandidateVersion } from '../../../../scripts/check-release-candidate-version.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../../..');

describe('checkReleaseCandidateVersion', () => {
  test('accepts the prepared v0.48.3-beta package, lockfile, display, and public documentation surfaces', () => {
    expect(checkReleaseCandidateVersion({
      cwd: REPOSITORY_ROOT,
      tag: 'v0.48.3-beta',
    })).toEqual({
      expectedPackageVersion: '0.48.3-beta',
      issues: [],
      ok: true,
    });
  });
});
