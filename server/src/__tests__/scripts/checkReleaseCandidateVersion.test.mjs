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

import { checkReleaseCandidateVersion, derivePackageVersionFromReleaseTag } from '../../../../scripts/check-release-candidate-version.mjs';
import { APP_DISPLAY_VERSION } from '../../../../client/src/constants/appVersion.js';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../../..');

describe('checkReleaseCandidateVersion', () => {
  test('keeps package, lockfile and public documentation aligned with the displayed version', () => {
    expect(checkReleaseCandidateVersion({
      cwd: REPOSITORY_ROOT,
      tag: APP_DISPLAY_VERSION,
    })).toEqual({
      expectedPackageVersion: derivePackageVersionFromReleaseTag(APP_DISPLAY_VERSION),
      issues: [],
      ok: true,
    });
  });
});
