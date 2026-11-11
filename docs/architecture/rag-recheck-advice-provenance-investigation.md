# RAG recheck advice provenance investigation

Research: November 11, 2026 Eastern. Baseline main
`e9c6d87d696f83c381944f9667b5e478741a9a0a`. This records source inspection
and recommendations before agreement on the next implementation. The previous
[initial verification outcome](verification-advice-provenance-outcome.md)
explicitly kept RAG rechecks separate. No runtime change is made by this
investigation.

## Two different verification paths

| Recheck case | Current behavior | Consequence |
| --- | --- | --- |
| Adopted prompt-confirm candidate | The helper spreads earlier context, then replaces destination/confidence | Earlier ranked references, breakdown and diagnostics can remain |
| Prompt-confirm without an adopted candidate | AI mode can still be verification, with original context unchanged | Rebuilding it could change candidate admission and confidence used by parsing |
| Skipped or failed recheck | `policyAfter` retains the earlier result | That variable alone does not prove successful reevaluation |
| Successful fresh evaluation | Production evaluation mints an exact-item private receipt | It can support a new optional-advice source when held at the actual handoff |

`runPolicyRecheckStage` initializes `policyAfter` to the earlier policy result.
It evaluates the exact expanded metadata through existing retry/timeout controls,
then synchronously assesses adoption and may construct a candidate. The service
subsequently calls `runAiRerunStage` with that result, even when the recheck did
not produce a new adopted candidate.

`shouldVerifyPolicyRecheckCandidate` requires both an existing candidate and
`prompt_confirm`. Only that branch uses
`buildPolicyRecheckVerificationSignalContext`; all other rerun branches retain
the original context. Existing tests explicitly preserve the non-adopted branch.

`expandRetrievalMetadata` returns a new object. An earlier receipt cannot qualify
against it merely because movie/TV identity values match. The fresh production
evaluation can mint proof for the exact expanded object, but a copied result,
offline evaluation or retained earlier result cannot acquire proof by shape.

These facts establish a mixed-pass contextual boundary. They do not prove that
this caused a particular deployed classification or that advice provenance
establishes a correct destination.

## Compatibility and lifecycle boundaries

The existing recheck helper prioritizes the explicit policy destination, coerces
IDs and uses a finite-number confidence fallback. The ordinary signal builder
instead selects the strict ranked leader and defaults confidence to zero. They
are not interchangeable for all malformed, legacy or unbound inputs.

For genuine private evidence, leader/destination identity and retained confidence
are already checked. A separate fresh advisory context can therefore be useful,
but must not silently replace the compatibility context used by verification
admission, instructions and parsing. Repairing all contexts could admit a call
that currently refuses with candidate mismatch, and change parsed confidence.

Result construction is another boundary:
`buildAiRerunCandidate` prefers `baselineResult.signalContext` over the newly
supplied context. Fixing optional provider advice alone will not repair retained
or persisted context. That limitation must remain explicit.

The service starts its AI count at one. The rerun stage checks the existing
configured call cap and increments before its one AI-service invocation,
including later provider refusal. The transport has its own existing retry
bound. There is no whole-call deadline in this rerun stage; advice qualification
must not be described as bounded whole-worker shutdown.

Existing adoption/rollout, conflict comparison, resilience, budget and
route/learning rules remain separate authorities.

## Existing evidence and proposed direction

The established selection witness binds exact item/result objects, typed
identity, policy/library pairs and native revision where applicable, retained
ranking/action/confidence and the loaded library pool. Limits are 64 evaluated
candidates, 64 libraries and a 16-KiB closed reference.

The initial verification adapter adds a held display label, selection-only
advice, exact profile lookup association and immutable existing display prefixes.
It applies 160-unit labels and a 16-KiB combined data cap, and omits unproven
sections without falling back to raw context or an explicit override.

It currently requires the AI call's exact signal-context object. Passing a
fresh private source alongside an unchanged compatibility context therefore
needs an explicit small handoff contract. A matching public destination is not
enough to authorize that handoff, and initial-call semantics must remain intact.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Adopted prompt-confirm optional advice/profile first | Covers the already-retargeted branch while preserving authority inputs | Non-adopted verification remains separate | Recommended first scope |
| Rebuild every verification context | Broader contextual consistency | Can change admission, parsing and provider dispatch | Separate explicit behavior batch |
| Repair retained/persisted context too | Improves downstream explanation coherence | Changes candidate construction and stored evidence | Separate contract and tests |
| Reuse pass-one fields or IDs as proof | Small change | Does not prove successful fresh evaluation or exact expanded-item binding | Reject |
| Add current-configuration reads | Can assess newer database state | Adds availability, cancellation and resource boundaries | Separate freshness decision |

Proposed stack:

1. Settle adopted prompt-confirm advice/profile as the first consumer, with
   optional omission rather than new verification refusal.
2. Hold an exact fresh source immediately after successful evaluation, before
   adoption callbacks; carry a private successful-stage handoff instead of
   inferring success from `policyAfter`.
3. Keep fresh advisory evidence separate from the unchanged compatibility
   context. Require coherent selected object/confidence before using it, with
   existing limits and post-await checks. Never copy pass-one breakdown into
   qualified material.
4. Preserve call/adoption accounting, verification authority, failure retention,
   rollout and routing/learning. Verify both adopted and excluded branches with
   real evaluator, isolated PostgreSQL and loopback provider controls.
5. Assess non-adopted verification-context and retained-result coherence
   separately before changing their authority or persistence behavior.

The operator confirmed adopted prompt-confirm optional advice/profile as the
first consumer in Q1, preserving the existing authority context and keeping
non-adopted verification/result-context repair separate. The complete contract
in the [design](rag-recheck-advice-provenance-design.md) was then confirmed in
Q2. Implementation and verification are recorded in the separate
[outcome](rag-recheck-advice-provenance-outcome.md). Add no page, endpoint, schema, setting, job, operator CLI
trigger, provider call, live configuration write, release or deployment through
this investigation.

## Official sources retrieved through MCP

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes entities, derivation
  and use. The application-specific inference is to preserve the relationship
  between the actual reevaluation and its advisory output, rather than infer
  that relationship from matching fields. No PROV protocol/conformance claim
  or new persisted provenance store is proposed.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  separates retrieved data from execution authority, recommends validated output
  schemas, and warns against treating model output as policy enforcement.
  Preserve existing provider/candidate admission and downstream action checks;
  do not add raw retrieved content to logs merely to improve traceability.
- [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
  requires deterministic permission enforcement outside prompt wording. A fresh
  source receipt is origin evidence, not instruction trust, classification
  accuracy or permission for extra calls/actions.

## Independent PR and baseline CI

Current MCP inventory contains only open
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589); uniform singleton
selection chooses it. Head `c6137f1467319a048e2d6babfe27dc6bb9859ffa`, both immutable
proposal blobs and all eleven compiler records remain identical to the
previously demonstrated failing candidate. Fresh official registry/release and
upstream issue checks establish no changed artifact. Retain its
[settled deferral](client-compiler-pr-589-outcome.md), with no new candidate-test
claim, unrelated package update or PR merge. The branch is mergeable with
unstable checks; no genuinely stale/conflicted applicable branch was established.

All seven workflows for baseline `e9c6d87d6` completed successfully, including
security scans, resource checks and the
[main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/43018675185)
that was still running at intake. Those receipts do not qualify an implementation
of this proposal.
