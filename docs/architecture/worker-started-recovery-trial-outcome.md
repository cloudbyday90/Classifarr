# Worker-started provider recovery trial outcome

Date: 2026-09-22. Implements the
[design and official research](worker-started-recovery-trial-design.md).
No release, version bump, schema change or routing-policy change.

## Delivered

The half-open provider circuit now starts its 60-second admission window on the
first worker claim. Queue delay no longer expires an unused trial. Later claims
do not extend it, and the five-slot shared limit remains atomic. An expired
active trial still returns the existing branded deferral; the normal persistence
and recovery path retains the item and retries it automatically when due.

The regression test failed against the previous enqueue-time deadline, then
passed with the worker-started deadline. Movie and TV tests also persist the
deferred replacement, rebind lineage, retain canonical identity, retry count,
maximum retries and consumed recovery allowance, then queue exactly one new
task after the next probe. Existing stale-epoch, concurrent-admission, rollback,
configuration-change and duplicate-probe checks remain intact.

Persistence tests additionally exposed lost timezone offsets in retry deadlines.
The writer now interprets the input as an instant before conversion to the
legacy database column. Tests cover positive/negative offsets, null deadlines
and a future deferred retry. Old ambiguous timestamps are not bulk rewritten.

## Compose evidence and limits

The disposable Compose HTTP stub now exercises:

1. A real generation HTTP 503, persisted pending history and an open circuit.
2. A failed readiness probe with no retry task queued.
3. Successful recovery, two queued movie/TV jobs, forced expiry of a started
   trial, and both jobs completing as durable deferred decisions without an
   extra provider request.
4. Another due probe and exactly two replacement jobs with unchanged budgets.
5. A simulated two-minute queue delay, a fresh queue instance, successful
   generation, a closed circuit and final persisted review-only results.

The final run made six generation requests and created five classification tasks
in total. No media route ran. Its container and network were removed afterward;
the normal local Compose stack was not rebuilt, faulted or modified.

The expanded test initially rejected the old synthetic success result because
it claimed completion without a library. The fixture now explicitly abstains,
and final rows are `awaiting_decision`, not a fabricated routed success. The
database completion constraint was preserved, not relaxed to make the test pass.

Metadata/policy content and destination selection are still synthetic. The
transport, circuit, retry transactions, queue and history persistence are real.
A fresh service instance is not an OS-process crash test. Timestamp aging is a
deterministic delay simulation, not a throughput or performance measurement.
This work fixes recovery behavior; it does not claim improved AI/RAG accuracy.

## Validation

- Targeted PostgreSQL recovery suites: three suites / 50 tests passed.
- Full PostgreSQL integration suite: 146 suites / 1,694 tests passed, with one
  intentional Compose-only skip covered by its dedicated runner below.
- Disposable provider-fault Compose test passed with cleanup.
- Full server unit suite: 1,374 suites / 40,287 tests passed.
- Server and client type checks, ESLint, ESM import/mock checks, copyright and
  production client build passed.
- Both server Knip gates, Markdown lint and the full client/production server
  dependency audits passed; both audits reported zero known vulnerabilities.
- Staged Gitleaks scan passed with no leaks; its container had no network and
  mounted the workspace read-only.
- Client runtime dependency and browser results are recorded separately in the
  [PR #540 outcome](client-runtime-pr-540-outcome.md). That PR was not merged.

The previous commit's CI/CD, CodeQL, OSV, Trivy, Gitleaks and copyright workflows
were verified successful through GitHub MCP. Existing CI jobs already run the
database and dedicated Compose tests; no workflow was weakened or bypassed.
This turn's full unit suites were run without coverage; no new full coverage
report or coverage-ratchet result is claimed.

## Recommendation and next item

Follow-up: the disjoint live-path cohort and its resulting feature-contract repair
are recorded in the [learned query metadata parity outcome](learned-query-metadata-parity-outcome.md).
The original recommendation below is retained as context.

Keep PostgreSQL, the current scheduler/queue and the focused ESM services. The
benefit is automatic recovery despite queue delay without renewing budgets or
asking the user to retry. The tradeoff is conservative cooldown latency and a
bounded trial that can begin after its original readiness observation. Larger
timeouts or extra retry frameworks would not address the demonstrated cause.

**Return to a live-path, review-only content evaluation on a disjoint movie/TV
cohort**, reusing the existing benchmark and the
[live guard investigation](live-routing-guard-diagnostics-outcome.md).
Use at least 100 eligible cases across available libraries, report shortfalls,
and carry each through current comparison, learned evidence, familiarity,
identity, freshness and confirmation gates. Separate provider waiting from
semantic abstention and administrator-confirmation holds. Report actual
eligibility and unnecessary-review candidates by media/library stratum; do not
call placement agreement accuracy or tune on previously inspected cases.

Choose one concrete evidence-path repair from those results. Keep names out of
content scoring, existing placement as weak evidence, and real confirmation
settings unchanged. Do not add another prompt variant, declaration UI, sampling
framework or safety waiver. This reconnects the recovery work to the product
goal: learning from actual library contents with less user involvement.

A separate maintenance follow-up is an explicit migration/read-boundary plan for
legacy naive timestamps, including historical timezone provenance and DST. The
current fix prevents offset loss for new retry writes but cannot reconstruct
offsets already discarded from historical rows.

Final stack: validated inventory → provenance-clean organic evidence → existing
bounded AI comparison → durable provider recovery → current live routing guards
→ held-out outcome measurement. No model, confidence threshold or safety
boundary is promoted based on a transport test.
