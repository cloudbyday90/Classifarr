import fs from 'node:fs';
import path from 'node:path';

import {
  PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  buildPolicyBuilderPhase8CompletionEvidenceRun,
} from './policyBuilderPhase8CompletionEvidenceRun.mjs';

const PHASE8R_CURRENT_EVIDENCE_COLLECTOR_VERSION =
  'phase8r.current_evidence_collector.v1';

const DEFAULT_PHASE8R_ROADMAP_PATH =
  'docs/architecture/policy-builder-intent-model-roadmap.md';
const DEFAULT_CHANGELOG_PATH = 'CHANGELOG.md';

const ARTIFACT_INVENTORY_BUCKETS = Object.freeze({
  SERVICE: 'servicePaths',
  ROUTE: 'routePaths',
  MIGRATION: 'migrationPaths',
  TEST: 'testPaths',
  DOC: 'docPaths',
  WIRING: 'wiringPaths',
  OTHER: 'otherPaths',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRepositoryPath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function resolveRepositoryPath(cwd, relativePath) {
  return path.resolve(cwd, normalizeRepositoryPath(relativePath));
}

function defaultFileExists(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Local/CI evidence collection reads mapped repository paths.
  return fs.existsSync(filePath);
}

function defaultReadTextFile(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Local/CI evidence collection reads mapped repository paths.
  return fs.readFileSync(filePath, 'utf8');
}

function categorizeArtifactPath(repositoryPath = '') {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);

  if (normalizedPath.startsWith('server/src/services/')) {
    return ARTIFACT_INVENTORY_BUCKETS.SERVICE;
  }
  if (normalizedPath.startsWith('server/src/routes/')) {
    return ARTIFACT_INVENTORY_BUCKETS.ROUTE;
  }
  if (normalizedPath.startsWith('database/migrations/')) {
    return ARTIFACT_INVENTORY_BUCKETS.MIGRATION;
  }
  if (normalizedPath.includes('/__tests__/') || normalizedPath.endsWith('.test.mjs')) {
    return ARTIFACT_INVENTORY_BUCKETS.TEST;
  }
  if (normalizedPath.startsWith('docs/') || normalizedPath.endsWith('.md')) {
    return ARTIFACT_INVENTORY_BUCKETS.DOC;
  }

  return ARTIFACT_INVENTORY_BUCKETS.OTHER;
}

function getMappedArtifactPaths(componentArtifactMap = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP) {
  return asArray(componentArtifactMap)
    .flatMap(component => [
      ...asArray(component.designDocPaths),
      ...asArray(component.contractPaths),
      ...asArray(component.testPaths),
    ])
    .map(normalizeRepositoryPath)
    .filter(Boolean);
}

function collectArtifactInventory({
  cwd = process.cwd(),
  componentArtifactMap = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  fileExists = defaultFileExists,
} = {}) {
  const artifactInventory = {
    servicePaths: [],
    routePaths: [],
    migrationPaths: [],
    testPaths: [],
    docPaths: [],
    wiringPaths: [],
    otherPaths: [],
  };
  const missingPaths = [];

  getMappedArtifactPaths(componentArtifactMap).forEach(repositoryPath => {
    const absolutePath = resolveRepositoryPath(cwd, repositoryPath);

    if (!fileExists(absolutePath)) {
      missingPaths.push(repositoryPath);
      return;
    }

    const bucket = categorizeArtifactPath(repositoryPath);
    artifactInventory[bucket].push(repositoryPath);
  });

  return {
    artifactInventory,
    mappedPathCount: getMappedArtifactPaths(componentArtifactMap).length,
    presentPathCount: Object.values(artifactInventory)
      .reduce((total, paths) => total + paths.length, 0),
    missingPathCount: missingPaths.length,
    missingPaths,
  };
}

function collectRegexMatches(content = '', pattern) {
  return [...String(content || '').matchAll(pattern)]
    .map(match => match[1])
    .filter(Boolean);
}

function extractRoadmapEvidence(roadmapContent = '') {
  return {
    sequencePhaseIds: collectRegexMatches(
      roadmapContent,
      /^\d+\.\s+\*\*(8R\.\d+)\b/gm
    ),
    implementationStatusPhaseIds: collectRegexMatches(
      roadmapContent,
      /^###\s+(8R\.\d+)\b/gm
    ),
  };
}

function normalizeSearchText(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function extractChangelogEvidence({
  changelogContent = '',
  componentArtifactMap = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
} = {}) {
  const normalizedChangelog = normalizeSearchText(changelogContent);
  const phaseIds = asArray(componentArtifactMap)
    .filter(component => normalizedChangelog.includes(normalizeSearchText(component.label)))
    .map(component => component.phaseId);

  return {
    updated: phaseIds.length > 0,
    phaseIds,
  };
}

function readOptionalTextFile({
  cwd = process.cwd(),
  repositoryPath,
  readTextFile = defaultReadTextFile,
} = {}) {
  try {
    return readTextFile(resolveRepositoryPath(cwd, repositoryPath));
  } catch (_err) {
    return '';
  }
}

function buildPolicyBuilderPhase8CurrentEvidenceRun({
  cwd = process.cwd(),
  componentArtifactMap = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  roadmapPath = DEFAULT_PHASE8R_ROADMAP_PATH,
  changelogPath = DEFAULT_CHANGELOG_PATH,
  finalRemovalAudit = {},
  validationEvidence = {},
  sideEffects = {},
  fileExists = defaultFileExists,
  readTextFile = defaultReadTextFile,
} = {}) {
  const artifactInventoryResult = collectArtifactInventory({
    cwd,
    componentArtifactMap,
    fileExists,
  });
  const roadmapContent = readOptionalTextFile({
    cwd,
    repositoryPath: roadmapPath,
    readTextFile,
  });
  const changelogContent = readOptionalTextFile({
    cwd,
    repositoryPath: changelogPath,
    readTextFile,
  });
  const roadmapEvidence = extractRoadmapEvidence(roadmapContent);
  const changelogEvidence = extractChangelogEvidence({
    changelogContent,
    componentArtifactMap,
  });
  const evidenceRun = buildPolicyBuilderPhase8CompletionEvidenceRun({
    artifactInventory: artifactInventoryResult.artifactInventory,
    componentArtifactMap,
    roadmapEvidence,
    finalRemovalAudit,
    validationEvidence,
    changelogEvidence,
    sideEffects,
  });

  return {
    version: PHASE8R_CURRENT_EVIDENCE_COLLECTOR_VERSION,
    roadmapPath,
    changelogPath,
    artifactInventory: artifactInventoryResult,
    roadmapEvidence,
    changelogEvidence,
    evidenceRun,
  };
}

export {
  ARTIFACT_INVENTORY_BUCKETS,
  DEFAULT_CHANGELOG_PATH,
  DEFAULT_PHASE8R_ROADMAP_PATH,
  PHASE8R_CURRENT_EVIDENCE_COLLECTOR_VERSION,
  buildPolicyBuilderPhase8CurrentEvidenceRun,
  categorizeArtifactPath,
  collectArtifactInventory,
  extractChangelogEvidence,
  extractRoadmapEvidence,
  getMappedArtifactPaths,
  normalizeRepositoryPath,
};
