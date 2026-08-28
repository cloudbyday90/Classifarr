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
  POLICY_PRODUCT_LANGUAGE_RISK_IDS,
  POLICY_PRODUCT_LANGUAGE_SURFACE_IDS,
  REQUIRED_SURFACE_IDS,
  buildPolicyProductLanguageAudit,
} from '../../../../scripts/lib/policyProductLanguageAudit.mjs';

function buildRequiredSurfaces({ content = 'durable product language' } = {}) {
  return REQUIRED_SURFACE_IDS.map(surfaceId => ({
    surfaceId,
    files: [
      {
        path: `${surfaceId}.md`,
        content,
      },
    ],
  }));
}

describe('policyProductLanguageAudit', () => {
  test('passes normal product language without exposing scanned source content', () => {
    const audit = buildPolicyProductLanguageAudit({
      surfaces: buildRequiredSurfaces({
        content: 'Use the DeepSeek-R1 model with a R18+ rating constraint.',
      }),
      generatedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(audit.complete).toBe(true);
    expect(audit.findings).toEqual([]);
    expect(audit.risks).toEqual([]);
    expect(audit.summary).toEqual(expect.objectContaining({
      surfaceCount: REQUIRED_SURFACE_IDS.length,
      matchCount: 0,
    }));
    expect(audit.sideEffects).toEqual({
      filesRead: false,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
  });

  test('blocks explicit roadmap language and reports only safe location metadata', () => {
    const surfaces = buildRequiredSurfaces();
    const runtimeServer = surfaces.find(surface =>
      surface.surfaceId === POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RUNTIME_SERVER
    );

    runtimeServer.files[0] = {
      path: 'server/src/services/example.mjs',
      content: 'const label = "Phase 9R migration";\nconst other = "phase8r";',
    };

    const audit = buildPolicyProductLanguageAudit({ surfaces });

    expect(audit.complete).toBe(false);
    expect(audit.findings).toEqual([
      {
        surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RUNTIME_SERVER,
        repoPath: 'server/src/services/example.mjs',
        lineNumber: 1,
        matcherId: 'phase_label',
        token: 'Phase 9R',
      },
      {
        surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RUNTIME_SERVER,
        repoPath: 'server/src/services/example.mjs',
        lineNumber: 2,
        matcherId: 'phase_label',
        token: 'phase8r',
      },
    ]);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PRODUCT_LANGUAGE_RISK_IDS.TEMPORARY_DELIVERY_LANGUAGE,
        token: 'Phase 9R',
      }),
    ]));
    expect(JSON.stringify(audit)).not.toContain('const label');
  });

  test('fails closed when a required surface is missing or contains no usable content', () => {
    const surfaces = buildRequiredSurfaces({ content: '' })
      .filter(surface =>
        surface.surfaceId !== POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.API_DOCUMENTATION
      );

    const audit = buildPolicyProductLanguageAudit({ surfaces });

    expect(audit.complete).toBe(false);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PRODUCT_LANGUAGE_RISK_IDS.MISSING_REQUIRED_SURFACE,
        surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.API_DOCUMENTATION,
      }),
      expect.objectContaining({
        riskId: POLICY_PRODUCT_LANGUAGE_RISK_IDS.EMPTY_REQUIRED_SURFACE,
        surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RUNTIME_UI,
      }),
    ]));
  });

  test('allows the fresh empty Unreleased section required immediately after a release', () => {
    const surfaces = buildRequiredSurfaces();
    const unreleased = surfaces.find(surface =>
      surface.surfaceId === POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.UNRELEASED_CHANGELOG
    );

    unreleased.files[0].content = '';

    expect(buildPolicyProductLanguageAudit({ surfaces })).toEqual(expect.objectContaining({
      complete: true,
      risks: [],
    }));
  });
});
