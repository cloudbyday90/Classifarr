# Provider-aware classification deferral outcome

## Root cause and implementation

The previous recovery commit helped only after each item had exhausted its retry
budget. Multiple items still rediscovered the same unavailable AI provider. A
configured provider and an HTTP-success health endpoint did not prove usable
generation. Increasing retries would repeat that work, not resolve the cause.

Classification now checks a durable provider circuit immediately before AI work.
One structured transient failure opens it. Other affected items wait without
spending their item retry or automatic-recovery budgets. The first real failed
call still counts. A restart does not erase the outage or reset its cooldown.

The existing scheduler and synthetic generation-readiness check release up to
five trial calls after recovery. A real nonempty generation result restores
normal traffic and the ordinary 50-item pending-retry sweep. A renewed transient
failure reopens the circuit. Atomic trial counters, proof expiry and epoch checks
prevent over-admission and stale results from overwriting newer state.

Three small ESM modules separate dependency identity/deferral policy, circuit
persistence and admission. The existing recovery coordinator and transactional
retry service are reused. An additive migration and fresh-install schema snapshot
persist the state. No broker, new dependency, API contract or UI panel is added.

## Safety and limitations

- The gate is at the AI boundary, not the whole worker. Deterministic paths remain
  available; the behavior is independent of library names and movie/TV content.
- Deferral is an internally branded error. Caller-supplied codes cannot claim a
  free retry. Missing model identity and unknown/permanent errors retain existing
  finite handling instead of becoming an endless shared wait.
- Current configuration, provider, model and endpoint determine the opaque key.
  Changed providers do not inherit old circuits. The existing installation-wide
  probe cooldown remains shared, including after configuration changes.
- The 15–16 minute cooldown, scheduler cadence and 60-second trial window favor
  stability over fastest recovery. Calls admitted before an outage cannot be
  recalled. Successful availability checks do not establish semantic correctness.
  Work reaching AI after the trial window expires waits for another probe; the
  next end-to-end test must measure this under queue and metadata-preparation delays.
- Recovery locks canonical identity before history rows, matching pending-decision
  replacement. It rechecks pending state and due time under that lock; schedule
  comparisons stay in PostgreSQL to avoid host-timezone drift. Provider network
  calls remain outside transactions.
- Queries are parameterized; circuit state/logs contain no prompts, titles,
  library names, plaintext credentials or provider error bodies. Real cloud
  readiness probes can incur charges through existing accounting controls.
- No routing permissions, confirmation settings, confidence thresholds or learning
  behavior are weakened. Existing History explains waiting without an acknowledgement.

## Validation

- Focused backend regression: 22 suites / 480 tests passed.
- The three new provider-deferral modules have 100% measured statement, branch
  and function coverage in the focused coverage run.
- PostgreSQL integration: 4 suites / 57 tests passed, covering movie/TV jobs,
  restart, concurrent recovery claims, five-slot admission, normal backlog drain,
  failed/stale probes, configuration changes, rollback, persisted counters,
  rescheduling during a probe and pending-decision replacement lock order.
- The existing disposable provider-fault Compose test passed with a real HTTP
  503 and no media routing. Its isolated container/network were removed afterward;
  no normal-stack data was removed.
- Frontend coverage: 370 files / 5,171 tests passed; statements 85.62%, branches
  77.59%, functions 85.10%, lines 87.69%.
- Full backend coverage: 1,374 suites / 40,287 tests passed; statements/lines
  90.34%, branches 83.68%, functions 92.48%. The combined coverage ratchet passed
  without changing its baseline. Outdated provider-call assertions found in the
  first run were corrected before this complete green rerun.
- Lint, type checks, copyright/dependency preflight, ESM import/mock checks,
  migration naming, documentation lint and authoritative schema dump/comparison
  passed. The staged secret scan found no leaks.
- Local Compose was healthy with zero restarts and no OOM after migration. The
  production-browser History recovery test passed. Read-only deployed checks
  confirmed the schema and deferral policy, UI HTTP 200, and anonymous History/retry
  HTTP 401. They made no real provider calls, application-data writes or media routes.
  There were no currently eligible recovery rows; no speculative backfill was run.
- The separate production-naming gate retains 43 pre-existing findings against its
  zero baseline. Product-language, delivery-term and runtime-maintenance checks
  passed. No unrelated naming changes or baseline relaxation were made.

The previous commit's six GitHub workflows passed. The GitHub open-PR collection
was checked twice on September 20, 2026 and was empty. No random open PR was
available to implement; none was merged. No release, tag or version bump is included.

## Recommendation and next item

Keep PostgreSQL, the existing queue/scheduler and the focused ESM services. This
reduces repeated provider calls and manual retries without another operational
dependency. The tradeoff is a conservative recovery delay and additional
concurrency testing. The separate [design](provider-aware-classification-deferral-design.md)
records official research, alternatives, pros/cons and the recommendation stack.

Next: extend the existing disposable provider-fault Compose test from **failure
persistence to automatic recovery and completion**. Make its synthetic provider
recover, restart the worker, and verify both movie and TV jobs finish without
manual retry, duplicate queue work or unauthorized routes. Keep real providers,
media and credentials out of fault injection. This closes the transport-to-worker
recovery gap before returning to library-content accuracy measurements; it does
not require another UI, acknowledgement flow or sampling framework.
