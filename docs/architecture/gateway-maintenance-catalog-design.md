# Gateway maintenance-catalog recovery — design and risk review

Date: 2026-10-16. Scope approved; implementation is staged. The user requested a
deeper research pass before coding. This document refines the approved safeguards,
not permission for live recovery, archive expiry, or production activation.
See the separate [outcome](gateway-maintenance-catalog-outcome.md).

## Decision and boundary

Extend optional gateway recovery verification to include the maintenance catalog,
alongside the matching inference snapshot. Preserve original state exactly, prove
the required files are available, and keep the restored database inert. Inference
continues during bounded capture; optional maintenance coordinates through its
existing exclusion lock. No administrator buttons or new backup platform.

Retain the approved 1 GiB managed-storage budget, two protected recovery copies,
persistent attempt/cooldown limits, and no automatic protection expiry. Normal
Classifarr installations do not activate this feature. Unraid, Plex and shared
Ollama remain outside local implementation/testing. New durable identities use
native PostgreSQL UUIDv7; historical identities are never regenerated.

This is a local recovery-verification mechanism, not a whole-application backup,
off-host disaster-recovery system, point-in-time recovery service, or proof that
old work can safely resume. These are different claims with different evidence.

## Observed code facts

Baseline: `fa6f3231ebbb52299e309408678ba79647edf2c6`.

- [archiveDump](../../server/src/ollamaGateway/archiveDump.mjs) exports only
  `ollama_gateway`. The missing catalog is `gateway_archive.job`,
  `gateway_archive.protection`, and `gateway_cleanup.operation`.
- [archive schema](../../database/ollama-gateway-archive/current.sql) has a
  job/protection foreign-key cycle. Live guards reject imported protection links
  and ready timestamps, and generate some timestamps themselves. Merely deferring
  foreign keys cannot make an exact data-only restore work.
- [cleanup schema](../../database/ollama-gateway-cleanup/current.sql) stores attempts,
  deletion counts, completion XID and later confirmation. Ledger/provider equality
  also needs logical validation; maintenance ledger IDs are not admission FKs.
- [coordinator](../../server/src/ollamaGateway/archiveCoordinator.mjs) admits its
  own exporting job before capture. That snapshot cannot contain the job's future
  publication or verification result.
- [revision](../../server/src/ollamaGateway/archiveRevision.mjs) and
  [schedule](../../server/src/ollamaGateway/archiveSchedule.mjs) track inference
  changes, not maintenance-only changes. Hashing all new backup bookkeeping into
  the scheduling trigger would create a self-triggering feedback loop.
- [source-role checks](../../server/src/ollamaGateway/archiveWorkerConfiguration.mjs)
  intentionally forbid archive-schema access. Capturing the catalog needs an
  explicit read-only contract, not an unnoticed privilege expansion.
- [verifier](../../server/src/ollamaGateway/archiveVerifier.mjs) already uses a
  restricted data-only restore in an isolated database. It reopens the checked
  dump by pathname, then checks it again; this is not an immutable-byte handoff
  against a writer that changes and restores the shared input between checks.
- [file helpers](../../server/src/ollamaGateway/archiveFiles.mjs),
  [receipts](../../server/src/ollamaGateway/archiveManagedFiles.mjs), and
  [protection markers](../../server/src/ollamaGateway/archiveProtectionFiles.mjs)
  already provide bounded reads, private paths, hashes and durable publication.
  File publication and SQL publication remain separate commit boundaries.

These are static code observations, not demonstrated production incidents or a
repository-wide security audit. Existing safeguards must remain in place.

## Methodologies selected from official sources

Sources below were discovered through MCP search and opened on 2026-10-16.
Older publications are identified as established methods, not October 2026 releases.
The application-specific controls and priorities are our engineering conclusions.

