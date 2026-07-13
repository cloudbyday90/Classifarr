import fs from 'node:fs';
import path from 'node:path';

import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  buildPolicyStorageClosureEvidenceRun,
} from './policyStorageClosureEvidenceRun.mjs';
import {
  extractPolicyStorageReleaseNoteCoverage,
} from './policyStorageReleaseNoteCoverage.mjs';

const POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_COLLECTOR_VERSION =
  'policy.storage_closure_current_evidence_collector.v1';

const DEFAULT_POLICY_STORAGE_CLOSURE_ROADMAP_PATH =
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

const ROADMAP_ENTRY_TYPES = Object.freeze({
  IMPLEMENTATION_STATUS: 'implementation_status',
  SEQUENCE: 'sequence',
});

const ROADMAP_ENTRY_PATTERNS = Object.freeze({
  [ROADMAP_ENTRY_TYPES.IMPLEMENTATION_STATUS]: /^###\s+/,
  [ROADMAP_ENTRY_TYPES.SEQUENCE]: /^\d+\.\s+\*\*/,
});
const HISTORIC_COMPONENT_IDENTIFIER_PATTERN = /^\d+[a-z]?\.\d+\s+/i;

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

function getMappedArtifactPaths(componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP) {
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
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
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

function getRoadmapEntryLabelCandidate({
  line = '',
  entryType = ROADMAP_ENTRY_TYPES.SEQUENCE,
} = {}) {
  const pattern = ROADMAP_ENTRY_PATTERNS[entryType];
  const value = String(line || '');

  if (!pattern || !pattern.test(value)) {
    return '';
  }

  return value
    .replace(pattern, '')
    .replace(HISTORIC_COMPONENT_IDENTIFIER_PATTERN, '');
}

function hasRoadmapComponentLabel({
  labelCandidate = '',
  label = '',
} = {}) {
  const normalizedCandidate = String(labelCandidate || '').trim().toLowerCase();
  const normalizedLabel = String(label || '').trim().toLowerCase();

  if (!normalizedLabel || !normalizedCandidate.startsWith(normalizedLabel)) {
    return false;
  }

  const labelBoundary = normalizedCandidate[normalizedLabel.length];
  return !labelBoundary || !/[a-z0-9_]/i.test(labelBoundary);
}

function collectRoadmapComponentIds({
  roadmapContent = '',
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  entryType = ROADMAP_ENTRY_TYPES.SEQUENCE,
} = {}) {
  const labelCandidates = String(roadmapContent || '')
    .split(/\r?\n/)
    .map(line => getRoadmapEntryLabelCandidate({ line, entryType }))
    .filter(Boolean);

  return asArray(componentArtifactMap)
    .filter(component => labelCandidates.some(labelCandidate => hasRoadmapComponentLabel({
      labelCandidate,
      label: component.label,
    })))
    .map(component => component.componentId);
}

function extractRoadmapEvidence({
  roadmapContent = '',
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
} = {}) {
  return {
    componentSequenceIds: collectRoadmapComponentIds({
      roadmapContent,
      componentArtifactMap,
      entryType: ROADMAP_ENTRY_TYPES.SEQUENCE,
    }),
    implementationStatusComponentIds: collectRoadmapComponentIds({
      roadmapContent,
      componentArtifactMap,
      entryType: ROADMAP_ENTRY_TYPES.IMPLEMENTATION_STATUS,
    }),
  };
}

function extractChangelogEvidence({
  changelogContent = '',
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
} = {}) {
  return extractPolicyStorageReleaseNoteCoverage({
    changelogContent,
    componentArtifactMap,
  });
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

function buildPolicyStorageClosureCurrentEvidenceRun({
  cwd = process.cwd(),
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  roadmapPath = DEFAULT_POLICY_STORAGE_CLOSURE_ROADMAP_PATH,
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
  const roadmapEvidence = extractRoadmapEvidence({
    roadmapContent,
    componentArtifactMap,
  });
  const changelogEvidence = extractChangelogEvidence({
    changelogContent,
    componentArtifactMap,
  });
  const evidenceRun = buildPolicyStorageClosureEvidenceRun({
    artifactInventory: artifactInventoryResult.artifactInventory,
    componentArtifactMap,
    roadmapEvidence,
    finalRemovalAudit,
    validationEvidence,
    changelogEvidence,
    sideEffects,
  });

  return {
    version: POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_COLLECTOR_VERSION,
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
  DEFAULT_POLICY_STORAGE_CLOSURE_ROADMAP_PATH,
  POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_COLLECTOR_VERSION,
  ROADMAP_ENTRY_TYPES,
  buildPolicyStorageClosureCurrentEvidenceRun,
  categorizeArtifactPath,
  collectArtifactInventory,
  collectRoadmapComponentIds,
  extractChangelogEvidence,
  extractRoadmapEvidence,
  getMappedArtifactPaths,
  normalizeRepositoryPath,
};
