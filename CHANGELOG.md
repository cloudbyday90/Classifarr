# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Archived changelogs: [August 2026 Release Details](docs/changelog/CHANGELOG-2026-08-releases.md) | [August 2026 Pre-release Details](docs/changelog/CHANGELOG-2026-08-pre-release.md) | [June 2026](docs/changelog/CHANGELOG-2026-06.md) | [May 2026 Late](docs/changelog/CHANGELOG-2026-05-late.md) | [May 2026 Early](docs/changelog/CHANGELOG-2026-05-early.md) | [April 2026](docs/changelog/CHANGELOG-2026-04.md) | [March 2026](docs/changelog/CHANGELOG-2026-03.md)

## [Unreleased]

### Changed

- **Second-pass candidate verification** — An adopted policy-recheck confirmation candidate now enters the same strict, candidate-bound AI verification admission path as a first-pass confirmation, while the policy engine remains the routing authority.
- **Client tooling** — Applied the Vite 8.2.2 development-dependency update from open PR #519 locally; no pull request was merged and no release was created.
- **Compatibility-policy maintenance** — Existing compatibility policies now provide a direct maintenance review action, and administrators can explicitly add a bounded library-profile purpose suggestion to an unsaved policy draft before normal review and save.

### Fixed

- **Policy recheck review safety** — AI-call budgets, resilience gates, and provider failures now retain the deterministic confirmation candidate for operator review rather than replacing it with an unrelated baseline result.

### Security

- **Verification boundary consistency** — Rechecked confirmation candidates use server-owned candidate binding, provider admission before generation, and bounded status-only outcomes.

## [v0.48.2-beta] - 2026-08-22

Detailed engineering history is retained in the [August 2026 release archive](docs/changelog/CHANGELOG-2026-08-releases.md).

### Added

- **Release evidence and provider-fault gates** — Tag publication now verifies bounded evidence provenance and a disposable provider-fault recovery receipt before publishing images or a GitHub release.
- **Local AI evaluation contract** — Reviewed fixtures, policy-context fingerprints, decision witnesses, and aggregate trend comparison make local classification evaluation reproducible without exposing raw local data.
- **Bounded policy maintenance** — Administrators can review purpose coverage, remediate unresolved policies, and safely resume an interrupted native-purpose change through narrow, receipt-backed controls.
- **Release and image assurance** — Added immutable image consumer smoke, release-attestation verification, installation-evidence assembly, and manifest-aware retention assessment.

### Changed

- **Policy-route delivery** — Split authoring, maintenance, and insight pages into independent production bundles and added a Chromium cold-load budget gate for every policy route.
- **Release metadata contract** — Package and lockfile versions, the UI label, README marker and badge, and top release-note heading now share a deterministic pre-tag validation.
- **AI evaluation access** — Local sweeps exchange narrowly scoped, short-lived tokens and preserve policy authority through direct and queued decision evaluation.
- **Toolchain maintenance** — Applied reviewed client/server dependency and pinned-workflow updates while retaining ESM, lint, test, coverage, and security gates.

### Fixed

- **Provider recovery safety** — Transient provider failures persist as retryable, no-route work rather than an unsafe destination decision.
- **Evaluation correctness** — Fixed scoped-route matching, API-key authentication, queued non-final grading, and temporary AI-settings ETag handling.
- **Policy and restore reliability** — Corrected native-purpose audit persistence, pending-decision replacement, backup/restore history protection, and schema-snapshot comparison noise.
- **Client test stability** — Isolated router initialization and bounded Vitest workers for reliable constrained-host test execution.

### Security

- **Policy and provider boundaries** — Preserved server-owned route authority, capability-gated AI verification, bounded recovery data, and explicit no-route behavior under provider failure.
- **Supply-chain verification** — Enforced provenance checks for release evidence and multi-architecture images before release publication.
- **Dependency remediation** — Updated audited client, server, and workflow dependencies, including current OSV and CodeQL action pins.
