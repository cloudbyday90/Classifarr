# Retained RAG result and saved review evidence investigation

Research date: November 12, 2026 Eastern. Baseline main:
`e44c7c4eeddf4c25e90688f355b2d50ee8db5057`. Read-only source investigation and
pure-function reproductions; no production database or provider was contacted.

The previous batch repaired non-adopted verification requests. This investigation
distinguishes returned result context, saved current policy details and the
separate first-pass metadata used by pending-review readers. Changing just one
context property cannot be described as repairing all three.

## Reproduced mismatches

### Returned result context

The real `buildAiRerunCandidate`, comparison, conflict resolution and rollout
helpers reproduce this case:

- Original prompt-confirm destination A (`2001`), overall confidence 80.
- Fresh non-adopted prompt-confirm destination B (`101`), overall confidence 75.
- Similarity improves from 0.50 to 0.60; margin stays 30.
- Intermediate policy adoption stays false. The existing final comparison can
  adopt the verification result with `candidate_improved` in apply mode.
- The result has destination B/confidence 75 but retains A/confidence 80 inside
  `signalContext`. Shadow retains the original A/80 result.

`classificationRagLoopServiceShared.mjs:105` prefers
`baselineResult.signalContext` over the supplied fresh context. Fresh
`policyResult` and `ragContext` use their own precedence on the following lines.
Globally reversing that priority would affect adopted and generic callers too.

### Saved pending-review policy reference

The real `buildPolicyRuntimeReviewReference` reproduces a second defect:

- Stored root `metadata.policyResult.ranked` contains original A with score 80.
- Saved `classification_details.ranked_candidates` and current question
  candidates contain B with score 70.
- Both destinations are available.
- The review reader returns primary A/80 with no incoherence reason.

`policyRuntimeReviewReference.mjs:32-35` prefers root policy ranking over question
candidates and never reads the saved detail ranking. The rerun's overall
confidence and an individual candidate's policy score are different quantities;
the defect here is mixing their source stages, not demanding those numbers equal.

The source of the split is concrete:

1. `classificationPolicyPathService.mjs:179` puts the first evaluation into
   `metadata.policyResult`.
2. RAG uses metadata copies at `classificationRagLoopService.mjs:345,355`.
3. Accepted results carry fresh top-level `result.policyResult`.
4. `classificationPersistenceService.mjs:324-325,375-382` projects that result
   into current ranked candidates, scores, weights and diagnostics.
5. The same writer spreads original metadata at lines 428-431 and serializes it
   at line 481, retaining the earlier root policy result beside those details.

Root policy-result readers include the shared review reference, decision
presentation, library evidence profile, optional developer shortlist replay and
legacy signal path. Pending review builds the answer contract from the stored
row. Its recommendation/presentation participates in the contract fingerprint
and effective stale handling. Repairing that source can change visible
recommendations and action references; it is not an invisible cleanup.

### Inherited AI advisory

`buildFreshSecondPassBaseResult` clears clarification/question/pending fields,
but spreads other baseline properties. An earlier ABSTAIN or refusal creates an
`ai_advisory` for A. A fresh CONFIRM has no advisory property, so baseline spread
can retain old A advisory beside current confirmed B.

Persistence explicitly stores that advisory in `classification_details` at
`classificationPersistenceService.mjs:388`. Decision presentation treats a v1
advisory as an unavailable historical comparison. Replacing only
`signalContext` would not remove this separate stale artifact.

## What is and is not persisted

The full `signalContext` is not serialized. Persistence only falls back to its
`signals` for `signals_json` and its `ragContext` for retrieval details. Native
`buildSignalContext` contains neither field, and an accepted RAG result already
has explicit top-level policy and retrieval context.

One direct visible consumer remains: `ensureDecisionQuestion` forwards
`signalContext.relatedEvidenceSummary`, which the question builder stores under
`question.meta.related_evidence_summary`. Replacing the old context with the
fresh minimal request context would omit those earlier observations. They must
not silently be relabeled as evidence produced by the new evaluation.

Route-safety enforcement reads destination, confidence, policy result, AI
authority and consensus evidence rather than `signalContext`. Existing native
resolution learning reads the authorized question/answer/outcome boundary, not
this optional summary. These facts do not justify skipping regression tests when
changing saved review/action references.

History verification projections deliberately retain only verification version
and status. They exclude candidate identity and provider text
(`classificationCandidateBoundVerificationContract.mjs:171-186`). Adding a new
saved verification identity/confidence snapshot would expand an explicit storage
contract and is not implied by fixing a context precedence rule.

## Available proof and unresolved boundary

The new private non-adopted stage association requires a successful fresh
prompt-confirm evaluation, exact typed item/result/pool, unchanged non-adopted
gate, and the existing 64-candidate/64-library/16-KiB numeric witness. Preparation
and entry are one-use; observed invalidation is latched.

