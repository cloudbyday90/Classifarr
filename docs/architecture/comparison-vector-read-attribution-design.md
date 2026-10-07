# Cached-vector read attribution

Reviewed 2026-10-07. Follow-up to the
[phase allocation outcome](comparison-phase-allocation-outcome.md). This round
measures the unexplained gap between full warm reads and isolated decoding;
it does not select another production memory optimization in advance.

## Contract

Keep every SQL predicate, read-only snapshot, hash/representation check, vector
validation, batch limit, cancellation point, independent freshness read and
publication fence unchanged. Separate the existing decoder into small ESM parsing
and assembly functions, retaining native JSON.parse and the existing validator.

Emit numeric batch summaries through a namespaced Node diagnostics channel only
when subscribed: successful read/decode batch counts, rows, components and encoded
character counts. Never publish vectors, hashes, SQL, identities or error text.
No subscriber means no metadata traversal or message allocation. This channel
is an in-process diagnostic seam, not a remote API or security boundary.

The isolated allocation study subscribes only within an existing bounded sampling
window and removes its listener on success, work failure, inspector failure and
timeout. Its handler catches/latches invalid evidence instead of throwing an
uncaught exception. Aggregate at most 8,192 events per window into fixed numeric
records; distinguish matching scheduler context from overlapping work. Preserve
the existing 128-window, 360-second/window, 25-minute study and 8 MiB output bounds.
Allocation receipt version 2 requires counters on successful post-drain warm
reads. No new database write, retry, provider call, inspector port or forced GC.
Interrupted runs cannot produce successful evidence and clean up owned resources.

Split fixed allocation labels into parsing, validation, Map assembly, cache-row
handling, PostgreSQL client/protocol and diagnostic overhead. Library/built-in
categories remain attribution, not proof of ownership or retained size. Match
counts to actual scheduled warm success before interpreting repeated decode cost.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Small parsing seam plus subscriber-gated numeric counters | Measures actual code and cardinality, without retaining payloads | Minor refactor and opt-in observation overhead; recommended |
| Monkey-patch JSON.parse or the database client globally | Less source wiring | Changes unrelated behavior and obscures attribution; reject |
| Assume the isolated microbenchmark identifies the production culprit | Faster optimization | Existing results disagree; reject |
| Retain decoded vectors or skip freshness/validation | Fewer repeated operations | More retained memory or weaker integrity; reject |

First obtain full-workload component and cardinality evidence. Then choose one
semantics-preserving optimization only if supported. Re-run complete natural
cycles; keep community optimization and dependency patch batches separate.

## Official research

URLs discovered through search and opened on 2026-10-07:

- [Node 24 diagnostics channels](https://nodejs.org/download/release/v24.18.0/docs/api/diagnostics_channel.html): use subscriber checks to avoid unnecessary preparation; publication is synchronous and subscriber exceptions become uncaught exceptions. Validate against pinned Node 24.21.0.
- [node-postgres type handling](https://node-postgres.com/features/types): explicit text casts deliver strings rather than automatic JSON decoding. Our embedding::text query therefore leaves parsing to the application.
- [V8 element kinds](https://v8.dev/blog/elements-kinds): array representations influence optimized execution. This is a reason to measure the real workload, not proof of a particular allocation cause in our pinned runtime.

No UI changes or new accessibility claim. Keep sanitized summaries only; any raw
heap profile remains in memory until reduction and disconnect.

## Random PR trial and verification

Fresh enumeration found #555 and #556; random selection chose server
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial its exact manifest/lockfile change
from Node declarations 24.19.1 to 26.6.4 (undici-types 7.24.6 to 8.9.0). The baseline
runtime-major gate passes 8/8. Reject/revert before installation if the candidate
violates the pinned Node 24 runtime; do not merge or bypass the gate.

Prove default-off behavior, sanitized counters, context separation, overflow,
malformed evidence, listener cleanup and identical valid/invalid decoding.
Then run focused/full tests, lint/type checks, ownership review, no-cache image
build, isolated schema dump/check and sampled/natural catalog cycles. Back up
and evaluate only the local test Compose deployment; Unraid remains untouched.
Document measured outcomes separately, including any incomplete backfill state.
