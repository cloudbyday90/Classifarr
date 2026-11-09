# Provenance-aware native policy scoring

Date: 2026-11-08 Eastern. Status: agreed; the operator confirmed the complete first scoring batch
before implementation. No release or deployment.

## Problem established in the current source

Native storage authority currently selects the intent scoring channel. The
native evaluator combines all purpose rules, including profile observations,
and the composition assigns that score the policy's preset/intent weight.
The same inventory profile can then contribute through the profile channel
and count again toward agreement. Admission and purpose authority are being
confused at the numeric composition boundary.

The existing purpose-origin and match diagnostics already distinguish a real
declaration from profile-derived or unverified purpose. Specialized destination
checks also exclude inferred rules from declared identity proof. Those later
checks discount weak candidates and require review; they do not repair the raw
ordering that created the misleading suggestion.

Relevant source boundaries are policyEngineEvaluation.mjs,
policyNativeIntentRuntimeEvaluator.mjs, policyEngineSourceScoring.mjs,
policyPurposeMatchEvidence.mjs, policyDeclaredPurposeProvenance.mjs,
policyCandidateDiagnostics.mjs and
policySpecializedDestinationIdentityEvidence.mjs.

## Recommended first batch

Correct native intent composition without inventing new weights or treating
AI advice as a label. The following is the proposed complete boundary.

1. Calculate the intent contribution from the validated declared purpose subset
   only, using the existing rule scorer and configured combination mode.
   A mixed policy must not borrow a stronger inferred rule's score after one
   declaration matches. Match requires the existing greater-than-50 rule.
2. Apply the existing helpful-hint boost and avoid penalty only after that
   declared subset matches. Hints cannot establish a missing purpose match.
   Keep their existing formulas and all hard-limit checks.
3. Require exact live item/policy/library/contract binding for this contribution.
   Keep its authority in a private, server-minted in-memory record, separate
   from the existing presentation-only match evidence. Parsed/copied diagnostic
   JSON, persisted cards and missing/unbound identity cannot supply intent.
4. Give profile-derived and unknown purpose no additional numeric intent
   channel. The existing profile channel remains available once, including for
   generic libraries. Do not substitute inferred intent when a profile score
   is missing. Preserve current media-scope admission, including eligible
   zero-score inferred candidates and observed-absence advisory handling.
5. Keep configured weights and positive-contribution normalization. Compute
   agreement and source diagnostics from the actual contributing channels.
   Declared-subset evidence semantics must not be inferred from the complete
   mixed contract. Count no suppressed inferred intent as a second source.
6. Preserve the existing legacy-preset branch, strict conflicts, specialized
   identity checks, calibration, ambiguity handling and route gates. Preserve
   threshold values and command/replay/learning authorization. Scores, ranking
   and resulting threshold bands can change; do not describe routing outcomes
   as unchanged or promise every candidate's score decreases.

Existing pattern/RAG/history counters remain outside this first lineage fix.
Their distinct channel names are not proof of statistical independence. This
batch removes the demonstrated profile-purpose duplication without claiming
complete source independence.

## Numeric interpretation and limits

The retained weighted mean is:

```text
active weight = configured weight when the channel contributes positively
base score = sum(score * active weight) / sum(active weight)
raw score = capped(base score * existing agreement multiplier)
ranked score = existing calibration(raw score)
```

Removing a low channel can increase a weighted mean. A strong remaining RAG
channel must not silently become specialized purpose proof. Tests must cover
this case through the real diagnostic, calibration and decision projections,
including exact prompt/automatic boundaries and mixed declared purpose.

The seven previously inspected frozen evaluations contain no matched declared
purpose. Their retained numeric fields permit a narrowly named inferred-intent
ablation, not exact replay of a new mixed-rule calculation: they omit raw rules,
declared-subset numeric scores and complete calibration context. Never fill
those gaps from current policy configuration or present operator agreement as
independent accuracy. Some profile-only wrong orderings can remain after this
fix; precise destination meaning still needs an established declaration.

Keep the full native runtime evaluation available for its current admission
and compatibility meaning. Its observed purpose score can remain distinct from
the actual intent contribution in the existing source breakdown. Do not
reinterpret old stored scores, upgrade old evidence, or rewrite historical
statistics. Existing immutable captures retain their actual frozen numbers
and proof categories; no new capture/schema or historical backfill is proposed.

## Modular implementation and contract boundaries

