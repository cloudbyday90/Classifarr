# Selected deployment lifecycle outcome

Date: 2026-10-05. See [design and official sources](selected-deployment-lifecycle-design.md).

## Implementation

Added a modular ESM lifecycle controller joining saved deployment compilation,
actual account/mask checks, mandatory migration/vector verification, selected
database startup, schema-first normal mode and restricted restore HTTP. The
default compiler remains normal-only; this controller explicitly admits restore.
Existing keys, app paths, heap and pool values remain in the application profile.

Fixed the shared supervisor's handling of rejected application completion and
late fatal notifications. A host stop cannot overwrite a failure arriving during
drain. Unconfirmed child termination prevents database stop; the caller must end
the container, not release it for new work. No automatic write replay was added.

The production migration preparation/verifier still exists only as fixture code.
The shell guard is deliberately unchanged: this is lifecycle integration, not
automatic protected-layout selection or legacy ingestion recovery. Forced-non-root
and saved-template installations retain their compatible startup path.

## Validation

Final focused checks passed: seven suites, 224 tests. The final full backend run passed
all 1,695 suites: 52,558 tests passed and one Linux-only filesystem test was
skipped on Windows. Equivalent copy/fsync, unchanged-source and no-overwrite
assertions passed inside the rebuilt Linux image. The first full run started
before the reviewed ownership manifest was settled and failed only that check;
the complete rerun passed after the six scoped entries were reviewed.

Backend lint/typecheck, copyright, both knip checks, ESM guards, 30 tooling tests
and Markdown checks passed. Ownership inventory: 19 owned, 297 separately
coordinated and 502 unresolved; this is not permission to run unresolved writers.
Gitleaks 8.30.1 scanned the scoped commit diff with no leaks; its downloaded
release archive was checked against the publisher's checksum. No client source
changed, and no new frontend coverage claim is made.

The clean-source no-cache image was built from
`410d913cd2f82b0b0c0a0b2f8401cf6aeb7cc146`; inspected local Docker ID:
`sha256:002b3424032c093f3c4000982685bf7daad1afce28c075526dbb37f840803e66`.
This is local Linux/amd64 AVX2 evidence, not a published multi-platform receipt.
The isolated PostgreSQL 18 schema dump/load round trip passed after rebuilding
with zero drift and no new migration. The first image rehearsal found a fixture
error: it expected the restore-only `operatingMode` field from normal health.
The normal server was healthy with its existing `status`/`database` contract.
The fixture now checks each mode's actual contract; no API was changed to satisfy
the test. The corrected image rehearsal and local replacement are still pending.

Random current open [PR 556](node-types-pr-556-outcome.md) was applied and tested
locally. It failed the Node 24 declaration-major check and was removed before
installation. No merge or dependency upgrade is retained.

The recovery skill required bounded work and real database/HTTP evidence. The
release-evidence skill keeps that evidence separate from a published upgrade,
production activation or sustained resource soak. No release is created.

Next: implement the production offline migration/selection verifier and sanitized
bootstrap environment handoff, then published-old-image upgrade testing. Complete
database-enforced ingestion fencing before unattended legacy ownership recovery.
