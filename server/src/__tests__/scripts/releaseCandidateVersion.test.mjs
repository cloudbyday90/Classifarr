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

import {
  RELEASE_CANDIDATE_VERSION_STATUS_IDS,
  derivePackageVersionFromReleaseTag,
  validateReleaseCandidateVersion,
} from '../../../../scripts/lib/releaseCandidateVersion.mjs';

const TAG = 'v0.47.5c-beta';
const PACKAGE_VERSION = '0.47.5-c.beta';

function validate(overrides = {}) {
  return validateReleaseCandidateVersion({
    displayVersion: TAG,
    lockfileVersions: Array(6).fill(PACKAGE_VERSION),
    packageVersions: Array(3).fill(PACKAGE_VERSION),
    tag: TAG,
    ...overrides,
  });
}

describe('releaseCandidateVersion', () => {
  test.each([
    ['v1.2.3', '1.2.3'],
    ['v1.2.3-beta', '1.2.3-beta'],
    ['v1.2.3a-beta', '1.2.3-a.beta'],
    ['v0.47.5c-beta', '0.47.5-c.beta'],
  ])('maps %s to its semver-safe package version', (tag, expectedVersion) => {
    expect(derivePackageVersionFromReleaseTag(tag)).toBe(expectedVersion);
  });

  test('accepts aligned package, lockfile, and display versions', () => {
    expect(validate()).toEqual({
      expectedPackageVersion: PACKAGE_VERSION,
      issues: [],
      ok: true,
    });
  });

  test('rejects a tag that would publish a different public UI version', () => {
    expect(validate({ displayVersion: 'v0.47.5b-beta' })).toEqual({
      expectedPackageVersion: PACKAGE_VERSION,
      issues: ['display_version_mismatch'],
      ok: false,
    });
  });

  test('rejects incomplete package and lockfile coverage', () => {
    expect(validate({ lockfileVersions: [], packageVersions: [] })).toEqual({
      expectedPackageVersion: PACKAGE_VERSION,
      issues: ['package_version_mismatch', 'lockfile_version_mismatch'],
      ok: false,
    });
  });

  test('rejects invalid tags rather than guessing a package version', () => {
    expect(validate({ tag: 'release-0.47.5' })).toEqual({
      expectedPackageVersion: null,
      issues: [RELEASE_CANDIDATE_VERSION_STATUS_IDS.INVALID_TAG],
      ok: false,
    });
  });
});
