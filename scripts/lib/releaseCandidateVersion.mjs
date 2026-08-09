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

export const RELEASE_CANDIDATE_VERSION_STATUS_IDS = Object.freeze({
  INVALID_TAG: 'invalid_tag',
  VERSION_MISMATCH: 'version_mismatch',
});

const RELEASE_TAG_PATTERN =
  /^v(?<base>\d+\.\d+\.\d+)(?<qualifier>[a-z][a-z0-9]*)?(?:-(?<prerelease>[a-z0-9]+(?:[.-][a-z0-9]+)*))?$/u;

export function derivePackageVersionFromReleaseTag(tag) {
  if (typeof tag !== 'string') {
    return null;
  }

  const match = tag.match(RELEASE_TAG_PATTERN);
  if (!match?.groups) {
    return null;
  }

  const { base, prerelease, qualifier } = match.groups;
  if (!qualifier && !prerelease) {
    return base;
  }
  if (!qualifier) {
    return `${base}-${prerelease}`;
  }
  return prerelease
    ? `${base}-${qualifier}.${prerelease}`
    : `${base}-${qualifier}`;
}

/**
 * Keeps public tags and semver-safe package versions intentionally distinct
 * while rejecting a release whose built application would report another
 * version. Callers pass only scalar version values; package content is not
 * preserved in the evidence chain.
 */
export function validateReleaseCandidateVersion({
  displayVersion,
  lockfileVersions = [],
  packageVersions = [],
  tag,
} = {}) {
  const expectedPackageVersion = derivePackageVersionFromReleaseTag(tag);
  if (!expectedPackageVersion) {
    return {
      expectedPackageVersion: null,
      issues: [RELEASE_CANDIDATE_VERSION_STATUS_IDS.INVALID_TAG],
      ok: false,
    };
  }

  const issues = [];
  if (displayVersion !== tag) {
    issues.push('display_version_mismatch');
  }
  if (!Array.isArray(packageVersions) || packageVersions.length !== 3 || packageVersions.some(version =>
    version !== expectedPackageVersion
  )) {
    issues.push('package_version_mismatch');
  }
  if (!Array.isArray(lockfileVersions) || lockfileVersions.length !== 6 || lockfileVersions.some(version =>
    version !== expectedPackageVersion
  )) {
    issues.push('lockfile_version_mismatch');
  }

  return {
    expectedPackageVersion,
    issues,
    ok: issues.length === 0,
  };
}
