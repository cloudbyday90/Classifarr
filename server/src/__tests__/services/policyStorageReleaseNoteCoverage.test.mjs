import {
  POLICY_STORAGE_RELEASE_NOTE_COVERAGE_MODE_IDS,
  POLICY_STORAGE_RELEASE_NOTE_TITLE,
  extractPolicyStorageReleaseNoteCoverage,
  extractUnreleasedChangelogContent,
} from '../../services/policyStorageReleaseNoteCoverage.mjs';

const COMPONENT_ARTIFACT_MAP = [
  { componentId: 'native_schema_contract' },
  { componentId: 'storage_completion_checkpoint' },
];

describe('policyStorageReleaseNoteCoverage', () => {
  test('covers every mapped component from one durable Unreleased outcome', () => {
    const coverage = extractPolicyStorageReleaseNoteCoverage({
      changelogContent: `
## [Unreleased]

### Added

- **${POLICY_STORAGE_RELEASE_NOTE_TITLE}** — added durable policy storage.

## [0.47.5c-beta] - 2026-06-17
`,
      componentArtifactMap: COMPONENT_ARTIFACT_MAP,
    });

    expect(coverage).toEqual({
      updated: true,
      coverageMode: POLICY_STORAGE_RELEASE_NOTE_COVERAGE_MODE_IDS.OUTCOME,
      releaseOutcomeTitle: POLICY_STORAGE_RELEASE_NOTE_TITLE,
      componentIds: ['native_schema_contract', 'storage_completion_checkpoint'],
    });
  });

  test('does not treat a historical release note as current Unreleased coverage', () => {
    const coverage = extractPolicyStorageReleaseNoteCoverage({
      changelogContent: `
## [Unreleased]

### Changed

- **Other Outcome** — changed behavior.

## [0.47.5c-beta] - 2026-06-17

- **${POLICY_STORAGE_RELEASE_NOTE_TITLE}** — added durable policy storage.
`,
      componentArtifactMap: COMPONENT_ARTIFACT_MAP,
    });

    expect(coverage).toEqual({
      updated: false,
      coverageMode: null,
      releaseOutcomeTitle: POLICY_STORAGE_RELEASE_NOTE_TITLE,
      componentIds: [],
    });
  });

  test('returns an empty string when Unreleased is absent', () => {
    expect(extractUnreleasedChangelogContent('## [0.47.5c-beta] - 2026-06-17'))
      .toBe('');
  });
});
