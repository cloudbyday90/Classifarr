# Retained adopted result context investigation

November 14, 2026 (America/New_York). Read-only findings at main
`fdde1000f1072ad693e7b319bb082ed5e972bd12`; runtime implementation has not begun.
The user confirmed the first consumer: new adopted prompt-confirm policy
candidates should own a proven fresh minimal result context or explicit absence,
and should not inherit the earlier candidate's AI advisory.

## Reproduction and cause

The production `buildPolicyRecheckCandidate` helper reproduces this result using
synthetic objects, without database or provider calls:

| Field | Observed value |
| --- | --- |
| New selected library | B / 202 |
| Retained outcome confidence | 80 |
| Fresh policy overall confidence | 75 |
| Fresh leading policy score | 70 |
| Result context's suggested library | Earlier A / 101 |
| Result context's confidence | Earlier 80 |
| Earlier nested signals and advisory | Still retained |
| Restrictive authority | Preserved |
| Candidate-bound verification status | Explicit null |

`buildFreshSecondPassBaseResult` spreads the original result. The policy candidate
builder replaces the selected library, method and policy result, and clears
inherited verification status for prompt-confirm, but retains `signalContext`
and `ai_advisory`. Ordinary verification skips and genuine failures return that
same candidate. The prior batch repaired the independent saved review frame;
it deliberately left these two result fields for this follow-up.

Fulfilled adopted verification already uses its actual minimal invocation context
and current advisory or explicit absence. Non-adopted verification has a separate
private owner. Those paths are compatibility controls for this batch.

## Consumers and boundaries

Persistence prefers top-level `result.signals`, then nested
`result.signalContext.signals`, for `signals_json`. It likewise prefers top-level
`result.ragContext` over nested `result.signalContext.ragContext` for RAG details.
Replacing the inherited nested context can remove those fallback observations.
It does not justify removing independently supplied top-level evidence.

The bounded AI-advisory projection affects pending presentation and answer
fingerprints. The saved current-policy frame independently supplies recommendation,
score, cards and comparisons. Removing an earlier advisory must not reinterpret
the policy frame as an AI confirmation or suppress a current fulfilled outcome.

Restrictive `ai_authority.sideEffects.canRoute:false` is a routing prohibition.
It must remain intact. Outcome maximum-confidence behavior, policy selection,
scoring, comparison/rollout, provider observations and invocation charging remain
separate. Historical records are not reconstructed or rewritten.

The existing numeric source proves the loaded evaluation and exact item/pool/
candidate association. It does not add a database freshness lease. Optional
prompt advice/profile, AI invocation authority and saved-review diagnostics have
their own lifetime and refusal rules; context cleanup cannot grant their authority.
Context validation lifetime and late-proof-loss behavior remain design decisions.

## Official research

Sources were rediscovered and read through GitHub/web MCP on November 14.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes actual input usage,
completed output generation and derivation. Coexisting inputs and outputs alone
do not establish derivation. For this application, a successful policy evaluation
can coexist with skipped or failed optional AI advice; that is not an AI decision.
This is an application-specific inference, not a W3C status enumeration.

[OWASP output handling](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Decisions_And_Output_Handling_Cheat_Sheet.html)
requires correspondence with the relevant request/context and controlled reuse.
[OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
requires server-side enforcement. Their safe-failure guidance concerns permission;
it does not independently require rejecting classification when optional advice
is unavailable. Provenance and advisory presence cannot authorize routing.

## Options and recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep inherited fields | No result change | Context can describe A after B is adopted |
| Clear both fields unconditionally | Removes earlier advice | Discards usable current policy context |
| Genuine minimal policy context or null; clear inherited advisory | Keeps useful current policy mechanics with explicit absence | Requires a precise ownership/lifetime boundary and changes some saved fallbacks/fingerprints |

Recommended stack: successful live evaluation, private exact candidate binding,
minimal current policy context or explicit null, current advisory or absence,
existing final selection and saved-frame validation, then ordinary persistence
and completed-answer replay. Keep AI permission, actual provider outcome and
routing/learning authorization distinct. Lifetime details are settled separately
before implementation.

## PR intake

At 13:00 UTC / 8:00 a.m. Eastern, the current open-PR collection is empty. There
is no eligible random PR or applicable stale Dependabot branch to adopt or rebase.
Closed PRs are not reused. This does not block the primary result-ownership task.
