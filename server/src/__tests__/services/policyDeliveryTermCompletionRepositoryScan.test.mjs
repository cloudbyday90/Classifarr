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
  buildPolicyDeliveryTermRemovalRepositoryAudit,
  findMaintenanceParserImports,
  findProductionDeliveryTermMatches,
  resolveLocalImportPath,
} from '../../../../scripts/lib/policyDeliveryTermCompletionRepositoryScan.mjs';

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

describe('policyDeliveryTermCompletionRepositoryScan', () => {
  test('finds only delivery terms in production source content', () => {
    expect(findProductionDeliveryTermMatches([{
      path: 'server/src/services/example.mjs',
      content: 'const lifecycleStage = "routing";\nconst label = "Phase 9R";',
    }])).toEqual([
      expect.objectContaining({
        repoPath: 'server/src/services/example.mjs',
        lineNumber: 2,
        token: 'Phase 9R',
      }),
    ]);
  });

  test('resolves local imports and rejects maintenance parser imports from production files', () => {
    expect(resolveLocalImportPath(
      'server/src/services/example.mjs',
      '../../../scripts/lib/policyDeliveryTermMatcher.mjs',
    )).toBe('scripts/lib/policyDeliveryTermMatcher.mjs');

    expect(findMaintenanceParserImports([{
      path: 'server/src/services/example.mjs',
      content: [
        'import { findDeliveryTermMatches }',
        "  from '../../../scripts/lib/policyDeliveryTermMatcher.mjs';",
      ].join('\n'),
    }])).toEqual([
      {
        repoPath: 'server/src/services/example.mjs',
        lineNumber: 1,
        parserPath: 'scripts/lib/policyDeliveryTermMatcher.mjs',
      },
    ]);
  });

  test('passes the current repository boundaries', () => {
    const audit = buildPolicyDeliveryTermRemovalRepositoryAudit({
      rootDir: REPOSITORY_ROOT,
      generatedAt: '2026-07-13T22:00:00.000Z',
    });

    expect(audit.complete).toBe(true);
    expect(audit.risks).toEqual([]);
    expect(audit.summary).toEqual(expect.objectContaining({
      productionMatchCount: 0,
      maintenanceImportCount: 0,
      compatibilityReaderCount: 7,
    }));
  });
});
