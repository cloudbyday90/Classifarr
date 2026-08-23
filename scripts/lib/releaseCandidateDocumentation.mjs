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

export const RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS = Object.freeze({
  README_BADGE_MISMATCH: 'readme_badge_mismatch',
  README_SOURCE_VERSION_MISMATCH: 'readme_source_version_mismatch',
  RELEASE_NOTES_VERSION_MISMATCH: 'release_notes_version_mismatch',
});

export function buildReleaseCandidateBadgeFragment(tag) {
  if (typeof tag !== 'string' || tag.length === 0) {
    return null;
  }

  return `version-${tag.replaceAll('-', '--')}-blue.svg`;
}

function findFirstReleaseNotesHeading(releaseNotes) {
  if (typeof releaseNotes !== 'string') {
    return null;
  }

  const match = releaseNotes.match(/^## (v[^\r\n]+)$/mu);
  return match?.[1] || null;
}

/**
 * Keeps the public source-version surfaces aligned with the tag that CI will
 * later publish. The checks deliberately inspect only fixed documentation
 * markers; they do not collect or retain release-note body content.
 */
export function validateReleaseCandidateDocumentation({
  readme,
  releaseNotes,
  tag,
} = {}) {
  const issues = [];
  const expectedBadgeFragment = buildReleaseCandidateBadgeFragment(tag);
  const expectedSourceVersionMarker = `**Source version:** \`${tag}\`.`;

  if (!expectedBadgeFragment || typeof readme !== 'string' || !readme.includes(expectedBadgeFragment)) {
    issues.push(RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS.README_BADGE_MISMATCH);
  }
  if (typeof readme !== 'string' || !readme.includes(expectedSourceVersionMarker)) {
    issues.push(RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS.README_SOURCE_VERSION_MISMATCH);
  }
  if (findFirstReleaseNotesHeading(releaseNotes) !== tag) {
    issues.push(RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS.RELEASE_NOTES_VERSION_MISMATCH);
  }

  return {
    issues,
    ok: issues.length === 0,
  };
}
