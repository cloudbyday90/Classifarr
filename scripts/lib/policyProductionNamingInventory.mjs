/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_BUILDER_PRODUCTION_NAME_INVENTORY_VERSION =
  'policy_builder.production_name_inventory.v1';

const PRODUCTION_NAMING_DECISION_IDS = Object.freeze({
  RENAME_IN_PRODUCTION_CODE: 'rename_in_production_code',
  KEEP_DOCS_HISTORY: 'keep_docs_history',
  KEEP_TEST_MIGRATION_EVIDENCE: 'keep_test_migration_evidence',
  KEEP_MAINTENANCE_HISTORIC_SCANNER: 'keep_maintenance_historic_scanner',
  TEMPORARY_ADAPTER_WITH_DELETION_GATE: 'temporary_adapter_with_deletion_gate',
  DELETE_WITH_OBSOLETE_MIGRATION_TOOLING: 'delete_with_obsolete_migration_tooling',
});

const PRODUCTION_NAMING_CATEGORY_IDS = Object.freeze({
  PRODUCTION: 'production',
  TEST: 'test',
  DOCS_HISTORY: 'docs_history',
  SCRIPT_OR_COMMAND: 'script_or_command',
  MIGRATION_EVIDENCE: 'migration_evidence',
  GENERATED_ARTIFACT: 'generated_artifact',
  UNKNOWN: 'unknown',
});

