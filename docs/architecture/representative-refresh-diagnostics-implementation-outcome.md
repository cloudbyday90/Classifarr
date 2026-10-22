# Representative refresh diagnostics implementation outcome

## Implemented scope

Implemented the approved
[diagnostic design](representative-refresh-failure-diagnostics-design.md) on main
on 22 October 2026. Small ESM observation and projection modules retain fixed
stages/categories, capped durations, allowlisted SQLSTATE and a per-attempt
incident reference through worker, scheduler envelope and persisted scheduler log.
Raw causes, messages, response bodies, SQL, endpoints, descriptions and vectors
are not included. No schema, endpoint, UI or dependency contract changes.

Query observations preserve error identity. Acquisition/commit failures are
distinguished from unfinished transaction callbacks. In particular, warm consumer
callbacks cannot impersonate PostgreSQL by supplying a SQLSTATE-looking property.
The existing description repository's trusted observation supplies state-read
database attribution. A separately retained deadline signal identifies task
expiry even when fit/admission replace the thrown error; a private per-run origin
retains the inner stage. Cancellation and resource deferral discard observations
without adding failure debt or leaking a stale stage into a later reused error.

The retry module, process-local eligibility, memory admission, provider deadlines,
configuration/revision checks, verification/publication order and no-overlap
rules remain unchanged. Initial state reads still precede retry eligibility; this
change does not silently add backoff around them or persist cooldowns on restart.

## Verification record

Using pinned Node 24.21.0/npm 12.2.0:

- Affected representative, scheduler, readiness/admission, provider and ownership
  regressions: 71 suites / 775 tests passed. The final diagnostic suite then passed
  31 tests after adding a cancellation/error-reuse regression.
- Real HTTP regressions exercise HTTP 503, malformed JSON and cancellation of a
  pending loopback response; no real provider is contacted or inference generated.
- Isolated PostgreSQL attribution plus scheduler lifecycle: 3 suites / 17 tests
  passed. Real statement timeout and explicit self-cancellation both produce
  57014 and persist database_query_cancelled, not an assumed statement-timeout
  cause. Pooled connections remain usable after rollback.
- Server test/security lint, typecheck and normal/production knip passed.
- Copyright, npm CLI flags, static imports, whitespace and Markdown checks passed
  before freezing the source; no coverage-baseline update was performed.

The source commit initially recorded image qualification as pending; the
subsequent documentation-only commit records the completed rehearsal below.
The historical
[incident investigation](representative-refresh-failure-diagnostics-outcome.md)
remains distinct: tests cannot reconstruct its discarded original cause.

The new regression suite initially failed because the implementation modules did
not exist. Subsequent test-fixture corrections retained existing behavior: state
reads precede eligibility, each attempt has its own timeout signal, and observer
fixtures implement the existing stop contract. No runtime safeguard was relaxed.

The ownership gate correctly refused the changed repository source digest.
Reviewed the complete three-line instrumentation diff: query text/parameters,
read-only isolation, deadlines, budgets and callback lifetime are unchanged.
All inventory entries except this source digest matched the existing review;
its analysis digest remains
93d6e3fa8502e42affd4fa42cf775c3dfd9c62e7d96ce044398290ea165c0c08,
candidate/gap counts remain 151/348, and comparison_cache_readiness classification
is unchanged. Updated only that reviewed source digest, not the scanner,
classification, parser, baseline revision or any other entry. The gate then passed.

## Frozen no-cache image evaluation

Passed at 2026-10-22T23:50:06.013Z (19:50 America/New_York). The runner built
one production candidate with --no-cache from clean committed source
e1d50f7ddde34f080648cb488c5e3813c588be5b and kept that source unchanged throughout.
The following documentation-only commit is not substituted for that tested source.

Candidate local image ID:
sha256:79bedce7c98e1edb39f9bef3319bc522457b390c45ef637ebb6dc120ef8e989d.
This is local image identity, not a published registry manifest or candidate
attestation. The pinned published baseline's digest/source/signer verification
remained enabled. The approved invocation-only omission of an invalid inherited
GITHUB_TOKEN used the existing stored CLI login; no login, persistent environment
or provenance policy was changed. The earlier local receipt was preserved in a
new ignored backup directory before this run.

