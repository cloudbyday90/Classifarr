# Image-provider cancellation outcome

## Delivered behavior

The image provider is Classifarr's adapter to the separate image-embedding service
or a configured cloud provider. It converts posters to retrieval vectors; it does
not generate images or replace the companion service.

Semantic retrieval now forwards its signal through a separate runtime-options
argument. The extracted ESM admission queue removes cancelled waiting entries,
clears unused pacing timers, preserves FIFO/rate/concurrency behavior and retains
active capacity until the actual operation settles. Config lookup is checked before
and after awaiting; a cancelled caller never proceeds from it into image admission.

Existing cancellable retry/HTTP helpers receive the signal for local, Voyage,
Vertex and Cohere paths, including poster downloads. Late responses are rejected
and cancellation cannot silently become text-only retrieval. Ordinary optional
image failures retain their existing fallback behavior. Models, dimensions, vector
validation, weights, credentials, timeouts and response/download budgets remain.

Cancelled requests are neither provider errors nor successful recovery evidence.
A cancelled half-open breaker reservation is returned only within the same
generation; an old cancellation cannot alter a newer recovery cycle. No arbitrary
abort reason is logged. There is no new daemon, dependency, migration, privilege,
template setting, version bump or release.

## Verification

Final focused validation passed 12 suites / 281 tests, including deterministic
queue tests, all provider adapter paths, retry interruption, late-result refusal,
breaker generation isolation and real loopback HTTP disconnects. An initial
loopback test fixture omitted the JSON response content type; correcting the
fixture restored unchanged embedding validation without relaxing it.

The focused coverage run measured 95.49% statements/lines across the five changed
runtime modules; the extracted queue has 100% line and 92% branch coverage. A
5,000-entry synchronous-failure regression verifies non-recursive queue draining.
Provider deadlines remain retryable failures rather than caller cancellation.

Targeted disposable PostgreSQL integration passed 3 suites / 11 tests, covering
image retrieval, SQL cancellation and classification retrieval. Full frontend
coverage passed 412 suites / 5,835 tests. Lint, server/client type checks, ownership
review, dependency/ESM and policy repository gates passed. Documentation lint passed.

Full backend coverage passed 1,610 suites / 49,178 tests (one existing skip) in
696.53 seconds. The combined frontend/backend coverage ratchet passed without
lowering a baseline. The ownership gate retains 19 owned, 227 separately coordinated
and 490 unresolved paths; this change does not waive any unresolved writer debt.

Both GitHub MCP and the saved GitHub CLI login returned no open PRs for
`cloudbyday90/Classifarr`. No random PR was available; no PR was merged. Live
provider requests and persistent libraries were not changed by validation.

## Requested local rebuild

The user subsequently requested a no-cache Compose rebuild. Preflight confirmed
the current Compose environment settings match the running container. Updating
from its older image also applies two previously committed additive maintenance
state migrations; neither is introduced by this cancellation change.

Saved a local PostgreSQL custom-format snapshot (77,880,380 bytes) at
`/app/data/backups/pre-image-cancellation-20261001T2245.dump`; `pg_restore --list`
validated the archive listing, not a full restore rehearsal. The old image is
retained as `classifarr:rollback-59efef859783-image-cancellation`. Persistent bind
mounts, routing settings and unrelated containers will be preserved. Rebuild and
post-start verification are pending in this implementation commit; their outcome
will be recorded separately after execution.

## Recommendation and next component

Keep the layers together: removable queued work, signal-aware retries/HTTP,
post-await cancellation checks and truthful active-capacity accounting. The benefit
is less abandoned local work with unchanged successful evidence. The cost is
explicit signal plumbing and lifecycle tests, not a new service dependency.

Closing an HTTP connection does not prove that remote CPU/GPU inference stopped.
At the user's request, opened and verified
[companion service issue 43](https://github.com/cloudbyday90/classifarr-image-embedding-service/issues/43).
That is the next cross-project component: disconnect-aware queue and batch cleanup,
safe cooperative inference cancellation, and accurate capacity/lock accounting for
non-interruptible work. Source inspection found no explicit disconnect contract in
the service's embedding route; this is not a claim of a reproduced live-service bug.

Non-cancelled backlog limits and limiter replacement on configuration changes are
unchanged and remain distinct admission-policy work. Background embedding writes
without a caller signal are unchanged. See the separate
[design, official research and trade-offs](image-provider-cancellation-design.md).