const PRODUCTION_NAMING_RISK_IDS = Object.freeze({
  UNCLASSIFIED_REFERENCE: 'unclassified_reference',
  PRODUCTION_KEEP_WITHOUT_ADAPTER_GATE: 'production_keep_without_adapter_gate',
  MISSING_DURABLE_TARGET: 'missing_durable_target',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

const PHASE_TOKENS = Object.freeze([
  'phase',
  'Phase',
  'PHASE',
]);

const PHASE_CODE_TOKENS = Object.freeze([
  '0R',
  '1R',
  '2R',
  '3R',
  '5R',
  '6R',
  '7R',
  '8R',
  '9R',
  'R6',
]);

const HISTORIC_TOKEN_SCANNER_PATHS = Object.freeze([
  'scripts/lib/policyProductionNamingInventory.mjs',
  'scripts/lib/policyProductLanguageAudit.mjs',
]);

const DURABLE_TARGET_HINTS = Object.freeze([
  ['policyBuilderProductionNameInventory', 'policyBuilderProductionNameInventory'],
  ['classificationPhaseService', 'classificationProgressStageService'],
  ['ClassificationPhaseService', 'ClassificationProgressStageService'],
  ['currentPhase', 'currentStage'],
  ['phaseStatus', 'stageStatus'],
  ['Phase Status', 'Stage Status'],
  ['classification phase', 'classification stage'],
  ['EvidenceBoundary', 'policyEvidenceBoundary'],
  ['EvidenceInputGate', 'policyEvidenceInputGate'],
  ['EvidenceProjectionFingerprint', 'policyEvidenceFingerprint'],
  ['EvidenceEngine', 'policyEvidenceEngine'],
  ['IntentEngine', 'policyIntentInference'],
  ['LearningGuard', 'policyLearningEligibility'],
  ['ReadinessEngine', 'policyAutomationReadiness'],
  ['OperatorWorkflow', 'policyOperatorWorkflow'],
  ['MigrationDeletionPath', 'policyMigrationDeletionPlanner'],
  ['RuntimeEvidenceProjection', 'runtimeEvidenceProjection'],
  ['RuntimeEvidenceFingerprint', 'runtimeEvidenceFingerprint'],
  ['AutomationDecisionContract', 'runtimeAutomationDecision'],
  ['RuntimeQuestionReduction', 'runtimeClarificationPlanner'],
  ['RequestTimeLearning', 'requestLearningGuard'],
  ['LibraryPolicyRebuild', 'libraryPolicyRebuild'],
  ['MigrationVerifierRollback', 'policyMigrationVerifierRollback'],
  ['RuntimeMetricsTrace', 'policyRuntimeObservability'],
  ['RuntimeDecisionInventory', 'runtimeDecisionInventory'],
  ['RuntimeRebuildTestReset', 'runtimeRebuildTestReset'],
  ['NativeSchemaContract', 'nativePolicyIntentSchemaContract'],
  ['NativeSqlMigrationCoverage', 'nativePolicyIntentMigrationCoverage'],
  ['MigrationCandidateReport', 'policyIntentMigrationCandidateReport'],
  ['ExplicitConversionWorkflow', 'policyIntentConversionWorkflow'],
  ['NativeRuntimeReadPath', 'nativePolicyIntentReadPath'],
  ['RollbackSnapshotWindow', 'policyIntentRollbackWindow'],
  ['LegacyWritePathShutdown', 'legacyPolicyWriteShutdown'],
  ['LegacyCodeDeletionGates', 'legacyPolicyCodeDeletionGates'],
  ['BackupRestoreSafety', 'nativePolicyBackupRestoreSafety'],
  ['NativeBackupRestoreWiring', 'nativePolicyBackupRestoreWiring'],
  ['PostUpgradeDryRun', 'nativePolicyPostUpgradeDryRun'],
  ['PostUpgradeApplyGate', 'nativePolicyPostUpgradeApplyGate'],
  ['NativeRuntimeCutoverVerification', 'nativePolicyRuntimeCutoverVerification'],
  ['CompatibilityPathDeletionReadiness', 'legacyPolicyCompatibilityDeletionReadiness'],
  ['CompatibilityPathDeletionExecutionPlan', 'legacyPolicyCompatibilityDeletionPlan'],
  ['CompatibilityPathDeletionExecutionGate', 'legacyPolicyCompatibilityDeletionGate'],
  ['ControlledCompatibilityPathRemoval', 'legacyPolicyCompatibilityRemoval'],
  ['ControlledRemovalApplyArtifact', 'legacyPolicyRemovalApplyArtifact'],
  ['PostRemovalRuntimeVerification', 'legacyPolicyPostRemovalVerification'],
  ['NextCompatibilityRemovalBatchAuthorization', 'legacyPolicyRemovalBatchAuthorization'],
  ['CompatibilityRemovalCompletionAudit', 'legacyPolicyRemovalCompletionAudit'],
  ['CompletionCheckpoint', 'policyBuilderCompletionCheckpoint'],
  ['CompletionEvidenceRun', 'policyBuilderCompletionEvidenceRun'],
  ['ValidationEvidence', 'policyBuilderValidationEvidence'],
  ['FinalClosureReadout', 'policyBuilderClosureReadout'],
  ['FinalRequirementCompletionAudit', 'policyBuilderCompletionAudit'],
  ['CurrentRepositoryClosureAudit', 'policyBuilderRepositoryClosureAudit'],
  ['CurrentEvidenceCollector', 'policyBuilderEvidenceCollector'],
  ['CompletionAudit', 'policyBuilderCompletionAudit'],
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRepoPath(value) {
  return normalizeString(value).replaceAll('\\', '/').replace(/^\/+/, '');
}

function isIdentifierChar(char) {
  return Boolean(char) && (
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    (char >= '0' && char <= '9') ||
    char === '_'
  );
}

function includesTokenWithIdentifierBoundary(line, token) {
  let startIndex = line.indexOf(token);

  while (startIndex !== -1) {
    const previousChar = startIndex > 0 ? line[startIndex - 1] : '';
    const nextChar = line[startIndex + token.length] || '';

    if (!isIdentifierChar(previousChar) && !isIdentifierChar(nextChar)) {
      return true;
    }

    startIndex = line.indexOf(token, startIndex + token.length);
  }

  return false;
}

function findPhaseTokens(line) {
  return [
    ...PHASE_TOKENS.filter(token => line.includes(token)),
    ...PHASE_CODE_TOKENS.filter(token => includesTokenWithIdentifierBoundary(line, token)),
  ];
}

function classifyPath(repoPath) {
  const normalizedPath = normalizeRepoPath(repoPath);

  if (
    normalizedPath.startsWith('docs/') ||
    normalizedPath === 'CHANGELOG.md' ||
    normalizedPath === 'RELEASE_NOTES.md' ||
    normalizedPath === 'README.md'
  ) {
    return PRODUCTION_NAMING_CATEGORY_IDS.DOCS_HISTORY;
  }

  if (
    normalizedPath.startsWith('database/migrations/') ||
    normalizedPath.startsWith('database/schema/')
  ) {
    return PRODUCTION_NAMING_CATEGORY_IDS.MIGRATION_EVIDENCE;
  }

  if (
    normalizedPath.includes('/__tests__/') ||
    normalizedPath.endsWith('.test.js') ||
    normalizedPath.endsWith('.test.mjs')
  ) {
    return PRODUCTION_NAMING_CATEGORY_IDS.TEST;
  }

  if (
    normalizedPath.startsWith('scripts/') ||
    normalizedPath === 'package.json' ||
    normalizedPath === 'server/package.json' ||
    normalizedPath === 'client/package.json'
  ) {
    return PRODUCTION_NAMING_CATEGORY_IDS.SCRIPT_OR_COMMAND;
  }

  if (normalizedPath.startsWith('server/src/') || normalizedPath.startsWith('client/src/')) {
    return PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION;
  }

  if (normalizedPath.startsWith('.tmp/') || normalizedPath.startsWith('data/')) {
    return PRODUCTION_NAMING_CATEGORY_IDS.GENERATED_ARTIFACT;
  }

  return PRODUCTION_NAMING_CATEGORY_IDS.UNKNOWN;
}

function deriveDurableTarget({ repoPath, excerpt }) {
  const candidateText = `${repoPath} ${excerpt}`;
  const matchedHint = DURABLE_TARGET_HINTS.find(([phaseHint]) => candidateText.includes(phaseHint));

  if (matchedHint) {
    return matchedHint[1];
  }

  if (candidateText.includes('Phase6') || candidateText.includes('Phase 6R')) {
    return 'policyIntentEngine';
  }

  if (candidateText.includes('Phase7') || candidateText.includes('Phase 7R')) {
    return 'policyRuntimeAutomation';
  }

  if (candidateText.includes('Phase8') || candidateText.includes('Phase 8R')) {
    return 'nativePolicyIntentMigration';
  }

  if (candidateText.includes('Phase9') || candidateText.includes('Phase 9R')) {
    return 'policyBuilderProductionNaming';
  }

  if (candidateText.toLowerCase().includes('phase')) {
    return 'durableProductDomainName';
  }

  return '';
}

function determineDecision({ categoryId, repoPath, excerpt }) {
  if (categoryId === PRODUCTION_NAMING_CATEGORY_IDS.DOCS_HISTORY) {
    return PRODUCTION_NAMING_DECISION_IDS.KEEP_DOCS_HISTORY;
  }

  if (categoryId === PRODUCTION_NAMING_CATEGORY_IDS.MIGRATION_EVIDENCE) {
    return PRODUCTION_NAMING_DECISION_IDS.KEEP_TEST_MIGRATION_EVIDENCE;
  }

  if (categoryId === PRODUCTION_NAMING_CATEGORY_IDS.TEST) {
    return PRODUCTION_NAMING_DECISION_IDS.KEEP_TEST_MIGRATION_EVIDENCE;
  }

  if (
    categoryId === PRODUCTION_NAMING_CATEGORY_IDS.SCRIPT_OR_COMMAND &&
    HISTORIC_TOKEN_SCANNER_PATHS.includes(repoPath)
  ) {
    return PRODUCTION_NAMING_DECISION_IDS.KEEP_MAINTENANCE_HISTORIC_SCANNER;
  }

  if (
    categoryId === PRODUCTION_NAMING_CATEGORY_IDS.SCRIPT_OR_COMMAND &&
    (repoPath.includes('generate-policy-builder-phase-8r') || excerpt.includes('policy:phase8r'))
  ) {
    return PRODUCTION_NAMING_DECISION_IDS.DELETE_WITH_OBSOLETE_MIGRATION_TOOLING;
  }

  if (
    categoryId === PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION ||
    categoryId === PRODUCTION_NAMING_CATEGORY_IDS.SCRIPT_OR_COMMAND
  ) {
    return PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE;
  }

  return '';
}

function buildInventoryReference({ repoPath, line, lineNumber }) {
  const categoryId = classifyPath(repoPath);
  const excerpt = normalizeString(line).slice(0, 220);
  const decisionId = determineDecision({ categoryId, repoPath, excerpt });
  const durableTarget = deriveDurableTarget({ repoPath, excerpt });

  return {
    repoPath,
    lineNumber,
    categoryId,
    decisionId,
    durableTarget,
    tokens: findPhaseTokens(line),
    excerpt,
    adapterDeletionGate:
      decisionId === PRODUCTION_NAMING_DECISION_IDS.TEMPORARY_ADAPTER_WITH_DELETION_GATE
        ? 'required_before_completion'
        : null,
  };
}

function extractInventoryReferences(files = []) {
  return asArray(files).flatMap(file => {
    const repoPath = normalizeRepoPath(file.path);
    return normalizeString(file.content)
      .split('\n')
      .flatMap((line, index) => {
        const tokens = findPhaseTokens(line);

        if (tokens.length === 0) {
          return [];
        }

        return [buildInventoryReference({
          repoPath,
          line,
          lineNumber: index + 1,
        })];
      });
  });
}

function summarizeReferences(references) {
  const byCategory = {};
  const byDecision = {};

  asArray(references).forEach(reference => {
    byCategory[reference.categoryId] = (byCategory[reference.categoryId] || 0) + 1;
    byDecision[reference.decisionId || 'unclassified'] =
      (byDecision[reference.decisionId || 'unclassified'] || 0) + 1;
  });

  return {
    totalReferences: references.length,
    byCategory,
    byDecision,
    productionReferenceCount: references.filter(reference =>
      reference.categoryId === PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION
    ).length,
    renameCandidateCount: references.filter(reference =>
      reference.decisionId === PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE
    ).length,
    keepHistoryCount: references.filter(reference =>
      reference.decisionId === PRODUCTION_NAMING_DECISION_IDS.KEEP_DOCS_HISTORY
    ).length,
    testOrMigrationEvidenceCount: references.filter(reference =>
      reference.decisionId === PRODUCTION_NAMING_DECISION_IDS.KEEP_TEST_MIGRATION_EVIDENCE ||
      reference.decisionId === PRODUCTION_NAMING_DECISION_IDS.KEEP_MAINTENANCE_HISTORIC_SCANNER
    ).length,
    obsoleteToolingCount: references.filter(reference =>
      reference.decisionId === PRODUCTION_NAMING_DECISION_IDS.DELETE_WITH_OBSOLETE_MIGRATION_TOOLING
    ).length,
  };
}

function buildRenameMap(references) {
  const renameEntries = asArray(references)
    .filter(reference =>
      reference.decisionId === PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE
    )
    .map(reference => ({
      repoPath: reference.repoPath,
      lineNumber: reference.lineNumber,
      currentExcerpt: reference.excerpt,
      durableTarget: reference.durableTarget,
    }));

  return renameEntries;
}

function validatePolicyBuilderProductionNameInventory(inventory = {}) {
  const risks = [];

  asArray(inventory.references).forEach(reference => {
    if (!reference.decisionId) {
      risks.push({
        riskId: PRODUCTION_NAMING_RISK_IDS.UNCLASSIFIED_REFERENCE,
        repoPath: reference.repoPath,
        lineNumber: reference.lineNumber,
        message: 'Every phase-coded reference must have a keep, rename, adapter, or delete decision.',
      });
    }

    if (
      reference.categoryId === PRODUCTION_NAMING_CATEGORY_IDS.PRODUCTION &&
      reference.decisionId !== PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE &&
      reference.decisionId !== PRODUCTION_NAMING_DECISION_IDS.TEMPORARY_ADAPTER_WITH_DELETION_GATE
    ) {
      risks.push({
        riskId: PRODUCTION_NAMING_RISK_IDS.PRODUCTION_KEEP_WITHOUT_ADAPTER_GATE,
        repoPath: reference.repoPath,
        lineNumber: reference.lineNumber,
        decisionId: reference.decisionId,
        message: 'Production phase-coded references must be renamed or explicitly adapter-gated.',
      });
    }

    if (
      reference.decisionId === PRODUCTION_NAMING_DECISION_IDS.RENAME_IN_PRODUCTION_CODE &&
      !reference.durableTarget
    ) {
      risks.push({
        riskId: PRODUCTION_NAMING_RISK_IDS.MISSING_DURABLE_TARGET,
        repoPath: reference.repoPath,
        lineNumber: reference.lineNumber,
        message: 'Production rename decisions must include a durable product-domain target.',
      });
    }
  });

  Object.entries(inventory.sideEffects || {}).forEach(([sideEffectId, performed]) => {
    if (sideEffectId !== 'filesRead' && performed === true) {
      risks.push({
        riskId: PRODUCTION_NAMING_RISK_IDS.SIDE_EFFECT_REPORTED,
        sideEffectId,
        message: `Production naming inventory cannot perform side effect "${sideEffectId}".`,
      });
    }
  });

  return {
    ok: risks.length === 0,
    riskCount: risks.length,
    risks,
  };
}

function buildPolicyProductionNamingInventory(options = {}) {
  const files = asArray(options.files);
  const references = extractInventoryReferences(files);
  const renameMap = buildRenameMap(references);
  const inventory = {
    version: POLICY_BUILDER_PRODUCTION_NAME_INVENTORY_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    scanScope: 'provided_files',
    references,
    renameMap,
    summary: summarizeReferences(references),
    sideEffects: {
      filesRead: false,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    },
    nextStep: {
      stepId: 'durable_domain_module_cutover',
      label: 'Durable Domain Module Cutover',
      reason:
        'Temporary production names are inventoried and classified; mechanical durable-name moves can now be planned.',
    },
  };

  return {
    ...inventory,
    validation: validatePolicyBuilderProductionNameInventory(inventory),
  };
}

export {
  POLICY_BUILDER_PRODUCTION_NAME_INVENTORY_VERSION,
  PRODUCTION_NAMING_CATEGORY_IDS,
  PRODUCTION_NAMING_DECISION_IDS,
  PRODUCTION_NAMING_RISK_IDS,
  buildPolicyProductionNamingInventory,
  extractInventoryReferences,
  validatePolicyBuilderProductionNameInventory,
};
