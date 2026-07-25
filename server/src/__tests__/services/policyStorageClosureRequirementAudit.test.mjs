/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS,
  buildPolicyStorageClosureRequirementAudit,
  validatePolicyStorageClosureRequirementAudit,
} from '../../services/policyStorageClosureRequirementAudit.mjs';
import {
  MANIFEST_PATHS,
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageCurrentClosureAuditFixture,
} from './policyStorageCurrentClosureAuditFixture.mjs';

function completeRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map(component => `### ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function historicRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `### 8R.${index + 1} ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **8R.${index + 1} ${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent({
  includeOutcome = true,
} = {}) {
  return `
## [Unreleased]

### Added

${includeOutcome ? '- **Native Policy Intent Storage** — added durable policy storage.' : ''}
`;
}

function readTextFileFactory({
  changelogContent = completeChangelogContent(),
  roadmapContent = completeRoadmapContent(),
} = {}) {
  return filePath => (
    filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
      ? changelogContent
      : roadmapContent
  );
}

async function completeAudit(overrides = {}) {
  const {
    currentClosureAudit: suppliedCurrentClosureAudit,
    fileExists = () => true,
    readTextFile = readTextFileFactory(),
    ...remainingOverrides
  } = overrides;
  const currentClosureAudit = suppliedCurrentClosureAudit ||
    await buildPolicyStorageCurrentClosureAuditFixture({
      fileExists,
      readTextFile,
    });

  return buildPolicyStorageClosureRequirementAudit({
    cwd: '/repo',
    currentClosureAudit,
    generatedAt: '2026-06-25T18:00:00.000Z',
    fileExists,
    readTextFile,
    ...remainingOverrides,
  });
}

describe('policyStorageClosureRequirementAudit', () => {
  test('completes when current closure and all catalog component evidence pass', async () => {
    const audit = await completeAudit();

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.complete).toBe(true);
    expect(audit.validation.ok).toBe(true);
    expect(audit.evidenceScope).toEqual(expect.objectContaining({
      componentCount: POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP.length,
      componentCatalog: 'policy_storage_closure',
    }));
    expect(audit.summary).toEqual(expect.objectContaining({
      expectedComponentCount: POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP.length,
      implementedComponentCount: POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP.length,
      missingComponentArtifactCount: 0,
      missingRoadmapSequenceCount: 0,
      missingRoadmapImplementationStatusCount: 0,
      missingChangelogCount: 0,
    }));
  });

  test('blocks when the policy storage current closure audit is incomplete', async () => {
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture({
      completionAuditArtifact: await buildCompletionAuditArtifactFixture({
        appliedPaths: [MANIFEST_PATHS[0]],
      }),
    });
    const audit = await completeAudit({
      currentClosureAudit,
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_CLOSURE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .CURRENT_CLOSURE_AUDIT_NOT_COMPLETE,
      }),
    ]));
  });

  test('blocks an altered current closure audit artifact before evaluating closure status', async () => {
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture();
    currentClosureAudit.summary.missingCurrentArtifactCount = 1;
    const audit = await completeAudit({ currentClosureAudit });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_CLOSURE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .CURRENT_CLOSURE_AUDIT_ARTIFACT_INTEGRITY_FAILED,
      }),
    ]));
    expect(audit.risks.map(risk => risk.riskId)).not.toContain(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_NOT_COMPLETE
    );
  });

  test('blocks when the selected checkout content differs from retained current evidence', async () => {
    const changedPath = 'policyStorageCompletionCheckpoint.mjs';
    const baselineReadTextFile = readTextFileFactory();
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture({
      readTextFile: baselineReadTextFile,
    });
    const audit = await completeAudit({
      currentClosureAudit,
      readTextFile: filePath => (
        filePath.replace(/\\/g, '/').endsWith(changedPath)
          ? 'changed checkout content'
          : baselineReadTextFile(filePath)
      ),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_CLOSURE);
    expect(audit.summary.currentCheckoutFingerprintMatchesAudit).toBe(false);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .CURRENT_CLOSURE_AUDIT_CHECKOUT_FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('blocks when a later closure component artifact is missing', async () => {
    const missingPath =
      'server/src/services/policyStorageCurrentClosureAudit.mjs';
    const audit = await completeAudit({
      fileExists: absolutePath => (
        !absolutePath.replace(/\\/g, '/').endsWith(missingPath)
      ),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_COMPONENT_EVIDENCE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .COMPONENT_ARTIFACT_MISSING,
        componentId: 'storage_current_closure_audit',
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .COMPONENT_CONTRACT_EVIDENCE_MISSING,
        componentId: 'storage_current_closure_audit',
      }),
    ]));
  });

  test('blocks when the roadmap omits a late storage-closure work-sequence item', async () => {
    const roadmapContent = completeRoadmapContent()
      .replace(/\d+\. \*\*Policy Storage Current Closure Audit\*\*/, '');
    const audit = await completeAudit({
      readTextFile: readTextFileFactory({ roadmapContent }),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_ROADMAP_EVIDENCE);
    expect(audit.roadmapEvidence.missingSequenceComponentIds)
      .toContain('storage_current_closure_audit');
  });

  test('blocks when the durable storage outcome is absent from Unreleased', async () => {
    const audit = await completeAudit({
      readTextFile: readTextFileFactory({
        changelogContent: completeChangelogContent({
          includeOutcome: false,
        }),
      }),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_CURRENT_CLOSURE);
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .CURRENT_CLOSURE_AUDIT_NOT_COMPLETE,
      }),
    ]));
  });

  test('blocks on side effects other than repository file reads', async () => {
    const audit = await completeAudit({
      sideEffects: {
        filesWritten: true,
        storageChanged: true,
        gitCommandsRun: true,
        commandsExecuted: true,
        manifestWritten: true,
      },
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECTS);
    expect(audit.validation.ok).toBe(false);
    expect(audit.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'filesWritten',
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .SIDE_EFFECT_REPORTED,
        sideEffect: 'manifestWritten',
      }),
    ]));
  });

  test('validates status and risk-count invariants', () => {
    const validation =
      validatePolicyStorageClosureRequirementAudit({
        statusId: 'unexpected',
        complete: false,
        riskCount: 1,
        risks: [],
        sideEffects: {
          filesRead: true,
        },
      });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      }),
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
            .RISK_COUNT_MISMATCH,
      }),
    ]));
  });

  test('accepts phase-coded roadmap entries for durable closure component names', async () => {
    const audit = await completeAudit({
      readTextFile: readTextFileFactory({
        roadmapContent: historicRoadmapContent(),
      }),
    });

    expect(audit.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE);
    expect(audit.roadmapEvidence.missingSequenceComponentIds).toEqual([]);
    expect(audit.roadmapEvidence.missingImplementationStatusComponentIds).toEqual([]);
  });
});
