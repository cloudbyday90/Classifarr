# Automatic classification recovery outcome

## Implemented behavior

The previous commit restored manual recovery. This change adds automatic recovery
for exhausted, unrouted classifications with a known transient failure and a
canonical item identity. It adds no new acknowledgement or settings screen.

- The scheduler checks eligible work after the normal retry sweep, including when
  that sweep has no remaining pending jobs.
- Structured network timeouts, connection failures, rate limits and selected
  server errors can qualify. Error wording alone cannot qualify a job. Legacy,
  unknown, missing-model, authentication and cancellation failures stay manual.
- After a 15-minute job cooldown, a persisted, jittered probe claim allows one
  generation check per installation per 15–16 minutes. Scheduler timing may add
  up to another five minutes. Successful proof is valid for 60 seconds.
- At most five jobs resume per pass. Each retry chain gets one recovery cycle,
  capped at three retries. Dedicated database columns carry the consumed budget
  through replacement queue/history records; restarts and forged metadata do not
  renew it. Explicit manual retry can start a new cycle.
- Configuration drift, a newer decision, duplicate pending work, invalid proof,
  or a spent budget prevents enqueueing. Queue insertion, the old history state,
  budget consumption and the existing retry outcome record commit together.
- Ollama generation probes now reject HTTP-success responses that are incomplete,
  empty or contain an error, while accepting completed generation in the separate
  thinking channel. This checks availability, not answer quality. Cloud checks use the existing budget/accounting path
  with a synthetic prompt and 256-token output cap; they can incur charges.

These services only enqueue normal classification. They do not learn from failures,
change confidence, select libraries or bypass current AI/routing safeguards.
The implementation is library-agnostic and covers both existing movie and TV flows.

## Validation

- Focused backend regression: 17 suites / 374 tests passed.
- Final Ollama regression: 63 tests passed, including thinking-only generation,
  malformed output and non-retention of probe text.
- PostgreSQL integration: 3 suites / 45 tests passed. Covered movie/TV recovery,
  two workers, restart/cooldown, fresh-install first claim, rollback, cancellation,
  configuration drift, newer completed decisions, oversized historical budgets,
  forged metadata, missing queue provenance and manual fallback.
- Full client coverage: 370 files / 5,171 tests passed; statements 85.62%, branches
  77.59%, functions 85.10%, lines 87.69%.
- Full backend coverage: 1,371 suites / 40,179 tests passed; statements/lines
  90.32%, branches 83.65%, functions 92.42%. The four new recovery modules have
  100% measured statement, branch and function coverage. The combined client/server
  coverage ratchet passed without changing its baseline.
- Lint, type checks, copyright/dependency preflight, ESM checks, migration naming,
  documentation lint and the local build passed.
- Authoritative schema dump and comparison passed; the migration is additive and the fresh-install
  snapshot includes it. Probe initialization also works when no singleton row was seeded.
- Local Compose is healthy with zero restarts and no OOM. The production-browser
  History recovery test passed. Read-only deployed checks verified the schema,
  eligibility and authenticated boundaries (anonymous History/retry return 401;
  the UI returns 200). They performed no application-data writes, real provider
  calls or media routes. Synthetic provider responses were used for recovery tests.
- The local database currently has zero automatically eligible failures. Older
  failures without structured provenance remain manual; no speculative backfill
  or mass retry was performed.
- The separate production-naming gate still reports 43 pre-existing references
  against its zero baseline. No baseline relaxation or unrelated rename was made.

The previous commit's six GitHub workflows passed. The open-PR collection was
checked twice through the GitHub connector and was empty; no PR could be randomly
selected, and none was merged. No release, tag, version bump or dependency change
is part of this work. Private logs and test artifacts remain ignored.

## Recommendation and next item

Use the existing PostgreSQL queue plus the focused ESM recovery policy, repository,
readiness adapter and orchestrator. This reduces operator intervention without
adding another queue/workflow product. Costs are a small generation probe while
eligible work exists, conservative exclusions and a bounded recovery delay.
The [design document](automatic-classification-recovery-design.md) records the
official research, alternatives, pros/cons and recommendation stack.

Next: **make deferral dependency-aware before item retries are exhausted**. Reuse
the verified readiness boundary to pause jobs affected by the same provider outage,
without spending each item's retry budget on a dependency known to be down. Persist
the provider cooldown, admit a small recovery batch, and retain per-item failure
limits for genuine content/metadata problems. This should reduce wasted inference
calls and repeated failures, rather than add more review UI or sampling studies.

Implemented in [provider-aware classification deferral](provider-aware-classification-deferral-outcome.md).
That follow-up moves verified recovery before ordinary retry selection and restores
normal pending-job throughput after real generation succeeds.
