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
  RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS,
  buildReleaseCandidateBadgeFragment,
  validateReleaseCandidateDocumentation,
} from '../../../../scripts/lib/releaseCandidateDocumentation.mjs';

const TAG = 'v0.48.2-beta';
const README = [
  `![Version](https://img.shields.io/badge/${buildReleaseCandidateBadgeFragment(TAG)})`,
  `**Source version:** \`${TAG}\`.`,
].join('\n');
const RELEASE_NOTES = `# Classifarr Release Notes\n\n## ${TAG}\n`;

function validate(overrides = {}) {
  return validateReleaseCandidateDocumentation({
    readme: README,
    releaseNotes: RELEASE_NOTES,
    tag: TAG,
    ...overrides,
  });
}

describe('releaseCandidateDocumentation', () => {
  test('derives the shields.io-safe tag fragment', () => {
    expect(buildReleaseCandidateBadgeFragment(TAG)).toBe('version-v0.48.2--beta-blue.svg');
  });

  test('accepts aligned public source-version surfaces', () => {
    expect(validate()).toEqual({ issues: [], ok: true });
  });

  test('rejects an outdated README badge or source-version marker', () => {
    const outdatedTag = 'v0.48.1-beta';
    const outdatedReadme = README
      .replace(buildReleaseCandidateBadgeFragment(TAG), buildReleaseCandidateBadgeFragment(outdatedTag))
      .replace(TAG, outdatedTag);

    expect(validate({ readme: outdatedReadme })).toEqual({
      issues: [
        RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS.README_BADGE_MISMATCH,
        RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS.README_SOURCE_VERSION_MISMATCH,
      ],
      ok: false,
    });
  });

  test('rejects release notes headed for a different public release', () => {
    expect(validate({ releaseNotes: RELEASE_NOTES.replace(TAG, 'v0.48.1-beta') })).toEqual({
      issues: [RELEASE_CANDIDATE_DOCUMENTATION_STATUS_IDS.RELEASE_NOTES_VERSION_MISMATCH],
      ok: false,
    });
  });
});
