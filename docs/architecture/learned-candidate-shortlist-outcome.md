# Learned candidate shortlist outcome

## Delivered behavior

The previous commit, `8e7c79e8`, added learned inventory fit inside live AI
comparison, after the three-candidate cutoff. This component moves a fresh
metadata-learning pass ahead of that cutoff so an eligible alternative lower
in the policy ranking can reach comparison.

The full pool is still limited to policy-returned, active, same-media libraries.
The policy leader keeps slot one. Positive learned-fit rank and policy order
jointly determine the other slots. The original policy scores, confidence,
ranking and routing authority are unchanged. Exact-inventory comparison uses
the same selected candidates as the AI contract.

Learning discovers patterns from current inventory without hardcoded library
names or purpose declarations. It performs no model calls, retains no profile
cache and adds no UI controls or acknowledgements. Descriptions identify and
exclude query copies; the shortlister's fit features are genres, studio and
rating, not a new synopsis model. Subsequent live comparison still retrieves
actual descriptions through the preceding component.

## Design and security outcome

- Small ESM modules isolate candidate selection orchestration and pure ranking.
  The existing profile learner, rank fusion and read-only repository are reused.
- A supplied internal order must be a complete eligible-pool permutation and
  retain the leader. It cannot add, omit, duplicate or unpin candidates.
- Snapshot fingerprints, profile version, status and numeric fields are checked
  before ranking. Invalid or mixed-snapshot profiles preserve the exact baseline.
- Disabled RAG, missing metadata, invalid identity, cancellation, read failures,
  oversized pools and outcomes that forbid AI comparison preserve the baseline.
- The existing AI-mode resolver remains authoritative. A `prompt_select`
  outcome may compare alternatives while still requiring human confirmation;
  that review flag is not incorrectly treated as a prohibition on learning.
- Database snapshots are read-only and bounded. Raw metadata and private profile
  fingerprints are not added to the provider contract or persisted diagnostics.
- No dependency, public API, database migration, policy rewrite or confidence
  threshold change was needed. No old review is automatically reclassified.

## Local 100-title observation

The seeded sampler used `classifarr-profile-20260912` against current Compose
inventory: 10 active libraries and 10 active policies. All 100 sampled synopsis
groups (100 identities) were excluded from the new learner together, including
their copies. Tests separately cover incoming/stored query-copy exclusion.

The probe used the existing policy evaluator and source metadata, with an empty
RAG match cache to avoid embedding/provider calls. It used the pure decision
projection instead of the metrics-persisting finalizer. PostgreSQL connections
were configured and verified read-only; no media was routed or rewritten.

| Observation | Result |
| --- | --- |
| Sampled titles | 100 |
| Valid reviewable comparison contracts | 94 |
| Reviewable pools larger than three | 39 |
| Reviewable cases with an explicit human-review flag | 85 |
| Reviewable cases where AI comparison is prohibited | 7 |
| Cases actually reaching new profile fitting | 37 |
| Changed shortlist sets / order-only changes | 8 / 3 |
| Existing placement present, before / after | 94/94 / 94/94 |
| Recovered / newly missed existing placements | 0 / 0 |
| Leader or eligibility violations | 0 / 0 |
| Model calls | 0 |
| In-memory shortlist time, mean / p95 / maximum | 14 / 49 / 112 ms |
| Separate real-repository smoke | Valid three-candidate contract; 752 ms |

This is an observational shortlist check, not routing accuracy. Existing
placements were already present in every reviewable baseline shortlist, so
there was no missing placement for this cohort to recover. Existing policy
profiles/history were not retrained on the held-out split. Source metadata
was not freshly enriched, and historical RAG evidence was deliberately absent.
The new learner's split is held out; the entire legacy policy pipeline is not.

The read-only policy projection returned 9 manual, 79 prompt-select, 8
prompt-confirm and 4 auto-classify outcomes; these were simulated decisions,
not actual routes. Six cases had no valid comparison contract. No AI proposal,
abstention or reduction in real review burden was measured. Shortlist timing
includes 37 fits and 57 no-ops on a frozen in-memory corpus; it excludes the
policy evaluation, database read and model comparison. The separate smoke
includes actual repository reads but is only one observation.

Final integration review caught an overly broad initial guard: it treated
every human-review flag as an AI veto, although the existing resolver permits
advisory comparison for `prompt_select`. Reusing that resolver corrected this
without changing routing authority. The benchmark above was rerun after the
correction; the initial two-fit result is superseded. Regression tests cover
the flagged prompt-select path through shortlist, AI and identity comparison.

The Compose image was rebuilt and reported healthy. SHA-256 values of all five
changed/new runtime files matched their workspace counterparts. Real PostgreSQL
integration also verified that changing stored inventory metadata changes the
next shortlist without touching the vector cache, and that a learned library
outside the eligible policy pool cannot be inserted.

## Verification

- Focused service/path/code-health checks: 8 suites, 23,676 tests passed.
- Relevant PostgreSQL integration: 3 suites, 12 tests passed.
- Backend lint and typecheck, ESM import/mock-shape checks passed.
- Final full backend coverage run: 1,225 suites, 34,733 tests passed.
- Backend coverage: statements/lines 90.00%, branches 81.26%, functions 92.11%.
  The ratchet passed with the fresh backend report and the existing unchanged
  client report. No client files changed; the Compose frontend build was cached.
- Markdown lint passed across 1,250 files; `git diff --check` passed.

## Recommendations and next component

The [design](learned-candidate-shortlist-design.md) records official-source
research, pros/cons and W3C considerations. Sources were checked September 12,
2026; living pages are not certified archived August 2026 versions.

Recommended stack: hard policy eligibility → full candidate pool → pinned
policy leader + learned alternative ranks → bounded description/AI comparison
→ existing routing decision. This adds candidate reach without a larger prompt
or more user involvement. Its costs are an extra bounded inventory read and
dependence on imperfect observed library contents; retain baseline fallback.

Next high-value component: an evidence-aware final routing decision. Candidate
selection and AI comparison can now use organically learned inventory, but the
existing finalizer keeps those proposals advisory. First replay this 100-title
cohort with complete live retrieval and local AI comparison. Identify clear,
supported matches versus real ambiguity and hard conflicts, then let validated
evidence affect the route/review decision rather than only its explanation.
Measure routing errors and remaining reviews separately from placement
agreement. Do not simply lower thresholds, convert fit into a percentage, or
treat agreement with existing placements as proof of correctness. Keep hard
policy conflicts blocked and uncertain cases reviewable, without adding a new
purpose-declaration workflow.

The concrete boundary is
[`finalizePolicyCandidateAdjudication`](../../server/src/services/policyCandidateAdjudicationResult.mjs):
it preserves policy confidence and returns `needs_clarification: true` even
for a valid AI proposal. That explains why better evidence does not, by itself,
raise a displayed 45 policy score or remove the confirmation step today.

## PR, CI and release scope

GitHub MCP returned no open Classifarr PRs, including a second check before
handoff. There was no PR available for random selection or local implementation;
none was merged. No release or tag is created.

The unrelated production naming gate still reports 26 production references
against its zero baseline, unchanged from the preceding commit. That gate
remains blocked; passing unit tests does not mean every CI gate is green.