| Method | Why use it here | Cost / limitation |
| --- | --- | --- |
| Lightweight FMEA plus fault tree | Start from each failure and from the unacceptable outcome: lost recovery evidence or unintended replay | Requires maintenance as the implementation changes; no invented probability scores |
| Executable state model and invariant tests | Explore reordered, duplicated and interrupted operations | A model is not proof of implementation correctness |
| Real restore and deterministic fault injection | Test SQL permissions, bytes, process interruption and restart behavior | More CI time, temporary space and platform-specific evidence |
| Dependency-aware retention | Track which retained recovery sets need each artifact | More metadata; capacity can correctly block progress |
| Durable idempotency and reconciliation | Distinguish a repeat from new intent and resolve unknown outcomes | Bookkeeping must survive restart and must not reset budgets |

[NASA's active 2024 FMECA handbook](https://standards.nasa.gov/node/12367) treats
failure analysis as a living development artifact. Its
[fault-tree guidance](https://s3vi.ndc.nasa.gov/ssri-kb/topics/16/) complements
bottom-up failure analysis with a top-down view. Here we use qualitative severity,
detectability, refusal behavior and regression tests, not unsupported likelihoods.

[Amazon's 2021 ShardStore paper](https://www.amazon.science/publications/using-lightweight-formal-methods-to-validate-a-key-value-storage-node-in-amazon-s3)
describes executable reference models and separate checks for different properties.
Apply that approach with small ESM models and existing tests first. Do not add a
TLA+ toolchain or claim formal verification merely because state tests pass.

[Google SRE's data-integrity guidance](https://sre.google/sre-book/data-integrity/)
distinguishes redundancy from recoverability and recommends automated end-to-end
recovery tests. Apply this by measuring actual restore results and freshness,
not counting files or successful export commands.

## Failure analysis and required controls

| ID | Weakness and consequence | Required control / test |
| --- | --- | --- |
| C1 | Separately timed history and catalog snapshots describe different states | One exported PostgreSQL snapshot across participating readers; concurrent inference fixture must preserve an exact matching view |
| C2 | Successful SQL restore is missing referenced dumps, markers or receipts | Explicit status-aware artifact inventory; verify required bytes and relationships, not just row counts |
| C3 | Capture includes its own unfinished export; restore appears to finish or retry it | Preserve the original unfinished state; external verification receipt describes the capture without rewriting history or replaying the job |
| C4 | Maintenance changes are missed, or backup bookkeeping causes endless exports | Distinct, versioned maintenance change detection; test confirmation-only changes and quiescence after a backup's own transitions |
| C5 | Loading through live triggers rewrites clocks, identities or protection relationships | Trusted restore-only loading sequence in isolation; validate exact rows and final constraints/guards; no bypass granted to runtime roles |
| C6 | Source transaction IDs or old timestamps are treated as current authorization | Preserve them as historical values; never call live cleanup reconciliation against a restored catalog or derive expiry authority from them |
| C7 | Input changes after hashing but before native restore | Copy bounded input into private verifier scratch, hash the copied bytes, close the writer, and restore only that copy; reject mismatches |
| C8 | Crash between files, receipt publication and SQL acknowledgment creates ambiguity | Explicit durable stages, exclusive publication, file and directory sync; restart reconciles matching identities and never guesses success |
| C9 | Large nested manifests exhaust memory or disk despite row-count limits | Stream bounded catalog batches, enforce row and total-byte limits, reserve aggregate output plus scratch; refuse before displacing good copies |
| C10 | New reader or restore role gains live write/cleanup authority | Real restricted-login tests across all relevant schemas and routines; no owner membership, copied ACLs, source socket or provider credentials in verifier |
| C11 | Old schema, lost timestamp precision or numeric conversion changes restored facts | Versioned exact table/column contract; preserve PostgreSQL precision and big integers; reject unknown schema/receipt versions |
| C12 | Two copies fail together or matching hashes conceal malicious replacement | State the trusted-host boundary; hashes are integrity checks, not independent authenticity or off-host recovery |

The top-level failure tree is: an invalid set is accepted because snapshot, file,
schema or identity checks are incomplete; or a valid historical set is allowed to
perform present-day mutations; or every required copy shares the same loss event.
Each branch needs its own evidence. Passing one branch does not cover the others.

### Consistent database state is necessary, not sufficient

[PostgreSQL exported snapshots](https://www.postgresql.org/docs/18/functions-admin.html)
give participating transactions the same database view while the exporter remains
open. They do not snapshot a filesystem. Coordinate catalog capture with existing
maintenance exclusion, keep inference ownership separate, and bind required
artifacts by immutable identifiers, byte lengths and hashes.

Inventory must distinguish verified/protected artifacts, unfinished publication,
and legitimately retired jobs. A missing required file blocks recovery-set
verification. A retired job is not evidence that its old bytes must still exist.
An incomplete export remains incomplete; no missing marker is reconstructed from
an old SQL assertion. No fresh installation means no archive work is needed.

Do not recursively embed every earlier archive in every new bundle. Record bounded
dependencies and prove their availability. A snapshot whose dependencies later
disappear may still restore its SQL rows, but must not retain a current
complete-recovery claim. Any future expiry design must preserve the dependency
closure of every recovery set it promises to retain.

[Restic's retention model](https://restic.readthedocs.io/en/stable/060_forget.html?highlight=--unsafe-recover-no-free-space)
separates forgetting snapshots from pruning data no retained snapshot needs.
[pgBackRest's guide](https://pgbackrest.org/user-guide.html) requires completed
replacement backups before normal expiration. Adopt those principles, not their
commands or dependencies. Protected-file expiry remains out of this increment.

### Restore is not authorization to resume

[PostgreSQL transaction IDs](https://www.postgresql.org/docs/18/transaction-id.html)
come from a cluster-local counter. Consequently, a copied `completed_xid` cannot
serve as a new cluster's commit fence. Likewise, a cloned database may copy the
same ledger UUID: an identifier alone does not prove the original writer stopped.

Use UUIDv7 for new identities as requested. Its time ordering, defined in
[RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html), is not proof of commit,
authorization or elapsed recovery time. Preserve explicit original timestamps;
future expiry must handle clock anomalies and use confirmed completion, not ID age.

The restored database has no gateway/cleanup workers and no provider access.
Verification never reconciles source operations, clears pending state, marks
old operations confirmed, refunds attempts or enables inference. An external
verification receipt binds only the exact restored content and checks performed.
It cannot claim its own future receipt existed inside the captured snapshot.

[AWS's idempotent-retry guidance](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?did=ba_card&trk=ba_card)
uses stable request identity, intent validation and atomic mutation bookkeeping.
Our application: preserve UUID and consumed attempts across retries, reject the
same identity with changed intent, and reconcile uncertain publication before
admitting anything new. A new verification run ID must not create a new retry budget.

### Trust, durability and exact bytes

[pg_restore warns that dumps can execute source-controlled code](https://www.postgresql.org/docs/18/app-pgrestore.html).
Keep a trusted packaged schema and restricted data loading, inside the existing
network-isolated verifier. Do not execute archived DDL, copy global roles, grant
cleanup-owner membership or weaken live triggers to accommodate recovery.

Private scratch capture closes the shared-input pathname gap, but does not make
a container immune to a compromised host or kernel. Restoring exact data with
the correct schema is a separate check from availability of external evidence.
Recreate and test final guards in the isolated target; test forbidden writes with
the actual restricted login, not just administrator role switching.

[Linux fsync documentation](https://www.man7.org/linux/man-pages/man2/fsync.2.html)
distinguishes file durability from directory-entry durability. Preserve both
sync steps and no-overwrite publication. File presence is not a SQL commit.
Process-kill tests do not establish behavior under host power loss or every filesystem.

## Verification contract and resource policy

Report separate facts: bytes match, catalog rows restore exactly, relationships
validate, required files were verified at the recorded time, and runtime remains
disabled. No single ambiguous `healthy` or `verified` flag should imply all of them.
Legacy v3/v4 receipts keep their existing inference-only meaning.

[pg_verifybackup documentation](https://www.postgresql.org/docs/18/app-pgverifybackup.html)
explicitly says integrity verification does not replace test restores. That tool
checks physical base backups, not these custom-format logical dumps; use native
`pg_restore` plus application checks here rather than adding an inapplicable command.

Keep one maintenance capture at a time, the existing 120-second assessment bound,
bounded child-process/SQL waits, and non-waiting maintenance admission. Preserve
the existing three-attempt budget and durable cooldowns. A capture interrupted
without confirmed child exit remains unknown, not automatically retryable.
Cancellation waits for child completion; any consumed attempt remains consumed.
Identity/format/permission failures are permanent for that input. Lock contention
defers before admission. Ordinary transient failure may retry only within its
persisted limits. Status reads cause no network work.

Safety and progress are separate properties. With indefinite protection, a fixed
storage budget must eventually pause maintenance. Continuing inference during a
capture is not a promise of indefinite operation after the gateway's existing
resident-history limit is reached. Report that pressure; never weaken proof or
reset counters to avoid it.

Use streaming digests and an aggregate 256 MiB dump ceiling for the proposed
history-plus-catalog export, not 256 MiB per new sidecar. Catalog metadata and
private scratch copies need explicit reservations within existing worker limits;
fail closed if they do not fit. Do not materialize up to 10,000 nested job
manifests as one new JSON document or raise limits silently. Pin the schema and
encoding used for hashes, including UTC settings, field order and integer handling.
Enforce per-row size before materializing catalog JSON in the client, as well as
batch and total size. An after-fetch limit alone does not bound a single huge row.

Keep the existing initial/daily-if-changed/capacity-driven policy. The semantic
maintenance fingerprint must cover protection, confirmation, attempts and
retirement, while separating a capture's own expected bookkeeping from new work.
That rule needs an executable transition test before implementation integration;
excluding all archive jobs, or hashing all of them indiscriminately, is insufficient.
Do not change persisted policy hashes in a way that discards old retry accounting.

Expose bounded reason codes and a recovery-set reference, last successful capture
time, last restore-check time, covered revision and capacity-blocked state through
existing diagnostics. A daily schedule is not a guaranteed 24-hour recovery point:
failed/blocked runs make the last usable state older. Measure restore duration and
resource peaks before making recovery-time claims. No new admin controls.

## Acceptance tests and implementation sequence

1. Write the bounded state model and invariant tests first. Include maintenance-only
   changes, self-bookkeeping, delayed/duplicate receipts, cancellation and exhausted
   attempts. Check quiescence when no external state changes.
2. Add versioned, modular ESM capture/manifest/relationship validation. Use the same
   exported snapshot, fixed SQL identifiers and a specifically scoped catalog reader.
   Preserve the existing reader contract and native UUIDv7 conventions.
3. Extend isolated restore with private byte staging, trusted schema loading and
   exact row/relationship checks. Test missing required files, legitimate retired
   files, mismatched generations, microsecond timestamps, large integers and FK cycles.
   Use independent SQL assertions and hand-authored expected fixtures as well as
   canonical hashes, so a shared exporter/verifier bug cannot be the sole oracle.
   Alter each protected field in negative tests and require rejection.
4. Exercise real PostgreSQL privileges and competing workers. Inject failures
   after admission, snapshot export, dump sync, manifest sync, receipt publication
   and SQL acknowledgment. Observe the boundary before killing a process; verify
   retained state before retry. Never reset counters to advance a test.
5. Integrate scheduling only after the no-loop/no-missed-change tests pass. Exercise
   near-capacity, oversized and changed-schema cases; prove inference continues.
6. Run the existing immutable-image archive/cleanup rehearsals, affected quality
   gates and a no-cache local Compose rebuild. Record exact results separately.

Completion means a bounded, repeatable isolated restore proves the exact captured
catalog and matching history without losing clocks/attempts, confusing dependency
availability with SQL restoration, or issuing any provider/live recovery mutation.

## Final recommendation stack and deferred work

Use PostgreSQL 18 snapshots and native UUIDv7; small Node ESM modules; narrowly
scoped reader and maintenance roles; existing isolated Docker workers; streaming
SHA-256 integrity checks; an executable state model; real SQL and interruption
rehearsals. No new npm dependency, AI-based recovery decision, or backup suite.

Hash-only checks are inexpensive but insufficient. Automatic replay reduces
operator effort but lacks portable authorization and is rejected here. WAL/PITR
and an off-host immutable backup repository offer broader recovery coverage but
add storage, credentials and operations beyond this approved increment.

Next gate: finish maintenance-catalog verification. Before protection expiry,
prove dependency-preserving retirement and the confirmed minimum recovery window.
Before any restored-worker activation, design a separate authority/fencing
protocol; passing this verifier is explicitly not that authority.

## First implementation gate: model and private restore input

The first increment implements the executable scheduling specification and C7's
private-input handoff. It does **not** enable maintenance-catalog capture, change
the live scheduler, install tables, expand reader privileges or alter receipts.

The test-only [model](../../server/src/__tests__/fixtures/gatewayCatalogModel.mjs)
separates exact captured state, semantic maintenance generation and inference
retry identity. Generations are an abstraction, not an approved SQL migration or
a claim of a durable event log. Snapshot capture occurs after admission and takes
the current maintenance generation, not the initial assessment's older value.
The current exporting job stays unfinished inside that immutable snapshot.

Successful own-job publication and receipt acknowledgment do not create another
semantic generation. Independent protection, cleanup-attempt, confirmation and
retirement changes do. Mapping actual SQL mutations to that causal distinction
remains an integration requirement; arbitrary changes cannot label themselves
"internal" to bypass capture. In particular, rotation-induced dependency changes
must be proven before live integration. The model does not establish artifact
dependency closure or solve post-capture retirement.

Cancellation and failures consume the original three-attempt budget and retain
five-/30-minute cooldowns. Second copies count too. With unchanged inference
history, repeated catalog-only refreshes can exhaust that budget, even after
successful copies. This conservative limitation is intentional: changing catalog
hashes must not silently mint new attempts. No budget/policy reset is implemented.
The model applies the daily/hourly interval to new catalog-only changes, while
existing retry cooldowns remain authoritative. A restored model is disabled.

The tests include hand-authored expected transitions, 1,620 comparisons with the
existing production scheduler's inference-only projection, and 8,192 fixed-seed
event attempts. Invalid transitions must be assertion failures, not swallowed
runtime errors. This is bounded testing, not exhaustive model checking or formal
verification of the database worker. Fresh/disabled and uncertain states must
remain safe; separate real SQL, transport and crash tests are still necessary.

The production [input helper](../../server/src/ollamaGateway/archiveRestoreInput.mjs)
streams the shared dump into an exclusively created file below the verifier's
private workspace. It checks length, PGDMP header and SHA-256 while copying, using
64 KiB memory, then syncs, changes mode to 0400 and closes both handles before
returning a path. Native restore receives only that private path. Source symlinks,
hard links and public permissions remain forbidden by existing file checks.
The final shared-bundle check remains in place. Replacing the source path cannot
change the accepted private bytes; a compromised verifier UID/host is still outside
this isolation claim. File mode is defense in depth, not immutable storage.

Before copying, require free scratch for twice the dump bytes plus 64 MiB. This
admits the copy and a minimum restoration reserve; it does not predict database
expansion. The unchanged 1 GiB scratch mount, 1,536 MiB verifier memory, 256 MiB
dump limit and existing execution deadlines remain hard bounds. Failure to fit
refuses verification. The extra copy costs up to 256 MiB scratch and one streamed
read/write pass. The 1 GiB **managed archive** budget is separate and unchanged.
The PostgreSQL data directory moves to a sibling of private input within the
same ephemeral workspace. Cleanup still waits for PostgreSQL exit and removes
only that invocation's directory, including partially staged files.

Research rechecked through MCP on 2026-10-16 (America/New_York):

- [Amazon's executable-model approach](https://www.amazon.science/publications/using-lightweight-formal-methods-to-validate-a-key-value-storage-node-in-amazon-s3)
  supports using independent property tests alongside implementation tests.
- [AWS retry guidance](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?did=ba_card&trk=ba_card)
  supports stable intent identity rather than treating every observation as new work.
- [Node 24 file APIs](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html)
  document descriptor operations and warn that a file copy is not guaranteed atomic.
  Our conclusion is to publish a private path only after bounded copy validation,
  not to rely on copying alone as integrity proof. This is versioned API guidance,
  not a recommendation to downgrade the pinned Node 24.21.0 runtime.
- [PostgreSQL restore guidance](https://www.postgresql.org/docs/18/app-pgrestore.html)
  continues to require treating archive execution as untrusted. Private staging
  supplements, rather than replaces, the restricted role and isolated network.

The recommended stack is unchanged: modular ESM, PostgreSQL 18/native UUIDv7,
restricted roles and isolated Docker verification, with no new dependencies.
Compared with shared-path rechecks alone, private copying costs I/O and space but
ties native restore to the checked bytes. Compared with immediately enabling the
catalog scheduler, a test-only model delays functionality but prevents unproven
causal bookkeeping from changing live retry behavior.

## Second implementation gate: capture and isolated restoration

2026-10-17: implement a verification-only v5 capture seam, not a new administrator
command or live scheduler setting. Existing v3/v4 producers, roles and receipts
retain their meaning. The caller must already have admitted its exporting job;
capture cannot manufacture an attempt or complete that job. The optional source
must use a separately checked SELECT-only reader covering all ten fixed tables.
The legacy inference-only reader check is not relaxed.

Hold the existing non-waiting maintenance exclusion lock while exporting one
repeatable-read snapshot. Include the original unfinished export, protection
records and cleanup attempts/confirmation values. Use PostgreSQL canonical text
for digests, preserving integer and timestamp precision without JavaScript numeric
conversion. Bound rows before transmitting them, fetch small batches and enforce
the shared 256 MiB content/dump ceiling. Unknown table layouts fail closed.

Keep manifests within 64 KiB: store bounded table digests and a dependency
count/hash, not a recursively expanded artifact list. Derive that inventory again
from restored SQL. Require retained verified bundles and receipts, plus markers
for ready protections; retired and unfinished jobs retain their historical state
without requiring nonexistent future files. No publication-recovery helper runs
during this read-only inspection. The active exporting job must be the sole
pending job. Dependency verification is a point-in-time observation, not an expiry
authorization or promise that future rotation preserves the set.

Load only packaged schemas in the network-isolated verifier. Temporarily disable
only the named maintenance ingestion guards in that disposable database, defer
foreign keys, restore through a restricted login, then re-enable guards and remove
loading privileges. Check exact rows, cross-schema relationships and required
files independently. Keep original completion XIDs historical; never reconcile
or resume restored workers. Live roles receive no trigger-bypass privilege.

Official guidance re-opened through MCP on 2026-10-17:

- [PostgreSQL snapshot synchronization](https://www.postgresql.org/docs/18/functions-admin.html)
  gives participants the same database view only while the exporting transaction
  remains open; it does not snapshot files.
- [PostgreSQL restore warnings](https://www.postgresql.org/docs/18/app-pgrestore.html)
  support retaining the restricted role, trusted schema and isolated container.
- [PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html)
  warn about numeric precision when interchanging with other systems. Hashing
  database text and using native restore are our implementation choices.

Recommendation: fixed versioned contracts, streamed PostgreSQL text, native dump/
restore and existing isolated Docker workers. This provides stronger recovery
evidence without new dependencies; the costs are additional read I/O, bounded
scratch and refusal when dependencies or capacity are unavailable. Automatic
scheduling and dependency-preserving rotation remain a separate integration gate.
