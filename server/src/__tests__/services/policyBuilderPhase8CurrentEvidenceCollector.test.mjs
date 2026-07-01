import {
  ARTIFACT_INVENTORY_BUCKETS,
  buildPolicyBuilderPhase8CurrentEvidenceRun,
  categorizeArtifactPath,
  collectArtifactInventory,
  extractChangelogEvidence,
  extractRoadmapEvidence,
  normalizeRepositoryPath,
} from '../../services/policyBuilderPhase8CurrentEvidenceCollector.mjs';
import {
  PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS,
} from '../../services/policyBuilderPhase8CompletionEvidenceRun.mjs';
import {
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs';

const ALL_MAPPED_PATHS = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
  .flatMap(component => [
    ...component.designDocPaths,
    ...component.contractPaths,
    ...component.testPaths,
  ]);

function completeRoadmapContent() {
  const componentSections = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
    .map(component => {
      const number = component.phaseId.replace('8r_', '');

      return `### 8R.${number} ${component.label}`;
    })
    .join('\n');
  const sequenceItems = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
    .map((component, index) => {
      const number = component.phaseId.replace('8r_', '');

      return `${index + 1}. **8R.${number} ${component.label}**`;
    })
    .join('\n');

  return `${componentSections}\n\n## Phase 8R Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent() {
  return PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP
    .map(component => `- **Policy Builder Phase 8R ${component.label}**`)
    .join('\n');
}

function completeFinalRemovalAudit() {
  return {
    statusId: PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
    complete: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
  };
}

function completeValidationEvidence() {
  return {
    focused: {
      command: 'node ./scripts/run-jest.mjs --testPathPatterns="policyBuilderPhase8"',
      passed: true,
    },
    lint: {
      command: 'npm run lint:server',
      passed: true,
    },
    markdown: {
      command: 'npm run lint:docs',
      passed: true,
    },
    full: {
      command: 'npm --prefix server test',
      passed: true,
    },
  };
}

describe('policyBuilderPhase8CurrentEvidenceCollector', () => {
  test('normalizes repository paths and categorizes mapped artifacts', () => {
    expect(normalizeRepositoryPath('.\\server\\src\\services\\example.mjs'))
      .toBe('server/src/services/example.mjs');
    expect(categorizeArtifactPath('server/src/services/example.mjs'))
      .toBe(ARTIFACT_INVENTORY_BUCKETS.SERVICE);
    expect(categorizeArtifactPath('server/src/routes/example.mjs'))
      .toBe(ARTIFACT_INVENTORY_BUCKETS.ROUTE);
    expect(categorizeArtifactPath('database/migrations/example.sql'))
      .toBe(ARTIFACT_INVENTORY_BUCKETS.MIGRATION);
    expect(categorizeArtifactPath('server/src/__tests__/example.test.mjs'))
      .toBe(ARTIFACT_INVENTORY_BUCKETS.TEST);
    expect(categorizeArtifactPath('docs/architecture/example.md'))
      .toBe(ARTIFACT_INVENTORY_BUCKETS.DOC);
    expect(categorizeArtifactPath('misc/example.txt'))
      .toBe(ARTIFACT_INVENTORY_BUCKETS.OTHER);
  });

  test('collects only present mapped artifacts and reports missing paths', () => {
    const missingPath = 'server/src/services/policyBuilderPhase8CompletionCheckpoint.mjs';
    const result = collectArtifactInventory({
      cwd: '/repo',
      fileExists: absolutePath => !absolutePath.replace(/\\/g, '/').endsWith(missingPath),
    });

    expect(result.mappedPathCount).toBe(ALL_MAPPED_PATHS.length);
    expect(result.missingPaths).toContain(missingPath);
    expect(result.missingPathCount).toBe(1);
    expect(result.presentPathCount).toBe(ALL_MAPPED_PATHS.length - 1);
  });

  test('extracts roadmap sequence and implementation status evidence', () => {
    const evidence = extractRoadmapEvidence(`
### 8R.1 Native Schema Contract
### 8R.2 Migration Candidate Report

1. **8R.1 Native Schema Contract**
2. **8R.2 Migration Candidate Report**
`);

    expect(evidence).toEqual({
      sequencePhaseIds: ['8R.1', '8R.2'],
      implementationStatusPhaseIds: ['8R.1', '8R.2'],
    });
  });

  test('extracts changelog coverage by component label', () => {
    const evidence = extractChangelogEvidence({
      changelogContent: completeChangelogContent(),
    });

    expect(evidence.updated).toBe(true);
    expect(evidence.phaseIds).toEqual(
      PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP.map(component => component.phaseId)
    );
  });

  test('builds a complete current evidence run from supplied repository evidence', () => {
    const result = buildPolicyBuilderPhase8CurrentEvidenceRun({
      cwd: '/repo',
      fileExists: () => true,
      readTextFile: filePath => (
        filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
          ? completeChangelogContent()
          : completeRoadmapContent()
      ),
      finalRemovalAudit: completeFinalRemovalAudit(),
      validationEvidence: completeValidationEvidence(),
    });

    expect(result.evidenceRun.statusId)
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(result.evidenceRun.complete).toBe(true);
    expect(result.artifactInventory.missingPathCount).toBe(0);
  });

  test('blocks current evidence run when validation evidence is absent', () => {
    const result = buildPolicyBuilderPhase8CurrentEvidenceRun({
      cwd: '/repo',
      fileExists: () => true,
      readTextFile: filePath => (
        filePath.endsWith('CHANGELOG.md')
          ? completeChangelogContent()
          : completeRoadmapContent()
      ),
      finalRemovalAudit: completeFinalRemovalAudit(),
    });

    expect(result.evidenceRun.statusId)
      .toBe(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(result.evidenceRun.checkpoint.risks.map(risk => risk.riskId))
      .toEqual(expect.arrayContaining([
        'focused_validation_missing',
        'lint_validation_missing',
        'markdown_validation_missing',
        'full_validation_missing',
      ]));
  });
});
