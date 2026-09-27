# CI recovery boundaries: outcome

Date: 2026-09-26. Unreleased; no release or deployment.

## Delivered

Fixed the two independent failures reported in
[run 36279486272](https://github.com/cloudbyday90/Classifarr/actions/runs/36279486272).

| Check | Before | Local result after the fix |
| --- | --- | --- |
| Native-intent cold navigation | 540,265 JavaScript bytes; over 512 KiB limit | 342,968 bytes; 36.5% reduction |
| Released-schema replay | File transport crashed creating `/app` | 63 migrations replayed; all 285 ledger entries matched; catalogs equal |
| Mixed movie/TV upgrade rehearsal | Skipped after replay failure | Passed; eight synthetic probes separated, with two ambiguity checks retained |

Command Center now loads only when its route is visited. Its features and SWR
behavior remain intact. Policy navigation still enforces the existing byte
budget, checks that other policy pages are not loaded, and now excludes the
Command Center entry chunk. A router unit test verifies the lazy boundary;
production browser coverage verifies navigation and browser history.

Both isolated upgrade commands disable application file logging before loading
the application module graph. Importing their entry points alone leaves the
environment unchanged and starts no application file logger. The normal server
logger defaults, retention, and persisted error handling are unchanged.

The schema and profile rehearsals also passed with `NODE_ENV=production`, file
logging initially enabled, and `LOG_DIR` deliberately pointing to a regular file
instead of a directory. No elevated filesystem permissions were needed. Both
commands created and removed only disposable database containers.

## Validation

- Backend migration, logging, rehearsal, and startup-order tests: 74 passed in
  eight suites, including a separate-process production-mode import test.
- Targeted router, asset-budget, and Command Center tests: 31 passed in four files.
- Full frontend coverage: 5,410 tests passed across 386 files; 85.83% statements,
  78.07% branches, 85.33% functions, and 87.85% lines. The coverage ratchet passed
  using this report and the retained previous full backend report; baselines
  were not changed.
- Production build and browser asset checks: all seven policy routes passed the
  unchanged 512 KiB limit; Command Center keyboard navigation and history passed
  (eight production browser tests). The existing visual overview browser test
  also passed, including responsive layout, metadata details, and access loss.
- Type checking, security/client/test lint, static ESM imports, copyright, and
  production dependency checks passed. Security lint retains one pre-existing
  unrelated filesystem warning in `captureOperatorCorrectionFrozenPolicy.mjs`.

The original CI run already passed its full backend unit, database integration,
and coverage checks. Those original results are not represented as a full backend
rerun of this patch. Local validation adds the formerly failing complete commands
and focused regression coverage.

## PR and safety boundaries

GitHub MCP returned no open pull requests for `cloudbyday90/Classifarr`; there was
no PR to randomly select. No PR was merged or substituted from another repository.
No release, version bump, production migration, application-container rebuild,
provider request, or live media mutation was performed.

## Retry fairness: evidence for the next component

A temporary deterministic admission probe used the actual recovery session with
synthetic providers and an in-memory claim ledger. It created 100 movies and 100
TV items, simulated a persistent provider outage, and recreated each session for
13 syncs spaced just beyond the daily cooldown. It compared stable source order
with an oldest-attempt-first ordering prototype, retaining the default limit.

| Ordering | Distinct movies attempted | Distinct TV items attempted | Attempts per library | Maximum attempts per sync |
| --- | --- | --- | --- | --- |
| Current source order | 8 / 100 | 8 / 100 | 104 | 8 |
| Oldest-attempt-first prototype | 100 / 100 | 100 / 100 | 104 | 8 |

This demonstrates the admission problem, not repair accuracy: every synthetic
provider request failed. Session recreation is not a real process-restart or
PostgreSQL durability test. The temporary probe is an intermediate under `.tmp/`,
not a deployed scheduler or a persistent benchmark artifact.

Next: implement and validate bounded oldest-attempt-first recovery admission
across a complete streamed capture, using durable attempt times. Retain only a
bounded candidate set, preserve digest/generation/attempt fencing, and keep the
eight-attempt budget and daily cooldown. Test later pages, missing/deleted items,
changed evidence, failed captures, concurrent claims, and real database restarts
before enabling it. Do not merely sort each page: that still favors early pages.

CI recovery took priority in this commit; production retry ordering is unchanged.
The [design](ci-recovery-boundaries-design.md) records official sources, alternatives,
and the recommendation stack.

Follow-up: the [recovery fairness outcome](source-recovery-fairness-outcome.md)
records the subsequent streamed implementation and real PostgreSQL validation.
