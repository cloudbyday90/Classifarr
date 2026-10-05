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

Focused tests passed before image testing. Full backend, final quality checks,
same-image isolated lifecycle rehearsal, schema dump and local replacement are
pending. Outcomes below will be recorded after those checks finish.

Random current open [PR 556](node-types-pr-556-outcome.md) was applied and tested
locally. It failed the Node 24 declaration-major check and was removed before
installation. No merge or dependency upgrade is retained.

The recovery skill required bounded work and real database/HTTP evidence. The
release-evidence skill keeps that evidence separate from a published upgrade,
production activation or sustained resource soak. No release is created.

Next: implement the production offline migration/selection verifier and sanitized
bootstrap environment handoff, then published-old-image upgrade testing. Complete
database-enforced ingestion fencing before unattended legacy ownership recovery.
