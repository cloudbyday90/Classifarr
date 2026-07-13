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
  POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS,
  buildPolicyDeliveryTermRemovalCompletionAudit,
} from '../../../../scripts/lib/policyDeliveryTermRemovalCompletionAudit.mjs';

const COMPATIBILITY_READER = Object.freeze({
  id: 'draft_bridge',
  path: 'client/src/utils/policyIntentDraftBridge.js',
  ownerId: 'draft_bridge',
  removalConditionId: 'native_intent_storage_authoritative',
  deletionTestPath:
    'server/src/__tests__/services/policyBuilderLegacyCompatibilityBoundary.test.mjs',
});

function buildCompleteAudit(overrides = {}) {
  return buildPolicyDeliveryTermRemovalCompletionAudit({
    compatibilityBoundaryAudit: { ok: true, issues: [] },
    compatibilityModuleRecords: [COMPATIBILITY_READER],
    availableProductionPaths: [COMPATIBILITY_READER.path],
    availableTestPaths: [COMPATIBILITY_READER.deletionTestPath],
    generatedAt: '2026-07-13T22:00:00.000Z',
    ...overrides,
  });
}

describe('policyDeliveryTermRemovalCompletionAudit', () => {
  test('passes only with no production terms and complete compatibility-reader evidence', () => {
    const audit = buildCompleteAudit();

    expect(audit.complete).toBe(true);
    expect(audit.risks).toEqual([]);
    expect(audit.summary).toEqual(expect.objectContaining({
      compatibilityReaderCount: 1,
      riskCount: 0,
    }));
    expect(audit.sideEffects).toEqual({
      filesRead: false,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
  });

  test('blocks delivery terms, maintenance imports, and unbounded compatibility readers', () => {
    const audit = buildCompleteAudit({
      productionMatches: [{
        repoPath: 'server/src/services/phase9.mjs',
        lineNumber: 4,
        matcherId: 'phase_label',
        token: 'Phase 9R',
      }],
      maintenanceImports: [{
        repoPath: 'client/src/main.js',
        lineNumber: 2,
        parserPath: 'scripts/lib/policyDeliveryTermMatcher.mjs',
      }],
      compatibilityBoundaryAudit: { ok: false, issues: [{ riskId: 'missing_gate' }] },
      compatibilityModuleRecords: [{
        id: 'unbounded_reader',
        path: 'client/src/utils/missing.js',
      }],
    });

    expect(audit.complete).toBe(false);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS.PRODUCTION_DELIVERY_TERM_FOUND,
      }),
      expect.objectContaining({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .MAINTENANCE_PARSER_IMPORTED_BY_PRODUCTION,
      }),
      expect.objectContaining({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_BOUNDARY_INVALID,
      }),
      expect.objectContaining({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_READER_SOURCE_MISSING,
      }),
      expect.objectContaining({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_READER_OWNER_MISSING,
      }),
      expect.objectContaining({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_READER_REMOVAL_CONDITION_MISSING,
      }),
      expect.objectContaining({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_READER_DELETION_TEST_MISSING,
      }),
    ]));
  });
});
