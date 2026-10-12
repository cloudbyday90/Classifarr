# Description corpus controlled-load profile

Date: October 11, 2026 (America/New_York). Scope: offline diagnostics on main;
no release or production query change.

## Decision and prerequisites

The retained incident proves a 15-second PostgreSQL statement timeout, not its
resource cause. Add a repeatable synthetic profile before selecting a SQL or
memory fix. Reuse the existing disposable PostgreSQL benchmark lifecycle, not
the description-generation benchmark: that benchmark can use saved providers.
The recovery/image skills require synthetic fixtures; do not add a live backup,
volume, connection string, credential or endpoint override to this runner.

No work runs on application startup, fresh installs or status reads. The CLI
accepts no arguments and requires a locally available PostgreSQL 18.6 image,
Docker and the pinned Node 24/npm 12 toolchain. It records the immutable local
database image ID, schema snapshot digest and exact corpus-query digest.

## Contract

- One disposable database, 1 GiB, two CPUs and 256 PIDs; three clients maximum
  (two readers and one observer). No provider requests or application connection.
  Testcontainers exposes an ephemeral loopback-only port for the host driver.
- Install five corpus tables and their primary/unique constraints from the fixed
  checked-in schema. Install only an explicit subset of relevant existing B-tree
  indexes, not new candidate indexes. No triggers, foreign keys or application
  startup; these omissions are reported, not called a production replay.
- Seed 6,500 synthetic identities in ten libraries and three history rows per
  identity. Compare sparse (20) and complete history-fallback distributions.
  Source-conflict exclusions are present; season mapping expansion is deferred.
- Analyze the fixture after seeding. Run three warmed repetitions of ordinary
  SELECT plus corpus preparation at concurrency one and two. Retain only counts,
  hashes, elapsed milliseconds, process memory snapshots and CPU deltas.
- Separately run ordinary EXPLAIN ANALYZE with BUFFERS/TIMING OFF and a
  SERIALIZE TEXT/TIMING ON arm. The latter includes extra instrumentation;
  differences are not an exact estimate of serialization or network cost.
- The observer samples only the owned backend PIDs every 25 ms. Allowlist wait
  categories; no SQL, parameters, names or exception bodies in the report.
  Samples are counts, not wait durations; active/no-wait does not prove CPU use.
- Read-only measurement transactions retain the runtime 15-second statement and
  two-second lock limits, plus an offline 30-second transaction limit. Bounded
  scenarios and no retry loop keep failures visible. A separate held-lock control
  must observe a Lock wait and SQLSTATE 55P03, then prove a healthy read afterward.
- No pool is used, so pool-acquisition latency is not measured. The host Node
  process memory is not application/container memory or retained heap after GC.
  Dropping references is not proof of reclamation; no forced GC or heap dump.
  Paired reads share one Node event loop: one read's synchronous preparation can
  delay the other's promise completion. Client elapsed time and process-wide CPU
  deltas must not be attributed solely to PostgreSQL or summed across readers.
- Any unexpected error, timeout, malformed result or cleanup failure fails the
  exercise, with a fixed safe CLI message. No partial report claims completion.
  Stop/cleanup uses the existing owned container lifecycle. Restart begins a new
  disposable fixture; it never resumes production work or resets recovery state.

Completion requires exact synthetic row/description counts, a shared result
fingerprint across ordinary-read arms, a successful lock control, closed peers,
removed fixture schema and removed container. No live ownership, approval,
memory admission, cooldown, checkpoint or query semantics change.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limit | Decision |
| --- | --- | --- | --- |
| Raise timeout or work memory | May mask an occasional failure | Unknown resource cause, greater shared-resource risk | Reject |
| Profile synthetic reads with controlled concurrency | Repeatable, no private data or providers | Not the historic distribution or workload | Implement first |
| Replay sanitized incident-shaped data and scheduler contention | More representative attribution | Needs a separately designed fixture and captured evidence | Next if baseline is insufficient |
| Change SQL or add indexes now | Could improve one observed plan | No reproduced bottleneck; changes write/storage costs | Defer |

Recommended stack: sanitized incident reference → isolated measured baseline →
representative workload reproduction → narrowly justified fix → regression and
image verification. No UI changes; existing accessible status remains unchanged.

## Official research

Discovered and opened through MCP on October 11, 2026. These are current living
documents, not claims about future October publications.

- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html): ANALYZE
  executes the statement; TIMING OFF reduces per-node clock overhead. SERIALIZE
  measures output conversion but never network transmission. Parent buffer
  totals include children, so do not sum them recursively.
- [PostgreSQL activity statistics](https://www.postgresql.org/docs/current/monitoring-stats.htm):
  state and wait events are independent and sampled asynchronously. Read only
  owned sessions, outside a long observer transaction.
- [Node process diagnostics](https://nodejs.org/api/process.html): RSS covers more
  than V8 heap; report heap/external/array-buffer values separately. The current
  documentation is for Node 26; this runner uses APIs already available in the
  pinned Node 24 runtime and tests there.
- [Testcontainers resource quotas](https://node.testcontainers.org/features/containers/):
  memory is expressed in GiB. The profiler supplies `memory: 1` and independently
  checks Docker's byte-valued limit, CPU quota, PID limit, image and loopback bind
  before measuring. The no-pull policy applies to PostgreSQL; the resource reaper
  can still be obtained by Testcontainers if it is not already available.

## Random open PR

Fresh enumeration found #556 and #558. A cryptographic random draw selected
[#558](https://github.com/cloudbyday90/Classifarr/pull/558), head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`, again. Trial its exact two-file patch
locally, without merging. It upgrades Node declarations 24.19.2 → 26.6.4 and
undici-types 7.24.6 → 8.9.0. Registry metadata has no new install scripts.
New declarations may describe unavailable runtime APIs; the existing Node-major
contract decides acceptance. Do not weaken it merely because typechecks pass.
The [DefinitelyTyped version policy](https://github.com/Definitelytyped/DefinitelyTyped)
aligns declaration major/minor versions with the represented library.