Extract a shared pure rule-scoring leaf from the native evaluator and add a
small private contribution leaf for validated declared-subset scoring. Reuse
the established provenance classifier and binding checks rather than create
another source allowlist. Keep aggregation changes in the existing evaluator
and source-scoring leaves; keep diagnostic semantics consistent with the
private contribution. Do not turn presentation-only v1 match evidence into
scoring authority.

The same evaluator must serve live classification, revalidation, fresh
inventory preparation and isolated/offline calculation. Offline execution
does not gain provider, persistence or route authority. No endpoint, client
command, widget, setting, scheduler, routine CLI step or provider call is
needed. Existing evidence disclosures should explain the actual numeric
contribution through their current fields. Legacy attribution producers and
their enums remain separate; do not feed new states into old statistics.

## Research and applicability

Official sources were discovered and opened through the connected search
service on November 8 Eastern / November 9 UTC, 2026.

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) models derivation separately
  from the entity that contains a value. Applying that distinction here means
  native storage does not erase an observation's origin. This is an application
  design inference; the standard does not prescribe weights or prove source
  independence. A new RDF store is unnecessary.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, methods, deployment-relevant evaluation and
  measurement limitations. Use frozen numeric controls and real evaluator
  fixtures; report evidence gaps and avoid accuracy claims from a small
  suggestion-exposed cohort.
- [W3C WCAG 2.2 labels and instructions guidance](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
  explains clear inputs without excessive instructional clutter. Keep the
  existing purpose authoring and review controls; this backend correction
  does not justify another operator process or dashboard. Existing accessible
  labels and keyboard disclosures remain covered by their current tests.

No source above specifies a Classifarr fusion formula. The numeric choice is
the bounded application proposal here, rather than a standards mandate.

## Options, benefits and costs

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Remove only the agreement bonus | Smallest arithmetic edit | Leaves duplicated intent weight and observed wrong orderings | Insufficient |
| Declared-subset intent; existing profile once | Fixes demonstrated provenance error without new knobs | Changes rankings/bands; does not establish missing destination meaning | First batch |
| Redesign every evidence family and denominator | Could address wider correlation | Requires lineage and calibration evidence absent from frozen history | Later measured work |
| Automatically prefer AI | Can match the sampled operator choices | Promotes advisory output without independent correctness or route authority | Reject |
| Lower routing thresholds | More automatic decisions | Gives weak wrong rankings more authority | Reject |

## Verification and delivery

Use provider-free pure/evaluator regressions plus the existing isolated
PostgreSQL harness. Cover all four rule combination modes; declared specialized
support; generic fallback; profile-only overlap; mixed declared mismatch with
inferred match; mixed weaker/stronger inferred scores; missing/copied/changed
proof; helpful/avoid controls; strict constraints; observed absence; zero-score
inferred admission; unchanged legacy normalization; and threshold effects.

Upgrade positive test fixtures to actual declared provenance and exact binding
where appropriate, while retaining separate unknown-origin controls. The
existing source native_intent can be declared even when inference_state is
inferred; use the established classifier rather than guess from that flag.

Run focused contracts first, then fresh backend coverage, normal quality and
ownership gates. Reuse client coverage only with verified unchanged source,
installed graph and reports. Keep the separate unexplained CI table-lock
timeout visible; no recovery timeout or retry change is part of this batch.
Perform scoped artifact maintenance around substantial test work. Record
actual results in a separate outcome document and update Unreleased, then
commit/push all agreed changes on main. No version bump, release or deployment.

## Independent PR assessment and next recommendation stack

Fresh open-PR intake contains 580 and 581. Uniform node:crypto.randomInt chose
581 at 2026-11-09T02:05:26Z. Its exact head and published compiler artifact are
unchanged from the demonstrated 3.3.14 regression assessment. Retain exact
3.3.13 and the existing baseline controls; an identical failing compiler is
not an applicable local upgrade. Server ESLint 10.14.0 from 580 is already
adopted. Both branches are actually mergeable on the fresh GitHub REST check;
UNSTABLE checks do not establish a merge conflict. No rebase or PR merge is
warranted solely because main advanced.

1. Correct native provenance-aware contribution and its real diagnostics.
2. Establish precise generic/specialized purpose through the existing UI;
   do not automatically promote inventory observations into declarations.
3. Assess remaining source-family correlation and calibration with suitable
   prospective evidence before changing additional weights or thresholds.
4. Investigate old pending-History reconciliation separately under existing
   ownership/recovery boundaries; do not replay or delete it blindly.