The same-image soak passed a 30-minute synthetic workload plus settled idle
(1,926,198 ms total). It completed 1,600/1,600 unique items, the 20/20 pressure
cohort and 8/8 provider-recovery cohort. Backlog: 1,945 completed, zero pending,
failed or routing tasks. Sampled container peak was 471,658,496 bytes (449.81 MiB),
PID peak 59, CPU-core P95 0.8824 and maximum sampled event-loop P99 80.741 ms.
Cgroup OOM-kill counters remained zero. These are local sampled observations,
not production capacity, an instantaneous peak or a latency guarantee.

| Saved deployment profile | Named gates | Fresh backlog | Upgraded backlog | Cleanup |
| --- | --- | --- | --- | --- |
| Standard | 12/12 passed | 600 completed | 600 completed | Passed |
| Unraid-style | 12/12 passed | 600 completed | 600 completed | Passed |
| Custom UID/GID | 12/12 passed | 600 completed | 600 completed | Passed |

All six backlog cases preserved original task IDs, committed ingestion and
inventory, reclaimed exactly five interrupted tasks, and had zero duplicate
completions, early reclaims or routing tasks. Original 600,000-ms visibility
remained unchanged; post-restart observations lasted 588,086–590,092 ms because
part of each lease elapsed before restart. Sibling progress preceded original
lease expiry. No counters or timestamps were reset to accelerate these checks.
The existing synthetic fixture's deliberate SQL delay/audit triggers establish
the crash boundary; they are not production workload measurements.

Each profile verified 2 CPU / 2 GiB / 128 PID enforcement, connection pressure
(max_connections 32; refusal 53300; health and fresh-connection recovery), actual
container replacement, scheduler progress, interrupted restore refusal, rollback,
explicit verified retry, and movie/TV handoff. PostgreSQL version was 180006;
baseline migrations 222, fresh/upgraded candidate 330. No schema change belongs
to this diagnostic implementation.

Independently rechecked all four exact project labels: no containers, volumes or
networks remain; the exact owned random candidate tag is absent. Only disposable
synthetic data was removed and can be regenerated by the runner; no global prune
or direct image-ID removal command was issued. Docker also removed the
unreferenced candidate image when its owned tag was removed: an optional
post-cleanup image inspection returned no such image. Runtime identity/revision
checks were captured before cleanup; no retained candidate binary or separate
architecture-inspection evidence is claimed. The original local service remains
running and healthy. No live application replacement, real Unraid/shared Ollama,
VM operation, release, registry publication or PR merge occurred.

Receipt: .tmp/release-rehearsal/receipt.json (ignored, regenerated evidence).
Local receipt-byte SHA256:
dc235ec5b0f1f4505b58968eacaa60783d42774117cfeb77c19eb33a3a53c178.
This fingerprint is not a signature. The receipt was rechecked against the exact
expected source/image, disabled cache, all named gates and budget validators.

## Open PR and recommendation stack

The current random selection returned the only open PR, #568, already adopted
locally. Its exact pin and integrity remain unchanged; see the separate
[ESLint outcome](server-eslint-10-13-outcome.md). No merge or fabricated update.

During the frozen run, additional official research found that
[Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1), published 21 October,
is a security release with high-severity TLS, DNS and Brotli fixes. This URL was
discovered and opened through MCP on 22 October, including the English release
link from the official archive. This is upstream release evidence, not an
exploitability assessment of this application or a cause for the old incident.
The approved candidate and local tests still use Node 24.21.0; no toolchain
upgrade occurred during qualification. A passed rehearsal is not proof that
this runtime is security-current, and is not deployment approval.

Recommend a bounded Node 24.22.1 security/toolchain review before any deployment:
benefit is upstream fixes; cost is requalifying exact pins, native/platform
compatibility, certificates and image evidence. Keep the reviewed npm lifecycle
policy and validate signed release identities; do not blindly replace the global
toolchain or treat dependency age alone as proof of a reachable vulnerability.

1. Prioritize that separate Node security/toolchain batch while retaining bounded
   diagnostics and all existing recovery safeguards.
2. Use the next naturally occurring failure's stage/category/reference to select
   a targeted investigation; unknown remains unknown.
3. Consider retry/deadline/provider changes only after that evidence establishes
   a cause. No live replay, VM recovery, shared-provider request, release or
   production deployment is authorized by this observability implementation.

Full frontend tests, coverage ratchets, remote CI and native ARM image checks are
not claimed. No client code changes are needed. The complete tooling preflight is
not run because its gateway group includes unrelated native Hyper-V checks;
the relevant backend, ownership and static quality gates are run explicitly.
