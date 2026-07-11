# Policy Final Outcome Normalizer

## Status

Implemented as the shared outcome contract for the learning guard and
request-time destination workflow. It records a bounded statement of what
happened without determining learning eligibility or performing a write.

## Problem

The learning guard and request-time flow previously built similar outcome
objects independently. That allowed small differences in status, route, and
sanitization behavior to drift. In particular, an outcome must be able to say
that routing failed because mapping is missing without being mistaken for
positive destination evidence or a learning authorization.

## Design

```text
manual answer or request/routing event
  -> bounded final-outcome normalizer
  -> final outcome audit
  -> independent learning-guard eligibility decision
  -> later persistence adapter, if authorized
```

The normalizer owns a small allowlisted status vocabulary:

- `resolved`
- `routed`
- `route_failed_missing_mapping`

It normalizes bounded identifiers and text, removes carriage returns, line
feeds, tabs, unknown route fields, and unknown route reason codes, then returns
a sanitized route summary only when one was supplied. A routed status requires
a successful attempted route; a missing-mapping status requires an attempted,
unsuccessful route with `missingMapping: true`.

The result never includes learning candidates, tiers, profile refresh state, or
write claims. Those belong to `policyLearningGuard.mjs` and later persistence
adapters, respectively.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side syntactic and semantic validation with
  allowlists and bounded values. The normalizer allows only known outcome
  statuses and validates status-to-route combinations.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends sanitizing event data to prevent log injection and excluding
  unnecessary sensitive data. The normalizer removes control whitespace and
  excludes arbitrary route payloads, titles, provider data, and learning data.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side state-transition controls and a final authorization
  gate before execution. Outcome recording is a distinct state transition;
  learning and persistence must pass their own later gates.

## Recommendations

1. Use this module for every policy final-outcome producer.
2. Treat a final outcome as historical fact, not a policy or learning command.
3. Enforce semantic status-to-route validation before accepting a downstream
   learning decision.
4. Keep only bounded identifiers and route summaries; do not copy raw provider,
   media, request, or error payloads into an outcome.
5. Persist outcomes only through a later storage adapter with its own actor and
   transaction authorization checks.

## Pros And Cons

Pros:

- Removes duplicate outcome shaping from two decision paths.
- Keeps successful routing, missing mappings, and ordinary resolutions
  distinguishable and testable.
- Prevents route failures from being reinterpreted as positive evidence.
- Reduces log-injection and payload-leakage risk in future outcome storage.

Cons:

- Existing outcome producers must adopt the small shared vocabulary.
- This contract intentionally does not retain titles or raw diagnostic context;
  callers needing those details must use their appropriate bounded evidence or
  trace contract.

## Final Recommendation Stack

1. `policyFinalOutcomeNormalizer.mjs` normalizes and audits the final outcome.
2. `policyLearningGuard.mjs` decides whether any learning candidate is allowed.
3. `policyRequestTimeLearning.mjs` records request/manual/routing outcomes and
   uses the same learning guard.
4. A later native storage adapter persists only validated outcomes and approved
   commands.

## Security Outcome

- Outcome status and route transitions are allowlisted and validated server
  side.
- Final outcomes cannot carry learning eligibility, candidates, refresh state,
  or write claims.
- Route failures remain outcome-only and cannot become direct positive
  destination evidence.
- Untrusted text is bounded and control whitespace is removed before it can
  reach logs or future persistence.
- The normalizer has no database, provider, routing, learning, or policy-write
  side effect.

## Verification

Focused tests cover bounded text and route sanitization, unknown-status
fallback, routed-state validation, missing-mapping validation, and rejection of
embedded learning or write fields. Learning-guard and request-time tests verify
that their outcomes remain valid after the shared normalizer is applied.

## Next Step

Continue with the automation-readiness input contract. It should consume only
audited evidence, intent, routing, freshness, and learning outcomes, then
return one small operator-facing readiness state rather than a diagnostic
dashboard.
