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
  POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS,
  buildPolicyStorageClosureInstanceEvidenceAssembly,
} from '../../services/policyStorageClosureInstanceEvidenceAssembly.mjs';
import {
  POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} from '../../services/policyStorageClosureRequirementAudit.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

function completeRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map(component => `### ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function readFixtureText(filePath) {
  return filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
    ? '## [Unreleased]\n\n### Added\n\n- **Native Policy Intent Storage** - added durable policy storage.\n'
    : completeRoadmapContent();
}

describe('policyStorageClosureInstanceEvidenceAssembly', () => {
  test('assembles a complete current-closure and requirement-audit chain from existing evidence', async () => {
    const result = await buildPolicyStorageClosureInstanceEvidenceAssembly({
      cwd: '/selected-checkout',
      completionAuditArtifact: await buildCompletionAuditArtifactFixture(),
      validationEvidence: buildPolicyStorageClosureValidationEvidenceFixture(),
      generatedAt: '2026-07-25T00:00:00.000Z',
      fileExists: () => true,
      readTextFile: readFixtureText,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId:
        POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS.COMPLETE,
      complete: true,
      summary: {
        currentClosureAuditComplete: true,
        currentClosureAuditValidationOk: true,
        requirementAuditComplete: true,
        requirementAuditValidationOk: true,
      },
    }));
    expect(result.requirementAudit.currentClosureAudit.artifactFingerprint)
      .toBe(result.currentClosureAudit.artifactFingerprint.fingerprint);
    expect(result.sideEffects).toEqual({
      filesRead: true,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
      manifestWritten: false,
    });
  });

  test('does not turn reported side effects into complete closure evidence', async () => {
    const result = await buildPolicyStorageClosureInstanceEvidenceAssembly({
      cwd: '/selected-checkout',
      completionAuditArtifact: await buildCompletionAuditArtifactFixture(),
      validationEvidence: buildPolicyStorageClosureValidationEvidenceFixture(),
      sideEffects: { storageChanged: true },
      fileExists: () => true,
      readTextFile: readFixtureText,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId:
        POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS
          .BLOCKED_BY_SIDE_EFFECTS,
      complete: false,
      sideEffects: expect.objectContaining({ storageChanged: true }),
    }));
  });
});
