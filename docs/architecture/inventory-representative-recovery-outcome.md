# Bounded representative-fit recovery outcome

Date: 2026-09-13.

## What changed and why

The [design](inventory-representative-recovery-design.md) addresses a verified
iteration-budget failure in the previous automatic library-profile work. One
initialization stopped at pass 64 even though it converged at pass 66 when allowed
to continue. Repeating the same 64-pass fit could not resolve that condition.

The new factory-owned ESM fit session retains centers and assignments between
bounded advances. Runtime profiles first allow 64 passes, then continue only
unfinished starts up to 128 total. Strict unchanged-assignment convergence and
the existing three-start comparison guard remain intact. Work preflight includes
the additional worst-case cost. Completed fits are not restarted or extended.

The historical public geometry limit and benchmark mode remain unchanged. Only
the private runtime profile protocol moves to v2, invalidating older profile keys.
There is no application version bump, release, migration, dependency, API, UI,
new model call or live routing change.

## Local Compose evidence

A same-snapshot comparison across all ten current movie/TV libraries verified:

| Check | Result |
| --- | ---: |
| Individual starts compared | 30 |
| Previously converged starts unchanged, including full fit output | 29 |
| Previously converged starts changed | 0 |
| Unfinished starts recovered | 1 |
| Additional assignment passes | 2 |
| Starts still unconverged | 0 |
| Embedding generation calls / database writes in the probe | 0 / 0 |

The comparison revalidated source and representation before accepting results;
it took 20.85 seconds while other validation was running. This is not a controlled
throughput measurement or classification-accuracy benchmark.

A real worker refresh published 64 supported groups from 6,650 exclusive
descriptions, excluding two shared descriptions from independent support. Two
descriptions remained outside supported groups. Immediate refresh returned
`not_due`; five-minute logical-clock reconciliation returned `up_to_date` using
the same fit. The successful three-step probe took 16.842 seconds, with one fit,
four model-identity inspections and zero embedding generation calls.

An earlier attempt published successfully but then rejected changed source data
during reconciliation. Another attempt yielded to busy work. Neither result was
counted as a stable reuse success; no source guard was bypassed.

Eight known-inventory negative controls (four movies and four TV items) were all
excluded as known items after recovery. They produced no agreement or disagreement
votes. These eight cases test leakage prevention, not accuracy. The container was
healthy with its root filesystem read-only.

## Safety, recovery and limitations

Cancellation releases private fit state only after active execution unwinds;
the new tests caught and fixed an early-disposal race. A session cannot advance
concurrently or beyond its total iteration limit. Real synthetic exhaustion
remains `converged: false`, preserving fallback instead of hiding a candidate.

The existing deadline, worker termination, configuration/model/source checks,
bounded cache and scheduled retry/backoff remain in effect. No raw training
checkpoint is persisted. Restart rebuilds automatically from current cached
vectors; it does not resume a saved mid-iteration checkpoint. Exhausted fits stop
and follow the normal cache/revalidation lifecycle, not an unlimited retry loop.

The learning math does not use titles, genres, library names or media labels.
Tests verify identical learned geometry when the same synthetic content passes
through the existing movie and TV adapters. This does **not** claim support for
new media types or providers; those outer adapter contracts remain unchanged.

Convergence is not semantic correctness, independent ground truth or confidence.
Existing placements may contain mistakes. No routing threshold was raised, and
no prior classification was made into a training label by this change.

## Validation

Final coverage-backed focused regression passed 11 suites / 93 tests in 47.13
seconds. The five affected geometry/profile modules reached 100% statements,
functions and lines, with 98.33% branch coverage. Tests include four pre-refactor
golden outputs, exact continuation equivalence, completed-fit preservation,
128-pass exhaustion, cancellation, disposal, work preflight and media invariance.
The recovery fixture was reduced to 600 synthetic vectors without losing its
64-pass exhaustion; the separate long-running exhaustion fixture has an explicit
test timeout. The production worker deadline was not increased.

Full backend regression passed **1,287 suites / 37,210 tests** in 565.649 seconds.
Backend coverage reached 90.14% statements/lines, 82.51% branches and 92.23%
functions. The combined coverage ratchet passed with fresh full backend and
client reports; no threshold was lowered.

Real PostgreSQL integration passed one suite / three tests. Frontend regression
passed 368 suites / 5,109 tests in 256.83 seconds. Client coverage remained 85.60%
statements, 77.54% branches, 85.05% functions and 87.65% lines. No UI changed, so
no new visual or accessibility-conformance claim is made.

Dependency/copyright preflight, backend and client type checks, test/security
lint, client lint, Markdown lint and ESM static-import/mock checks passed.

## PR and delivery scope

GitHub MCP returned zero open Classifarr PRs at both selection checks. No random
open PR could be applied locally, and no closed or unrelated PR was substituted.
Nothing was merged. All six workflows for the previous commit passed.

## Recommendation stack and next component

1. Keep bounded continuation enabled for runtime learning: it removes a measured
   manual-retry dead end. Cost: up to 64 additional passes for an unfinished start;
   recovery may still exhaust its limit.
2. Keep complete candidate scope, provenance validation and baseline fallback.
   Cost: some comparisons remain unavailable; uncertainty must not be disguised
   as increased confidence. Reuse the existing quiet SWR view, not another form.
3. Next, measure why **unseen** movie/TV comparisons disagree or abstain now that
   the convergence blocker is removed. Use bounded, deduplicated evidence grouped
   by cause and independently verified outcomes; do not treat current placement
   or AI agreement as truth. This should guide the next metadata/profile-fusion
   improvement without asking users to declare every library's purpose.
4. Expand provider/content adapters through an explicit capability contract when
   adding a new media source. Share the identity, freshness and recovery lifecycle,
   while keeping provider-specific parsing at the boundary. Do not hard-code genre
   or library-name categories into the learner.

Official-source recommendations and pros/cons are documented in the design. This
is the first recovery slice, not completion of every content-agnostic controller
or evidence-evaluation component.
