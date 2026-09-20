# Soft-review adjudication outcome

Date: 2026-09-20. Follows the [design and research](soft-review-adjudication-design.md).
No release, version change, dependency change or database migration.

## Implemented

Fixed an early AI-mode veto that prevented weak-overlap manual outcomes from
reaching the learned-evidence resolver that already supports them. A small ESM
predicate now owns the two exact soft-review reasons for both admission and
resolution. The policy result retains its manual-review flag and original score.

Unknown and hard manual holds remain provider-free. Soft reviews still need a
valid bounded candidate contract. The existing local proposal, policy constraint,
full-pool evidence, familiarity, identity, freshness and final routing checks
remain authoritative. No new resolver, acknowledgement screen or retry loop was
introduced. Call sites that lack a comparison contract still abstain.

## Local evidence

The original sample was replayed with the same seed, 100 descriptions, two held-out
folds, 50 movies and 50 TV items. Sample fingerprint:
`4119d45cab9fc334c544255bd4ffcf77c8d8048c50f57908f123213945808414`.
No source-component digests changed during either replay.

| Population | Before | After |
| --- | --- | --- |
| 69 weak-primary cases | 69 admitted to comparison | Unchanged |
| 10 weak-overlap cases, 7 movie / 3 TV | 10 abstained before comparison | 10 admitted |
| Other 21 cases | Existing comparison, verification or policy-only modes | Unchanged |

The zero-inference preflight found a supporting shortlisted candidate for 25 of
the 69 weak-primary cases. For 37, nearest examples overlapped; for seven, metadata
did not corroborate the separated examples. None had a fully supporting candidate
missing from the shortlist. These are content assessments, not calibrated accuracy
or proof of a live routing defect in all 69 cases.

Then the configured installed local model evaluated all ten newly admitted
overlap cases through the existing protected-shortlist prompt, parser, proposal
finalizer and learned-review assessment:

- Ten calls, ten valid proposals: seven movies and three TV items.
- Six proposals passed the existing learned content-agreement assessment.
- Four remained unresolved with `neighbors_disagree`.
- Zero routes authorized by the replay, zero application-data writes, zero
  routing receipts, zero learning records and zero user questions created.
- No remote provider fallback, model download, source changes or configuration changes.

This is an isolated read-only replay, not the complete live routing service.
The live novelty/familiarity and final freshness guards were not measured by this
replay. The local require-all-confirmations setting was `true` and was not changed.
Even a qualified live comparison must respect that routing hold.

A second 100-item sample excluded all 100 original description groups using the
existing deterministic cohort selector. It included 50 movies, 50 TV items and all
ten libraries. Fingerprint:
`d1c706c41bdfc0baea2addae9d2f6c3b7bf5dee121742f66d93d1d7e65396912`.
All 12 weak-overlap cases reached comparison admission: ten movies and two TV.
Six had content agreement, three neighbor overlap and three metadata disagreement.
This separate admission check used zero model calls and zero writes, and its source
digests remained stable. It is not an independently labeled accuracy benchmark.

Private probes and outputs remain in ignored `.tmp/`; no titles, descriptions,
provider responses, credentials or library identifiers were added to Git.

## Verification

- Regression tests first reproduced four failures in the old AI-mode selector.
- Focused suite: 15 suites, 310 tests passed, including production movie/TV policy
  projection and the ordinary classification path through the existing resolver.
- Synthetic path tests preserve confirmation holds, missing contracts, hard holds,
  neighbor/metadata disagreement, unavailable evidence, identity conflicts,
  unfamiliarity, stale policy, provider fallback, remote proposals and abstentions.
  They exercise one normal comparison, not additional retries.
- Client coverage run: 369 files, 5,128 tests passed.
- Backend coverage run: 1,366 suites, 39,910 tests passed. Statement/line coverage
  90.31%, branch coverage 83.61%, function coverage 92.46%. The new shared reason
  predicate and existing scope validator have 100% coverage in every metric.
- The combined server/client coverage ratchet passed without baseline changes.
- Database integration: three suites, 24 tests passed.
- Lint, typecheck, copyright/dependency preflight, ESM import/mock checks and the
  final documentation lint passed. The local image build passed; the real-model
  replay and disjoint preflight ran in isolated containers using that image.
- The separate production-naming gate still reports 43 pre-existing references
  against its zero baseline. The count is unchanged; no baseline was relaxed.

The previous commit `f97c6d65` passed all six GitHub workflows. GitHub's open-PR
collection was checked twice during this work and was empty. No PR was available
to randomly select, and no PR was merged or represented as locally implemented.

## Recommendation and next item

Keep this narrow admission repair. Its benefit is making supported comparisons
reachable without duplicating learning logic; its cost is normal provider work
for soft overlaps that previously stopped early. Do not remove review flags or
lower thresholds to increase apparent automation.

Next, exercise the **existing live review-only path** for the content-agreeing
cases and separate actual familiarity, identity and freshness failures from the
administrator's confirmation hold. Acceptance: current local proposals either
qualify under all live guards while staying unrouteable in review-only mode, or
produce a specific reproducible blocker to fix. Do not add another offline scorer,
retry layer or declaration screen. A decision to disable require-all-confirmations
is a separate operational choice, not an inferred code fix. The four demonstrated
neighbor disagreements remain review cases; model agreement alone cannot resolve them.

Final stack: policy eligibility → bounded advisory comparison → existing learned
evidence and familiarity checks → fresh one-use server authority → final route gate.
