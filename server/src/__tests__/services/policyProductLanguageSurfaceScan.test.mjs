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

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  POLICY_PRODUCT_LANGUAGE_SURFACE_IDS,
  REQUIRED_SURFACE_IDS,
} from '../../../../scripts/lib/policyProductLanguageAudit.mjs';
import {
  buildPolicyProductLanguageRepositoryAudit,
  extractCurrentReleaseNotes,
  extractUnreleasedChangelog,
} from '../../../../scripts/lib/policyProductLanguageSurfaceScan.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

describe('policyProductLanguageSurfaceScan', () => {
  test('keeps historical changelog and release-note content outside the current audit scope', () => {
    const changelog = [
      '# Changelog',
      '',
      '## [Unreleased]',
      'Current product language.',
      '',
      '## [0.1.0]',
      'Phase 6R historical release detail.',
    ].join('\n');
    const releaseNotes = [
      '# Release notes',
      '',
      '## v0.2.0',
      'Current product language.',
      '',
      '## v0.1.0',
      'Phase 6R historical release detail.',
    ].join('\n');

    const unreleased = extractUnreleasedChangelog(changelog);
    const currentRelease = extractCurrentReleaseNotes(releaseNotes);

    expect(unreleased).toContain('Current product language.');
    expect(unreleased).not.toContain('Phase 6R');
    expect(currentRelease).toContain('Current product language.');
    expect(currentRelease).not.toContain('Phase 6R');
    expect(unreleased.split('\n').length).toBe(changelog.split('\n').length);
    expect(currentRelease.split('\n').length).toBe(releaseNotes.split('\n').length);
  });

  test('audits the current repository with every required surface and no findings', () => {
    const audit = buildPolicyProductLanguageRepositoryAudit({
      rootDir: repositoryRoot,
      generatedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(audit.complete).toBe(true);
    expect(audit.scanScope).toBe('operator_and_runtime_surfaces');
    expect(audit.requiredSurfaceIds).toEqual(REQUIRED_SURFACE_IDS);
    expect(audit.summary.bySurface).toEqual(expect.objectContaining({
      [POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RUNTIME_UI]: expect.objectContaining({
        fileCount: expect.any(Number),
      }),
      [POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.UNRELEASED_CHANGELOG]: expect.objectContaining({
        fileCount: 1,
      }),
    }));
    expect(audit.summary.matchCount).toBe(0);
    expect(audit.sideEffects).toEqual({
      filesRead: true,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
  });
});
