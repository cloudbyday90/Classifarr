# Representative snapshot lifetime

Date: 2026-10-06. Follows the [shared-catalog findings](comparison-catalog-study-outcome.md).

## Contract and scope

End the representative refresh's first snapshot scope before reading its fresh
verification snapshot. A small ESM candidate-preparation service returns only the
model, source key, summary, reuse flag and prepared observer/recovery batches.
Keep both full reads and all content, provider, configuration, revision, coverage,
corruption, cancellation and publication checks. Do not mutate the input to free it.

The recovery batch currently retains its input through `commit(fresh = snapshot)`.
Require an explicit fresh snapshot and construct its commit closure outside the
preparation scope. All production calls already supply fresh input; update internal
tests and reject missing input. Separate shadow scoring from its commit scope too,
so the scoring closure cannot keep the context's snapshot alive. Retain only staged
hashes/groups/results needed for later validation; no new persisted data or I/O.

Preserve single-flight execution, the 120-second representative deadline, five-minute
revalidation, bounded backoff, admission budgets, advisory locks and cache limits.
Empty/disabled/busy states do no extra work. Cancellation or source drift must never
publish prepared data; known malformed evidence still uses sanitized diagnostics.
Unknown optional observer failures remain non-fatal as before. Restart discards
ephemeral preparations and runs ordinary validation, with no new durable retry state.
Optional work never holds import/metadata recovery open. No migration or UI change.

Before the next image experiment, retain numeric phase peaks in failed-run traces:
allowlisted phase names/fields only, bounded phase count and line/input sizes. Keep
the existing completion assertion, 25-minute deadline, natural GC and synthetic
single-catalog workload unchanged. No runtime inspector or forced-GC setting.

## Verification

- Regression tests retain atomic publication, cache hits, source/provider changes,
  pending observations, recovery geometry, cancellation and shutdown behavior.
- An isolated child-process lifetime test may force GC solely to test reachability
  at the second-read boundary, including real staged callbacks. This does not measure
  natural reclamation or production RSS. Include a deliberately retained reference
  control and fail if the test cannot prove collection; no skipped test.
- Re-run the same 5776-item catalog profile on a no-cache immutable image. Compare
  checkpoints available in both runs; do not compare new sampled peaks to old
  checkpoint maxima as if they were the same measurement. Preserve failures.
- Rebuild/recreate local testing Compose, observe health and run isolated schema
  dump/check. Never touch the separate Unraid database.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shorter snapshot and callback scopes | Removes unnecessary simultaneous reachability without dropping checks | GC timing remains unspecified; implement and measure |
| Fingerprint-only verification | Could avoid decoding another complete snapshot | New consistency/corruption contract; defer |
| Higher limits, forced GC or less cache eviction | Could reduce visible refusals | Changes safeguards or masks allocation cost; reject for this round |

First prove reachability and behavioral equivalence. Then evaluate the unchanged
shared-catalog scenario. Only measured remaining costs should determine another fix.

## Official research and PR trial

Discovered and retrieved with web tools on October 6, 2026:

- [V8 weak references](https://v8.dev/features/weak-references): closure environments
  can keep otherwise unexpected objects reachable; collection timing is unspecified.
  Weak references are diagnostic here, never correctness or cleanup mechanisms.
- [Node 24 memory accounting](https://nodejs.org/docs/latest-v24.x/api/process.html):
  RSS is process-wide, other worker metrics are thread-local, and external memory
  includes ArrayBuffers. Preserve those distinctions in results.
- [Node heap snapshot guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  snapshots pause the main thread and can double heap use. Do not capture one on
  the user's live installation as part of this change.
- [DefinitelyTyped version policy](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md):
  declarations target the corresponding library version.

Fresh open PR enumeration again contained #555 and #556. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Apply the exact two-file diff locally
and run runtime-alignment checks before any install. Revert if Node 26 types still
conflict with pinned Node 24. No merge, branch, version bump or release.
