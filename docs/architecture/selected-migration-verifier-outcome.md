# Selected migration verifier outcome

Date: 2026-10-05. See [design and official research](selected-migration-verifier-design.md).

## Implementation

Added small ESM policy, catalog verification, offline/online verification and
bootstrap handoff modules. Verification uses real cluster identity, protected
configuration and catalog state rather than a synthetic sentinel table. Saved
settings travel through bounded canonical JSON stdin to a fixed Node executable
with a constructed environment; their Node options cannot control that process.

The existing isolated lifecycle rehearsal now uses this production verifier and
tests wrong cluster identity, injected configuration and an escalated runtime
role. No production conversion, permissions repair, key rotation or ingestion
record reset is enabled. The trusted parent still supplies independently recorded
cluster identity and retains the migration lease. The production offline
conversion/provisioning and root entrypoint handoff remain follow-up work.

## Validation

Validation, final image identity and local evaluation are pending.

A fresh random draw from currently open PRs 555/556 selected
[PR 556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`, at base
`5be901c5f011b431e16521d9911880e3333459ba`. The exact two-file change was applied
locally: baseline 8/8 tests passed; candidate 7/8, with Node 26 declarations
rejected by the unchanged Node 24 alignment check. Registry metadata/integrities
matched the diff. Removed only that trial before installation. No PR merge,
dependency upgrade or candidate runtime-compatibility claim.

Recovery-skill safeguards require actual database/HTTP tests and prohibit
fabricated ownership. Release-evidence checks distinguish this synthetic
same-image exercise from a published upgrade. No release is created.

Next: production offline conversion/provisioning with independently persisted
cluster binding and preserved vector/database tuning, then published-image
upgrade tests. Database-enforced ingestion fencing remains necessary before
fully unattended unknown-owner recovery.
