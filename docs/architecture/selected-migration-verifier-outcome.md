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

The complete backend run passed all 1,697 suites: 52,680 tests passed and one
Linux-only filesystem test was skipped on Windows. Focused checks passed six
suites / 126 tests, with that same filesystem skip. Backend lint/typecheck,
copyright, scoped ownership review, both knip checks, 30 tooling tests, ESM
guards and Markdown checks passed. The scoped staged diff passed Gitleaks with
no leaks. No frontend source changed or frontend coverage claim is made.

The production verifier is read-only at the application/catalog level, but
starting and stopping PostgreSQL necessarily updates its own internal files.
It is not a disk snapshot integrity proof or a general audit of arbitrary
extension/function code in an existing database.

The clean-source no-cache image was built from
`f48c319a15abd572d29c81df7e7ec771775929d6`; inspected local Docker ID:
`sha256:d4ea70c0518872d272bb47cf2bf057ebb704449202238823cec84f49ab1dbc1c`.
The Linux copy/fsync, unchanged-source and no-overwrite checks passed in this
exact image. The isolated PostgreSQL 18 schema dump/load round trip passed with
zero drift and no new migration. This is local Linux/amd64 AVX2 evidence, not
a published multi-platform receipt. The initial image rehearsal failed in the
catalog verifier: it referenced `rolconfig` on `pg_authid`, where that column does
not exist. Corrected the query to rely on `pg_db_role_setting`, added successful
verification before the negative cases and a real role-setting override case,
and preserved the original failure when lifecycle cleanup follows a rejection.
Final rebuilt-image rehearsal and local evaluation are pending.

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
