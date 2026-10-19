# Gateway row-mode comparison design

## Approved scope

Approved after the grill-me checkpoint on 18 October 2026: compare the current
object-row catalog reader with array rows, keeping the batch fixed at 16. Ship a
runtime optimization only for a repeatable useful gain with equivalent safety.
A negative finding is a valid outcome, not permission to expand the experiment.
Keep work on main, with separate outcome documentation and no release.

Run from a clean committed checkout matching the inspected image revision:

```text
node scripts/run-gateway-online-archive-rehearsal.mjs <sha256:image> <40-character-revision> --row-mode-profile
```

No database, provider, mount, retry or duration override is accepted.

The [restore study](gateway-restore-memory-outcome.md) attributed 82.10% of
sampled allocation estimates to PostgreSQL transport. That is coarse allocation
churn attribution, not retained-memory ownership. The measured v7 restore already
has just one full frozen-catalog fingerprint pass. Its later admission assertion,
seven-table archive hash and external-file checks are different proofs.

## Official research and alternatives

Official sources discovered through MCP search/navigation and read on 18 October
2026:

- [node-postgres queries](https://node-postgres.com/features/queries) documents
  array results and per-query parsers. Array mode avoids keyed result mapping;
  it does not promise to avoid field decoding or improve a workload.
- The installed pg 8.23.1 / pg-protocol 1.16.1 release's
  [upstream parser](https://github.com/brianc/node-postgres/blob/0980cefebe0ae461da8883703be049fe13ca96cf/packages/pg-protocol/src/parser.ts)
  decodes DataRow fields before the type parser and explicitly rejects its raw
  binary-parser mode. A text parser returning a Buffer adds a copy, not a
  zero-copy transport. This is source evidence, not a claim about every driver.
- PostgreSQL 18 [DECLARE](https://www.postgresql.org/docs/18/sql-declare.html)
  explains transaction-scoped cursors and binary-format selection. Keep the
  existing text protocol, transaction and cursor closure; no custom binary path.
- Node 24.21 [hash updates](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html)
  accept strings/bytes but require equivalent byte representations. Do not
  normalize Unicode, change newline framing or substitute reduced row objects.

| Option | Pro | Con / decision |
| --- | --- | --- |
| Current object rows | Established safety path | Retains mapping overhead; reference |
| Array rows at batch 16 | Supported, small isolated comparison | Text decoding remains; selected experimental candidate |
| Smaller batches | May lower transient residency | More queries; separate future experiment, not combined here |
| Buffer parser / binary rewrite | Raw transport might avoid strings in a different stack | Parser trick adds copies; a real protocol rewrite needs a larger audit; excluded |
| Remove verification or cache trust | Less work | Different phases/files must be checked independently; excluded |

## Experiment and immutable subjects

Reuse the isolated extended soak setup: fresh database, one real prerequisite
archive/restore, 3,000 varied failed-history rows and one real v7/catalog-v3 dump.
The prerequisite consumes shared attempt 1 and the catalog consumes attempt 2.
No new inference runs, attempt is refunded, catalog receipt is accepted or source
history changed. Compare the complete source fingerprint before/after.

Use a separate network-none, read-only-root, nonroot measurement container with
1536 MiB/no swap, one CPU, 64 PIDs and read-only fixture/artifact/socket mounts.
Its only SQL login is the disposable SELECT-only `soak_reader`. This is a
read-only source comparison, not an end-to-end candidate restore benchmark.
No provider, normal application data, Docker socket, ports or credentials are
exposed. Unraid, Plex and shared Ollama remain untouched.

Require a clean committed checkout matching the image revision. Hash every
copied fixture and bind its bytes to the corresponding committed source (allowing
only checkout CRLF/LF differences). Also bind the packaged row-reader/content
sources. Verify copied hashes in the worker before importing the comparison,
then recheck host sources afterward. Pass the expected manifest digest through
the inspected container command and compare raw manifest bytes before parsing or
importing any copied executable. Record the manifest digest and revision;
these are local identity checks, not signatures or registry provenance.

The array reader is a fixture-only copy. A deterministic parity check permits
only fixed import rebasing, array FETCH configuration/field validation and
positional field access. The common content accumulator is likewise checked
against production, allowing only visitor injection. No alternate reader or
runtime configuration is installed into application source.

Natural and allocation lanes use fresh processes, each with one warm-up followed
by eight fixed runs: object/array/array/object, repeated twice. Each lane holds one
UTC/ISO repeatable-read read-only view and compares exact table counts, max IDs,
full canonical hashes and byte budgets. Warm-ups are explicitly unmeasured.
Report per-run elapsed/query/process CPU, fetched rows/body bytes, memory samples
and GC. Backend CPU ticks are unavailable in the separate private PID namespace;
do not read a coincidentally numbered local process as the database backend.
Sampling changes behavior; allocation
results are diagnostic and never treated as natural capacity evidence.

Use the existing 512 KiB collected-allocation sampler in the separate lane. No
heap dump, forced GC, listener or raw profile/stack is permitted. Missing optional
cgroup/I/O observations remain unavailable, not zero. Endpoint and sampled peaks
do not prove all transient peaks were observed.

## Safety and acceptance

Keep four-second SQL, five-second client and two-second lock limits. Each scan
has a 120-second abort, each lane a fixed ten-minute wall-clock close, with no
retry or deadline overrides. Failure/cancellation closes the private client and
cursor; partial results cannot count as successful comparisons. Host cleanup is
exact-name/ownership-label checked, including failure paths.

Preserve schema checks, SQL-before-transfer 128 KiB row limits, table counts,
256 MiB cumulative charging, selected/excluded dependency validation, full-row
ordered text plus newline hashes, selection freezing and cancellation. Array
results must have exact column order/types and tuple shape. Native probes cover
read-only authority, budget refusal, pre-abort, consumer error and cancellation
with cursor closure; synthetic boundary tests cover malformed arrays and source
drift. The existing full native safety rehearsal remains mandatory.

Before seeing results, define a conservative promotion screen: at least 10%
lower total sampled allocation estimates in every mirrored object/array pair,
with natural median elapsed time no more than 5% slower. This is a screening
rule, not statistical significance or sufficient rollout proof. A passing screen
still requires production integration, real boundary tests, symmetric end-to-end
restore comparison and all affected gates. A failing screen keeps runtime
unchanged; do not tune the threshold after measuring or add extra trials until
it passes.

## Verification and final recommendation stack

Add tests for source-parity mutations, exact bindings, mode/sequence/result
validation, tuple/field refusal, size/count/cancellation/consumer failure and
predeclared promotion rules. Run gateway contracts, affected backend code-health
contracts, lint/types/ESM/ownership/policy/docs/secret gates. Build clean source
with no cache, run both bounded lanes and the unchanged archive/catalog/retention
native rehearsal. Keep heavy checks out of measurement windows.

Stack: bound source identity → same-view exact equivalence → counterbalanced
natural runs → separate allocation sampling → conservative decision → native
safety regression → private backup/protected local Compose refresh. Record
findings and skips separately, commit/push scoped changes, and report remote CI
against the actual pushed head. No new database/table/identity or admin control
is needed; existing native UUIDv7 checks remain unchanged.
