# Adopted select result-context investigation

November 14, 2026 (America/New_York). Read-only findings at main
`4f0fc62de1cffa908bea8eb305619dcf27d64292`. The previous select-review batch is
complete; these pre-change findings address its separately deferred result
ownership. Shared scope was confirmed before implementation. See the
[agreed design](adopted-select-result-context-design.md) and separate
[observed outcome](adopted-select-result-context-outcome.md).

## Reproduced mismatch

Production builder, adoption gate, comparison, resolution, apply and route-safety
helpers reproduce the following with synthetic data and no provider/database
call:

| Field | Retained select result |
| --- | --- |
| Adopted destination | Current B / 101 |
| Outcome confidence | 80 |
| Current policy overall confidence | 75 |
| Context destination and leader | Earlier A / 2001 |
| Context confidence | Earlier 80 |
| AI advisory destination | Earlier A / 2001 |
| Nested context signals | Earlier evidence |
| Candidate-bound verification | Null |
| Current top-level RAG | Preserved |
| Restrictive route/learning authority | Preserved |
| Automatic routing | Blocked |

The current saved review frame already uses B's evidence, with selection required
and no primary or bulk confirmation shortcut. The remaining mismatch belongs to
the returned candidate's context/advisory. Shadow mode preserves the original
baseline, as expected.

## Existing owner and consumer trace

`classificationRagLoopStages.mjs` captures result-context proof immediately after
successful reevaluation, before adoption callbacks. After the existing gate
constructs the actual candidate, it applies that proof independently of review,
invocation and optional-advice associations. The existing AI-stage select short
circuit returns the candidate without generation or profile lookup.

`classificationRagLoopServiceShared.mjs` clears inherited verification status for
both pending policy actions, but clears context/advisory only for prompt-confirm.
`adoptedRagResultContext.mjs` likewise admits only prompt-confirm. Its existing
single-use numeric proof and construction checks already fit select. Extending
this leaf avoids duplicating an equivalent source owner or growing orchestration.

The full context is not serialized. However, removing its earlier nested
`signals`, RAG and related-evidence summary removes existing fallback inputs in
`classificationPersistenceService.mjs` and question construction in
`classificationRoutingServiceShared.mjs`. Explicit top-level signals/RAG retain
their current precedence and values. Clearing a persistable inherited advisory
removes its legacy decision-summary notice and changes new answer fingerprints
and Discord custom IDs. The v2 review reference and explicit candidate permission
remain independently sourced.

## Lifetime and limits

The existing result-context leaf makes a construction-time guarantee. Its frozen
outer context contains exact loaded ranking/library references; those references
remain mutable. The 64-candidate / 64-library / 16-KiB limits bound the closed
numeric witness, not every detail reachable through ranking rows.

A later mutation may leave construction-owned context populated while the saved
review frame correctly becomes a gap. Extending lifetime validation would require
distinct terminal/copy/writer ownership rules. It is a separate behavior choice,
not an implied part of clearing inherited fields.

## Official research

Sources were rediscovered and opened through MCP on November 14, 2026.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes entities, actual input
usage and generated output. The application-specific inference is that inherited
data alone cannot establish what the new policy evaluation used or produced.

[OWASP decision/output handling](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Decisions_And_Output_Handling_Cheat_Sheet.html)
supports binding decisions and reuse to the relevant request/context.
[OWASP policy/data distribution](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Policy_And_Data_Distribution_Cheat_Sheet.html)
addresses authoritative inputs and freshness. This proposal preserves existing
server authorization; a context association supplies neither AI permission nor
routing/learning authority. Its loaded-snapshot proof is not a fresh database
configuration lease.

[WAI labels/instructions guidance](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
and [predictable input behavior](https://www.w3.org/WAI/WCAG22/Understanding/on-input)
support preserving understandable destination controls and deliberate submission.
These explanatory WCAG resources do not require another confirmation ceremony.
The existing explicit-choice interface remains; browser checks provide scoped
evidence rather than a claim of full accessibility conformance.

## Options and recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep inherited support | No changed fingerprints | Current B can retain A's context/advisory |
| Always clear both fields | Simple explicit absence | Discards genuine current numeric support |
| Fresh proven minimal context or null; no inherited advisory | Current attribution with useful support | New fingerprints, fewer nested fallbacks, construction-only lifetime |

Recommend the third option through the existing small leaf. Preserve outcome
confidence, top-level evidence, restrictive authority, zero select verification
calls, saved-frame validation and all comparison/rollout rules. Historical rows,
automatic actions and continuing context validation stay separate.

## PR intake

At 16:19 UTC / 11:19 a.m. Eastern, the current GitHub open-PR collection is empty.
There is no eligible random PR or applicable stale Dependabot branch. Closed PRs
are not reused; recheck at delivery.