At the investigated baseline its last current acceptance is inside `runAiRerunStage`, before constructing the
candidate. No private accepted-result association survives the later shallow
copies in rollout/log-context helpers. Rollout automation and review-question
construction also await further work. A new saved-reference producer therefore
needs its own stated freeze/propagation/mutation contract; public flags or a
later result copy cannot automatically inherit the request capability.

## Recommendations and tradeoffs

| First scope | Benefit | Cost or limitation |
| --- | --- | --- |
| Prospective saved review-reference coherence for accepted non-adopted results | Addresses the actual old-library recommendation in existing review surfaces | Must distinguish original/current references and protect action/replay semantics |
| Retained result context/advisory cleanup only | Smaller result-assembly boundary; removes mixed-stage state | Leaves the reproduced saved pending-review recommendation mismatch |
| Globally replace root policy metadata or reverse shared precedence | Less selective code | Broadens adopted, legacy, historical and replay behavior; reject without separate proof |
| Add a new stored verification snapshot | Explicit new evidence | New disclosure/lifecycle contract; not required by the first investigation |

Recommended stack:

1. Prioritize the saved current-policy review reference for future accepted
   non-adopted RAG results. Keep original automated-decision evidence distinct,
   leave historical records unchanged, and retain scoring, budgets and
   routing/learning authorization. Use existing review surfaces without another
   UI or operator CLI step.
2. Settle storage/projection, genuine accepted-result propagation, freeze time,
   missing/mutated evidence and exact replay behavior before implementation.
3. Repair retained context and inherited advisory within an explicitly agreed
   result-assembly scope; do not claim this alone fixes saved root references.
4. Assess adopted/initial/legacy paths and any broader evidence capture separately.

Q1–Q3 confirmed saved review evidence as the first consumer and settled its
storage, publication and reader boundary. The
[saved-frame design](current-policy-review-frame-design.md) governs implementation;
the separate [outcome](current-policy-review-frame-outcome.md) records validation.

## Official guidance discovered through MCP

Sources were searched and opened November 12:

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes generation, use and
  derivation. Our application-specific inference is to name original and current
  evidence separately and associate a saved projection with the evaluation that
  actually produced it. This is not a PROV conformance claim.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends provenance and source attribution while keeping tool authorization
  independent of model output. Preserve strict provider/response contracts and
  downstream authorization; do not treat freshness as ground truth.
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends explicit server checks and deny-by-default behavior. A new current
  reference must not bypass stale-state, confirmation/change or replay rules.

## PR and CI findings

Only open [PR 589](https://github.com/cloudbyday90/Classifarr/pull/589) remains,
so uniform singleton selection chooses it. Head
`c6137f1467319a048e2d6babfe27dc6bb9859ffa`, manifest blob
`24e574f03a57ffa8a7bc9faffbcd04edd8c72a15` and lock blob
`71653236d616e717afbf1156cf53f18d115a9535` are unchanged. It is mergeable with
unstable checks, not a newly established stale/conflicted applicable branch.

Pinned-toolchain registry checks still report vue-tsc installed/wanted 3.3.13
and latest 3.3.14, with the same candidate/compiler integrity values as the
[previously failed assessment](client-compiler-pr-589-outcome.md). Retain that
deferral; no applicable independent subset or changed artifact was established.
[Issue 6328](https://github.com/vuejs/language-tools/issues/6328) closed November
12 as completed, but its inspected timeline has no associated fix reference and
no newer published artifact. [Issue 6322](https://github.com/vuejs/language-tools/issues/6322)
remains open. Do not repeat the earlier claim that both reports are open.
The latest published [release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14)
remains v3.3.14. No dependency installation, rebase or merge is warranted solely
from the issue closure.

The baseline [main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/43050452897)
failed [Build and Test](https://github.com/cloudbyday90/Classifarr/actions/runs/43050452897/job/130625876125)
during Playwright's Ubuntu dependency installation: apt could not resolve
`security.ubuntu.com`, ending with exit 100. Application test/build steps were
not reached. Separate database and fresh-install/upgrade jobs passed; the
acceptance readout correctly blocked on missing build evidence. Other observed
security/resource/copyright runs passed.

The failed build job was retried through GitHub MCP without editing workflow,
installer policy, assertions or gates. Attempt 2 passed its application, database
and installation jobs, but acceptance rejected the reused installation receipt:
its attempt and freshness could not qualify the new readout. A full attempt 3
was then started through the authenticated browser because the connector exposes
only job-level retries and the local GitHub CLI credential is invalid. See the
[separate CI outcome](ci-e44c7c4e-retry-outcome.md). This main-branch rerun cannot
enter tag-only release/publication jobs. No release or deployment is authorized.
