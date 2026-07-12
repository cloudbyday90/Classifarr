const POLICY_STORAGE_RELEASE_NOTE_TITLE = 'Native Policy Intent Storage';

const POLICY_STORAGE_RELEASE_NOTE_COVERAGE_MODE_IDS = Object.freeze({
  OUTCOME: 'release_outcome',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSearchText(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function extractUnreleasedChangelogContent(changelogContent = '') {
  const lines = String(changelogContent || '').split(/\r?\n/);
  const unreleasedIndex = lines.findIndex(line => line.trim() === '## [Unreleased]');

  if (unreleasedIndex === -1) {
    return '';
  }

  const nextReleaseOffset = lines
    .slice(unreleasedIndex + 1)
    .findIndex(line => /^## \[[^\]]+\]/.test(line.trim()));
  const endIndex = nextReleaseOffset === -1
    ? lines.length
    : unreleasedIndex + 1 + nextReleaseOffset;

  return lines.slice(unreleasedIndex + 1, endIndex).join('\n');
}

function extractPolicyStorageReleaseNoteCoverage({
  changelogContent = '',
  componentArtifactMap = [],
} = {}) {
  const unreleasedContent = extractUnreleasedChangelogContent(changelogContent);
  const outcomeCovered = normalizeSearchText(unreleasedContent)
    .includes(normalizeSearchText(POLICY_STORAGE_RELEASE_NOTE_TITLE));

  return {
    updated: outcomeCovered,
    coverageMode: outcomeCovered
      ? POLICY_STORAGE_RELEASE_NOTE_COVERAGE_MODE_IDS.OUTCOME
      : null,
    releaseOutcomeTitle: POLICY_STORAGE_RELEASE_NOTE_TITLE,
    componentIds: outcomeCovered
      ? asArray(componentArtifactMap)
        .map(component => String(component?.componentId || '').trim())
        .filter(Boolean)
      : [],
  };
}

export {
  POLICY_STORAGE_RELEASE_NOTE_COVERAGE_MODE_IDS,
  POLICY_STORAGE_RELEASE_NOTE_TITLE,
  extractPolicyStorageReleaseNoteCoverage,
  extractUnreleasedChangelogContent,
};
