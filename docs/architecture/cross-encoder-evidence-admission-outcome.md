# Cross-encoder evidence admission outcome

Date: 2026-09-20. Implementation follows the
[admission design](cross-encoder-evidence-admission-design.md). No release.

## Correction to the previous interpretation

The two exclusions in the previous 20-item smoke were not demonstrated missing
data. The read-only reproduction found `auto_classify` for both, with metadata
present and five ranked policies each. The comparison pool correctly excluded
these non-reviewable policy outcomes. A blanket catch lost that distinction.

The new modular admission service reuses the policy contract and preserves typed
validation reasons. Its aggregate diagnostics distinguish policy scope, missing
evidence, integrity safeguards, invalid contracts and resource limits. They
identify the next diagnostic check without pretending a repair is scheduled.

No additional inference, acknowledgement, routing authority, scheduler, database
migration, dependency, model or configuration was introduced. Live SWR and
recovery remain unchanged. Observed placement is still not an independent label,
and an automatic policy decision is not proof of correct classification.

## Verification

The isolated local Compose rerun used the identical sample fingerprint as both
the previous smoke and the read-only diagnostic probe: 20 items across ten
libraries, ten movies and ten TV shows. All 18 previously eligible comparisons
remained eligible. The other two now report `policy_auto_decision`, category
`policy_scope`, next step `not_needed`, with one movie and one TV case.

The run completed with `evaluationSnapshotValid: true`, `sourceVerified: true`,
zero chat/scoring calls and no routing writes. No repair was enqueued. The app
stayed healthy with zero restarts and no OOM; the optional scorer stayed stopped.
This is a functional admission regression check, not evidence of scorer accuracy
or faster execution. Private aggregate artifacts remain in ignored `.tmp`.

```powershell
node scripts/run-inventory-benchmark-compose.mjs --leader-cross-encoder --seed snapshot-contract-20260920 --size 20 --folds 2 --score-cases 0 --generate-cases 0 --max-minutes 10
```

A second deterministic, zero-inference readiness smoke considered 100 items
(50 movies, 50 TV shows) across all ten libraries. It admitted 95 and excluded five automatic-policy
decisions (one movie, four TV), with no other evidence exclusions. This does not
prove that every source field is complete or that the candidate examples are
semantically sufficient. It does show no backfill-triggering gap in this sample's
admission contract. This is not a disjoint accuracy-confirmation cohort.
The run remained source-verified, with zero inference calls and routing writes.

```powershell
node scripts/run-inventory-benchmark-compose.mjs --leader-cross-encoder --seed admission-diagnosis-20260920 --size 100 --folds 2 --score-cases 0 --generate-cases 0 --max-minutes 10
```

Focused regression checks passed six suites / 165 tests, including policy scope,
zero versus malformed counts, sparse/partial evidence, shared/duplicate/query-copy
exclusions, unchanged plans, private-error suppression, bounded retention,
cancellation, deferral and real call accounting. PostgreSQL integration passed
three suites / 24 tests. Client coverage passed 369 files / 5,128 tests.

The full backend coverage suite was rerun after the final edge-case changes:
1,365 suites / 39,867 tests passed. Statements/lines were 90.31%, branches 83.60%
and functions 92.46%; the new admission module had 100% coverage in all four
measures. The shared validator had 100% statements/lines/functions and 97.80%
branches. The coverage ratchet passed against the configured baselines.

A differential check against the previous commit exercised 123 synthetic input
variants: all 69 accepted plans retained identical fingerprints, and all rejected
inputs remained rejected. There were zero admission/fingerprint discrepancies.

Lint, type checks, copyright/dependency preflight, Markdown lint and ESM checks
passed. The separate naming-debt gate still reports the same 43 existing
production references against its zero baseline. No waiver was introduced.

The previous commit's CI/CD, CodeQL, OSV, Trivy, Gitleaks and copyright workflows
all passed. GitHub MCP returned no open pull requests on both checks, so no PR
was available to randomly select or implement. None was merged.

## Follow-up that advances content understanding

**Trace the `weak_evidence_primary` routing-readiness gap, not these automatic
policy exclusions.** In the 100-item smoke, 79 cases hit the existing review
veto: 69 had `weak_evidence_primary` (35 movies, 34 TV) and ten had
`weak_evidence_overlap`. This benchmark preserves the initial policy veto; it
does not execute the complete live learned-evidence resolution path. These
counts identify an investigation slice, not 79 proven stuck live routes, and do
not establish that those safeguards should be removed.

First reconcile those initial outcomes with `learnedEvidenceReviewScope`,
`learnedEvidenceReviewResolver` and `learnedEvidenceRoutingAssessment`, which
already distinguish resolvable weak evidence from hard conflicts. Reuse the
existing fresh-policy replay/private investigation path; do not invent a second
resolver or treat the leader benchmark as an end-to-end routing measurement.
Trace a bounded set of movie/TV cases through query metadata, evidence provenance,
eligible examples and policy-score contributions. Establish whether corroboration is missing,
signals duplicate the same placement observation, content matching is misleading,
or the destinations genuinely overlap. Separate topic/plot similarity from
format, audience and explicit contradictions. Check existing observation
readiness only where the trace shows a missing field. Prefer existing retained
diagnostics without extra model calls. If an admitted local proposal is absent,
report that limit rather than fabricating one as proof of routing readiness.
Do not add a declaration screen or lower the routing gate.

Deliver one concrete evidence-path repair, selected from that trace, and measure
it on a disjoint held-out cohort. If evidence is complete but the scorer still
confuses content purpose, stop this model track rather than lowering thresholds
or retrying it. Do not train on automatic placements, tune on the old 100 outcomes
or ask users to define every library manually. Library names stay out of scoring.

Final recommendation: retain automatic learning and existing safe recovery,
use precise admission diagnostics, and keep the optional scorer off live routing
until a specific content-quality improvement is supported by independent evidence.
