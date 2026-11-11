# Non-adopted RAG verification context investigation

Research: November 11, 2026 Eastern. Baseline main
`37cd4c38edf2c360bdf81cab3e7532434dd3beaf`. This records source inspection
and a bounded pure-function reproduction before agreement on the next change.
The previous [RAG advice outcome](rag-recheck-advice-provenance-outcome.md)
explicitly left this behavior separate. No runtime change, live database access
or paid provider call is part of this investigation.

## Observed behavior and reachability

Without an adopted candidate, `runAiRerunStage` passes the earlier signal context
while supplying the fresh policy candidate as `verificationCandidate`. The
candidate-bound contract compares those different references. The mismatch can
prevent generation, and both successful and refused results obtain their
destination/confidence from that supplied signal context.

The principal reachable branch is an original `policy_prompt_confirm` trigger
followed by another `prompt_confirm` outcome. A non-adopted
`policy_prompt_select` to `prompt_confirm` upgrade normally stops at the existing
`policy_recheck_resolved` gate. Do not bypass that distinction while repairing
context.

"Non-adopted" describes the intermediate policy gate, not a final prohibition
on an AI candidate. That policy gate requires stronger improvement than the AI
rerun gate in some cases. Existing comparison and apply/shadow rollout decide
final adoption afterward.

The bounded reproduction used actual pure production functions:

| Input or result | Observed value |
| --- | --- |
| Earlier policy/context | Destination A, confidence 80 |
| Fresh policy/context that should be considered | Destination B, confidence 75 |
| Retrieval change | Similarity 0.50 to 0.60; margin 30 to 30 |
| Configured minima | Similarity 0.08; margin 10; confidence gain 5 |
| Intermediate policy adoption | False |
| AI rerun eligibility | True |
| Current candidate-bound contract | `candidate_mismatch` |
| Current no-provider result | Earlier A, confidence 80 |
| Same-destination CONFIRM control | Also retains earlier confidence 80 |

This establishes a mixed-pass reference problem. It does not establish its
frequency in production or explain a particular deployed misclassification.
Correcting it can admit previously mismatched requests and change review/final
results even when the provider is unavailable and no generation occurs.

## Existing private proof and separate contracts

The recheck stage already holds a fresh source immediately after every successful
prompt-confirm evaluation. Its current handoff retains only adopted candidates;
non-adopted success therefore has no private successful-stage association today.
Skipped, failed and timed-out stages retain the earlier `policyAfter`, so that
variable alone is not proof of successful reevaluation.

Expanded metadata is a new object. Existing live selection evidence can bind
an actual fresh result to that exact item and loaded library pool, while copied,
offline and earlier results cannot acquire proof from matching public fields.
Its existing bounds are 64 candidates, 64 libraries and a 16-KiB closed witness.
Using that witness as a prerequisite for retargeting is a new consumer/availability
decision, not an automatic consequence of optional advice being present.

Keep selection authority distinct from optional advice/profile fields. The
current advice session can omit optional sections after mutation but does not
revoke the separately constructed verification contract. A stronger prerequisite
needs an explicit decision about acceptance at preparation versus continued
validation through asynchronous pre-dispatch work.

Other important boundaries:

- `shouldVerifyPolicyRecheckCandidate` controls more than context selection. It
  enables an eligibility exception and selects the candidate baseline. Broadening
  that boolean would also bypass existing material-improvement/action-upgrade
  skips.
- AI counts increment before calling the AI service, including later provider
  refusal. A new preflight skip versus a refusal after invocation has different
  accounting consequences and must be specified.
- Nulling the context is not a safe refusal mechanism. The legacy disagreement
  helper can fall through to a default-library fallback when no suggestion is
  present. Baseline retention needs an intentional path.
- `buildAiRerunCandidate` still prefers the baseline's signal context. Repairing
  request context does not automatically repair retained/persisted evidence.
- No loaded witness is current database freshness or a proof of accuracy.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Genuine fresh non-adopted verification or baseline retention | Coherent target/confidence; avoids guessing on unknown proof | Changes dispatch, refusal/review results and potentially final outcomes | Recommended first scope |
| Retarget every structural `policyAfter` | Small implementation | Retained/skipped/copied evidence can masquerade as fresh success | Reject |
| Preserve unproven requests as legacy | Smaller availability change | Leaves stale verification behavior in the same branch | Explicit alternative, not the default recommendation |
| Accepted immutable snapshot at preparation | Fewer lifecycle hooks | Must state what later in-memory changes are outside that acceptance boundary | Decide explicitly |
| Continued source checks through pre-dispatch awaits | Detects changed proof before generation | Needs a distinct local refusal lifecycle, not provider-failure/retry handling | Preferred direction for authority-sensitive use |
| Repair persisted context too | Broader downstream coherence | Changes result construction and historical evidence contracts | Separate follow-up |

Proposed recommendation stack:

1. Settle genuine fresh non-adopted verification as the consumer; retain existing
   eligibility/caps and use fresh destination plus overall confidence together.
   Leave adopted/initial verification and persistence changes separate.
2. Require an explicit successful-stage association. Missing/unverified evidence
   should intentionally preserve the baseline without a guessed destination.
3. Specify continued validity, omission versus local refusal, count handling and
   post-dispatch uncertainty before implementation. Optional-data checks alone
   cannot be described as revoking verification authority.
4. Prove different/same-destination confidence, provider refusal, strict output,
   apply/shadow, retained/failed/late/overflow evidence and unchanged eligibility
   exceptions with real evaluator, isolated PostgreSQL and loopback HTTP.
5. Assess retained/persisted context precedence separately after this request
   context and result behavior is established.

The operator confirmed Q1 and the complete Q2 lifecycle contract in the
[agreed design](nonadopted-rag-verification-context-design.md) before implementation.
The separate [outcome](nonadopted-rag-verification-context-outcome.md) records
delivery evidence and remaining limitations. This investigation adds no UI,
endpoint, schema, setting, job, operator CLI trigger, release or deployment.

## Official guidance retrieved through MCP

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes generation, use and
  derivation. The application-specific inference is to bind the actual fresh
  evaluation and its consumer explicitly rather than infer freshness from IDs.
  No PROV protocol or conformance claim is proposed.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  separates model output from policy enforcement and recommends validated action
  schemas. Keep candidate/provider capability checks and downstream action
  authorization outside model advice; freshness is not classification correctness.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  supports explicit server-side checks and safe handling of refusals. Apply that
  principle to a deliberate baseline-preserving path, not a legacy guessed
  fallback or new uncertain inference replay.

## PR and baseline CI

Current MCP inventory contains only open
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589); uniform singleton
selection chooses it. Head `c6137f1467319a048e2d6babfe27dc6bb9859ffa`, both proposal
blobs and all eleven compiler records remain identical to the demonstrated
failing candidate. Fresh official registry/release and upstream issue checks
establish no changed artifact. Retain its
[settled deferral](client-compiler-pr-589-outcome.md), with no duplicate candidate
test claim or unrelated package update. It is mergeable with unstable checks;
no genuinely stale/conflicted applicable branch was established.

All seven baseline workflows completed successfully, including the
[main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/43025207334).
Those receipts qualify baseline `37cd4c38e`, not an implementation of this
proposal.
