# Capture finalization fence outcome

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Design: [scope, alternatives and official research](capture-finalization-fence-design.md).

## Result

Automatic capture now claims one private random UUID through the exact scoped
query function supplied by its discovery-lock-owning backend. The short claim
transaction serializes on the budget row, then rechecks current admission
conditions and database-visible lock ownership using a fresh command anchor.
The fixed operation is one-use, including failure. No pooled replacement claim
or persisted-token recovery exists.

The worker retains only acknowledged revision/UUID authority. Every primary and
failure finish requires it, in both the row lock and UPDATE. A newer claim makes
an old finish acknowledge zero rows. Missing or invalid authority fails closed;
claim rejection/uncertain acknowledgement cannot authorize provider work or a
cleanup finish. An exact zero-row claim defers locally for five minutes.

Same-attempt cleanup retains the UUID and existing uncertain-finish semantics.
Configuration edits, evaluator revision rotation and both configuration restore
modes invalidate it. Same-revision advance, pruning and UTC quota rollover
preserve it. Restore invalidation is token-only and transactional. Public status,
portable backups, fingerprints, application logs and provider inputs omit this
operational identifier.

The two new runtime modules are a capture admission adapter and claim leaf.
Other discovery callers retain their two callback arguments. The evaluator and
capture use the same existing database lock and resource policy; creating a
capture-specific adapter does not grant another heavy-work slot. The worker
receives no raw connection, and its downstream capture dependencies receive no
claim capability.

## Database and compatibility evidence

The nullable UUID migration has no backfill or default authority. Both the full
migration chain and the committed fresh snapshot plus this migration were
exercised in disposable PostgreSQL 18. The final snapshot was exported from the
latter, preserving unrelated schema definitions and optional extension handling.
An initial full-chain export showed pre-existing definition/format drift; that
unrelated drift was excluded. No live database or application data was used.

The focused unit run passed seven suites / 79 tests. New worker tests first
failed against the prior implementation. Final PostgreSQL receipts cover 113
distinct tests across eleven suites, combining the broader compatibility run
with the corrected controls fixture and expanded fence suite. These exercise:

- replacement claims and stale finishes without relying on the old worker's
  local lease-loss observation;
- blocked claims on terminated owner sessions, postcommit delayed/lost replies,
  wrong-backend lock proof, one-use claims and cooperative precommit rollback;
- enabled/window/cooldown/quota conditions, inherited isolation and existing
  15-second statement / one-second lock limits;
- same-attempt cleanup, charged HTTP attempts, saved publication, cooldown
  serialization, revision races, delete/recreate and merge/replace rollback.

Legacy finish/cooldown SQL fixtures now seed explicit synthetic authority; they
are not evidence of production claim ownership. Ownership tests use the real
database factory and actual owner-session claim. Existing payload/quotas snapshot
helpers intentionally exclude the newly mutable claim field; dedicated fence
tests inspect that field directly.

Full backend coverage passed 1,918 suites / 62,145 tests with one existing skip,
in 955.232 seconds. Coverage is 89.23% statements/lines, 86.65% branches and
90.77% functions. Fresh frontend coverage passed 482 files / 7,498 tests in
246.29 seconds: 87.90% statements, 82.04% branches, 87.67% functions and 89.57%
lines. The ratchet passed using both fresh reports, without baseline changes.

Server lint/typecheck, normal/production Knip, dependency policy, static import
and ESM mock-shape checks, copyright and four policy gates passed. Markdown and
whitespace checks passed. One preliminary full coverage run was stopped after
the expected ownership
source-pin failure. Eight exact affected entries were independently reviewed;
the gate now passes with its baseline, classifications and unresolved debt
unchanged. It continues to report productionCompatible false and grants no
production writer authority.

## Limits and next item

The guarantee begins after a newer claim commits, among participating updated
writers. It does not immediately detect lease loss, fence older binaries, or
prevent stale reservations, checkpoint writes or cache publication. Existing
quota/workload/revision checks remain independently necessary. Unknown COMMIT
results remain unknown; no provider replay or refund was introduced.

Reservation ownership is addressed in the separate
[reservation fence outcome](capture-reservation-fence-outcome.md). Checkpoint/
cache publication and uncertain provider outcomes remain separate boundaries.
Keep bounded write acquisition and whole-worker shutdown separate. Routine
operation remains automatic, with no new UI, CLI trigger, endpoint, setting or job.

The independent dependency batch is documented in its
[own outcome](express-rate-limit-8-7-2-outcome.md). Work stays on main, with
Unreleased notes and no version bump, release, deployment or restart.

Artifact maintenance reused the recent verified filesystem inventory and its
changed-directory/unreviewed-file exclusions. Fresh context/daemon and all-image/
all-container metadata match the intake: 425 image-tag rows, three containers,
no remaining Testcontainers, and unchanged Classifarr identity/image/start time
and healthy state. No files or images were removed. Current evidence, recovery
assets, shared resources and other projects remain preserved; private receipts
stay under .tmp.
