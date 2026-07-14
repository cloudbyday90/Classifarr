import {
  ARTIFACT_INVENTORY_BUCKETS,
  buildPolicyStorageClosureCurrentEvidenceRun,
  categorizeArtifactPath,
  collectArtifactInventory,
  extractChangelogEvidence,
  extractRoadmapEvidence,
  isHistoricComponentIdentifier,
  normalizeRepositoryPath,
  removeHistoricComponentIdentifier,
} from '../../services/policyStorageClosureCurrentEvidenceCollector.mjs';
import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';

const ALL_MAPPED_PATHS = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
  .flatMap(component => [
    ...component.designDocPaths,
    ...component.contractPaths,
    ...component.testPaths,
  ]);

function completeRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .map(component => `### ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent() {
  return `
## [Unreleased]

### Added

- **Native Policy Intent Storage** — added durable policy storage.
`;
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

describe('policyStorageClosureCurrentEvidenceCollector', () => {
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
    const missingPath = 'server/src/services/policyStorageCompletionCheckpoint.mjs';
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
    const evidence = extractRoadmapEvidence({
      roadmapContent: `
### Native Schema Contract
### Migration Candidate Report

1. **Native Schema Contract**
2. **Migration Candidate Report**
`,
    });

    expect(evidence).toEqual({
      componentSequenceIds: ['native_schema_contract', 'migration_candidate_report'],
      implementationStatusComponentIds: ['native_schema_contract', 'migration_candidate_report'],
    });
  });

  test('emits durable IDs when historic roadmap labels remain in documentation', () => {
    const evidence = extractRoadmapEvidence({
      roadmapContent: `
### 8R.1 Native Schema Contract

1. **8R.1 Native Schema Contract**
`,
    });

    expect(evidence).toEqual({
      componentSequenceIds: ['native_schema_contract'],
      implementationStatusComponentIds: ['native_schema_contract'],
    });
  });

  test('parses historical component identifiers without a backtracking regex', () => {
    expect(isHistoricComponentIdentifier('8R.5.2')).toBe(true);
    expect(isHistoricComponentIdentifier('9.12')).toBe(true);
    expect(isHistoricComponentIdentifier('8R')).toBe(false);
    expect(isHistoricComponentIdentifier('8R.5a')).toBe(false);
    expect(removeHistoricComponentIdentifier('8R.5.2 Rollback Snapshot Retention Cleanup'))
      .toBe('Rollback Snapshot Retention Cleanup');
    expect(removeHistoricComponentIdentifier('Rollback Snapshot Retention Cleanup'))
      .toBe('Rollback Snapshot Retention Cleanup');
  });

  test('collects discrete rollback subcomponents from headings and nested work-sequence items', () => {
    const evidence = extractRoadmapEvidence({
      roadmapContent: `
#### 8R.5.1 Transactional Native Authority Reversion
#### 8R.5.2 Rollback Snapshot Retention Cleanup

5. **Rollback Snapshot And Reversion Window**
   - **Transactional Native Authority Reversion**
   - **Rollback Snapshot Retention Cleanup**
`,
    });

    expect(evidence).toEqual({
      componentSequenceIds: [
        'rollback_snapshot_reversion_window',
        'transactional_native_authority_reversion',
        'rollback_snapshot_retention_cleanup',
      ],
      implementationStatusComponentIds: [
        'transactional_native_authority_reversion',
        'rollback_snapshot_retention_cleanup',
      ],
    });
  });

  test('matches complete labels without accepting longer heading or list labels', () => {
    const evidence = extractRoadmapEvidence({
      roadmapContent: `
### native schema contract: implemented
### Native Schema Contracts
### Native Schema Contractual Guidance

1. **Native Schema Contract:** completed
2. **Native Schema Contracts**
3. **Native Schema Contractual Guidance**
`,
    });

    expect(evidence).toEqual({
      componentSequenceIds: ['native_schema_contract'],
      implementationStatusComponentIds: ['native_schema_contract'],
    });
  });

  test('extracts changelog coverage from the durable storage outcome', () => {
    const evidence = extractChangelogEvidence({
      changelogContent: completeChangelogContent(),
    });

    expect(evidence.updated).toBe(true);
    expect(evidence.coverageMode).toBe('release_outcome');
    expect(evidence.componentIds).toEqual(
      POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP.map(component => component.componentId)
    );
  });

  test('builds a complete current evidence run from supplied repository evidence', async () => {
    const result = await buildPolicyStorageClosureCurrentEvidenceRun({
      cwd: '/repo',
      fileExists: () => true,
      readTextFile: filePath => (
        filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
          ? completeChangelogContent()
          : completeRoadmapContent()
      ),
      completionAuditArtifact: await buildCompletionAuditArtifactFixture(),
      validationEvidence: completeValidationEvidence(),
    });

    expect(result.evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE);
    expect(result.evidenceRun.complete).toBe(true);
    expect(result.artifactInventory.missingPathCount).toBe(0);
  });

  test('blocks current evidence run when validation evidence is absent', async () => {
    const result = await buildPolicyStorageClosureCurrentEvidenceRun({
      cwd: '/repo',
      fileExists: () => true,
      readTextFile: filePath => (
        filePath.endsWith('CHANGELOG.md')
          ? completeChangelogContent()
          : completeRoadmapContent()
      ),
      completionAuditArtifact: await buildCompletionAuditArtifactFixture(),
    });

    expect(result.evidenceRun.statusId)
      .toBe(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT);
    expect(result.evidenceRun.checkpoint.risks.map(risk => risk.riskId))
      .toEqual(expect.arrayContaining([
        'focused_validation_missing',
        'lint_validation_missing',
        'markdown_validation_missing',
        'full_validation_missing',
      ]));
  });
});
