# Neutral destination advice when AI recovery has no suggestion

Research: November 10, 2026 Eastern. Baseline main
81ad2f96060d4b40232c9d2345d80ec3fa8b2379. Status: agreed; the operator confirmed
the complete scope before implementation. Work stays on main, without release,
deployment or live configuration changes.

## Observed behavior and reachability

`classificationPathServiceShared.buildAiUnavailableResult` has three branches:

| Existing condition | Existing result | Proposed treatment |
| --- | --- | --- |
| Transient availability, or normalized confidence below 50 | Existing NULL-destination retry result | Preserve exactly |
| Otherwise, a truthy suggested library with confidence at least 50 | Existing signal-calculation advice requiring review | Preserve as a separate contract |
| Otherwise, no suggested library | Last array entry, confidence 50, method fallback | Return NULL with neutral review wording |

The final branch reads `fallbackLibrary.name`, so an empty array also throws.
The two production owners are the legacy signal and policy classification paths.
Their catches include post-provider RAG/question finalization failures; they are
not restricted to network transport errors. Preserve this existing error boundary.

This is a demonstrated helper state, not proof of live frequency or causation.
The normal legacy calculator returns confidence zero without a top library, so
ordinary no-signal failures already queue retries. Policy context derives its
confidence and ranked-library lookup separately; missing/mismatched bindings can
leave a high diagnostic score without a suggested object. Investigating that
separate binding is a follow-up, not a reason to manufacture a default destination.
Production loading already refuses zero active libraries; empty-pool handling
here is defensive helper behavior, not a newly established live workflow.

## Proposed complete first batch

Use a small pure ESM result leaf for only the final no-suggestion fallback.
Return `library: null`, the existing confidence 50, method `fallback`, supplied
libraries and fixed wording explaining that AI is unavailable and an explicit
destination selection is needed. Do not embed a guessed name or raw error text.
Keep the trusted `provider_recovery.v1/review_required` projection supplied by
the current wrapper. Add no question, proof protocol or copied suggestion.

Let the existing nonretry wrapper call `ensureDecisionQuestion`, which builds
and normalizes the current choices and sets clarification state. Preserve its
media/activity filters, order, caps, valid independent policy reference and
native question semantics. Unscored list positions cannot become a shared
primary reference; normalization discards the old builder's first-option anchor.
This does not suppress an independently valid policy reference or reinterpret
the separate signal-calculation suggestion as newly verified evidence.

Preserve confidence normalization, the retry predicate, error classification,
catch breadth, logging, all retry producer arguments/results and the entire
suggested-library branch. Transient and low-confidence results still bypass
question construction and retain the existing five-minute retry delay, retry
count/default-three limit and provider-deferral treatment. In particular, this
does not change the current low-confidence retry of a non-transient failure.

No new provider call, SQL, timer, attempt, concurrency scope, timeout, cooldown
or scheduler admission is introduced. Provider admission, ownership, cancellation,
configuration checks, quotas, unknown-side-effect handling and existing request/
repair bounds remain with their current owners. A pure projection has no durable
state to recover after a crash. Do not replay or refund an uncertain operation.

Fallback stays awaiting decision; retries stay pending retry with their existing
durable fields. Preserve authorized destination resolution, exact completed
replay and stale-state refusal. Do not regenerate historical advice or receipts.
NULL does not create routing or learning permission. The core's missing-library
diagnosis will truthfully become `no_library`; destination-specific threshold/
administrative diagnostics can disappear, while the shared route-safety primary
remains provider recovery review required. Test those observable distinctions.

Add no schema, endpoint, field/version, UI control, setting, job, operator CLI
trigger, historical inference or live database write. Operators continue using
the existing application controls and automatic retry process.

## Verification and delivery

Freeze the old last-entry and empty-array failures before claiming a fix.
Check display-name/order invariance, one/empty pools, confidence 49/50, transient
and non-transient failures, retained signal advice, exact retry arguments and
trusted recovery/routing refusal. Exercise both production owners and existing
mode/repair/cancellation safeguards without additional provider permission.

Use real loopback HTTP and the production database factory against disposable
PostgreSQL for NULL pending persistence, explicit selection, stale/inactive
refusal and exact replay. Preserve completed-row constraints. Verify existing
web/Discord choice presentation, missing-library diagnostics and genuine policy
references independently; do not confuse an unscored choice with a recommendation.

Run fresh backend coverage and affected lint/type/dependency, ownership, policy,
ESM, audit, Markdown and coverage-ratchet gates. Reuse client coverage/build
evidence only after verifying unchanged relevant source, installed graph and
reports; otherwise regenerate it. Run affected browser checks with unchanged
assertions/deadlines. Preserve scanner classifications, installation policy,
review limits and security findings. Maintain only verified stale local artifacts,
preserving current evidence and recovery assets.

Record observed outcomes separately, update Unreleased, commit/push all agreed
changes on main and inspect the exact code commit's CI. No release or deployment.
The only open PR remains 589 at the already assessed compiler head; retain its
settled deferral unless a genuinely changed artifact supplies new evidence.
Rebase only a genuinely stale applicable Dependabot branch.

## Official guidance retrieved through MCP

- [AWS retry/backoff guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  distinguishes transient retry from non-transient refusal and calls for safe
  repeated side effects. Preserve the existing retry owner; a missing destination
  does not justify an extra retry layer or replay of an uncertain write.
- [Amazon's timeout/retry discussion](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter)
  explains retry amplification and the limits of timeout evidence. This batch
  adds no network work or new shutdown guarantee; existing bounds remain intact.
- [W3C labels/instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
  supports sufficient guidance without unnecessary clutter. Reuse existing
  destination controls with neutral wording; add no new panel or full WCAG claim.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  supports explicit request permissions and default refusal. Keep route/learning
  authorization separate from advice, including advice retained from policy.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Neutralize only the final no-suggestion branch | Removes a positional guess and defensive empty-array throw with existing workflows | Does not verify the separate signal suggestion or fix every classification issue | First batch |
| Expand to signal-suggestion provenance now | Could establish why retained advice is trustworthy | Adds binding/eligibility decisions and a wider behavior boundary | Separate follow-up |
| Queue every provider failure again | Might recover some transient cases | Changes attempt authority and can repeat permanent/uncertain work | Exclude |
| Keep a last/name-selected default | Minimal change | Order/name supplies no destination evidence | Reject |

First qualify this NULL recovery fallback. Then inspect the separate policy-signal
suggestion's binding and provenance, using an explicit contract if facts justify
one. Retain PR 589's demonstrated compiler deferral and qualify known runtime
security gaps before any later publication. Do not claim this branch caused the
recent live requests or that removing it proves classification accuracy.
