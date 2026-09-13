# Automatic cached-profile comparison: outcome

Date: 2026-09-13. Unreleased; no version bump, release or tag.

## What changed

The profiles prepared by `3b760c4d` now compare themselves with existing candidate
decisions automatically in the background. Classification reuses the description
vector it already obtained. No new AI generation, request-time fitting, settings
or operator approval is required for this diagnostic.

The existing Command Center Library learning card shows a compact comparison
count. Details stay collapsed, updates reuse `useSWR`, and the existing pause and
quiet screen-reader announcement are preserved. No additional fetch loop was added.

This is **not a routing or confidence change**. Agreement measures consistency
with the existing candidate destination, which may still require confirmation;
it is not a verified correct label. The implementation follows the separate
[design, official sources and trade-offs](inventory-representative-shadow-design.md).

## Reconciliation and implementation

Reviewed the previous cache commit and verified all six of its GitHub workflows
succeeded. Its source-versioned model, worker-thread fitting, admission checks,
timeouts, cache lifecycle and scheduling remain in use.

Separate ESM modules handle capsule projection, bounded observation storage,
pure comparison, scheduler-owned binding and public aggregate projection. The
existing classification finalizer only offers an observation; tests prove the
returned destination, confidence, review state and receipt remain unchanged.

Novelty checks now include active inventory identities excluded from training
because of conflicts or absent descriptions. A separate identity digest prevents
mid-comparison inventory changes from publishing counters, without forcing a
profile refit when only a non-training identity changes. Real PostgreSQL tests
exercise these boundaries, not just mocked queries.

## Local Compose evidence

The rebuilt application became healthy with a read-only root filesystem.
The first read-only probe yielded while foreground work was active; it performed
no fit or provider inspection. A later retry used the real repository, profile
worker and observation coordinator successfully:

| Measurement | Observed |
| --- | ---: |
| Active movie/TV libraries | 10 |
| Eligible distinct training descriptions | 6,650 |
| Selected representative groups | 64 |
| Unconverged starts retained | 1 |
| Known-item negative controls | 4 movies + 4 TV items |
| Correctly excluded as already seen | 8 of 8 |
| Counted as unseen comparisons | 0 |
| Fits | 1 |
| Extra embedding-generation calls | 0 |
| Provider metadata inspections | 2 |
| Whole probe including fit and validation | 10.958 seconds |

Four skip checks took under 1 ms and four took 1–10 ms. These are pure diagnostic
skip timings, **not successful scoring latency or end-to-end classification
latency**. The probe deliberately supplied known inventory vectors and synthetic
candidate decisions as negative controls; it neither routed media nor measured
accuracy. Synthetic movie/TV unit fixtures cover successful unseen agreement,
disagreement, candidate-order invariance and rejection cases separately.

No naturally arriving unseen cohort or accuracy improvement is claimed in this
commit. Private probes stay under ignored `.tmp/`; no titles, descriptions,
identifiers, vectors, configuration or credentials are published.

## Verification

Focused backend regression passed 13 suites / 178 tests. New comparison modules
have 100% statement/line/function coverage and 98.9% branch coverage. Tests cover
expiry, rollback/invalid clocks, duplicate suppression, memory bounds, cancellation,
source/model/configuration drift, unsupported or unstable profiles, tied evidence,
finalizer independence, scheduler ownership and administrator-only redaction.

PostgreSQL integration passed 1 suite / 3 tests. Full frontend regression passed
368 suites / 5,109 tests, including nested payload validation, pause/resume,
failure/permission-loss clearing and non-chatty announcements. Client coverage:
85.60% statements, 77.54% branches, 85.05% functions and 87.65% lines.

Full backend regression passed **1,285 suites / 37,172 tests** in 488.05 seconds.
Coverage: 90.13% statements/lines, 82.49% branches and 92.20% functions. The combined
coverage ratchet passed with fresh client and server reports; no threshold was
lowered. A final focused pass also verified scheduler binding and shutdown.
Dependency/copyright preflight, backend typecheck, test/security lint, client
lint/typecheck, Markdown lint and ESM checks passed.

The computer-use skill guided an attempted live UI inspection, but the browser
connection timed out twice. No visual verification is claimed; component tests
and the production Compose build passed. No UI input or settings change occurred.

## PR scope

GitHub MCP returned zero open Classifarr PRs at both selection checks. There was
no eligible PR to choose randomly. No closed PR or unrelated repository was
substituted, and no PR was merged.

## Recommendation stack

1. Keep this hands-off diagnostic: bounded batches and cached vectors minimize
   foreground work. Trade-off: busy periods can expire observations, and counters
   reset on restart. Skips are not errors or evidence of a correct destination.
2. Next, address the one remaining nonconverging profile using bounded background
   convergence work and the existing held-out study. Comparisons involving that
   profile currently skip; do not bypass that guard. Then measure coverage and
   disagreement causes on naturally arriving unseen movie/TV decisions,
   independently of their existing placements, without another declaration screen.
3. Improve metadata/profile fusion only where those checks identify real mistakes.
   Promote it into routing only after verified outcomes demonstrate improvement;
   do not turn agreement percentages into confidence or train on them as truth.

Only finalized candidate comparisons with a usable existing local description
query are observed. Direct deterministic routes and earlier exits are outside
this denominator. Description-only scoring does not represent the earlier
metadata-fused held-out benchmark. The current trusted-local-provider and
inventory budgets remain unchanged.
