# Policy Automation Readiness Input Normalizer

## Status

Implemented as the bounded operational-input contract for policy automation
readiness. It normalizes routing, profile freshness, and hard-limit conflict
state before the readiness engine evaluates its small operator-facing state.

## Problem

The readiness engine already required verified evidence, intent, and learning
contracts. Routing configuration, profile freshness, and hard-limit conflict
were still received as ad hoc objects. A malformed boolean could be interpreted
as missing state, while raw connection configuration could be accidentally
copied into a readiness result or future telemetry.

## Design

```text
routing + profile freshness + hard-limit state
  -> server-side readiness-input normalizer
  -> bounded readiness-input summary
  -> readiness engine
  -> one readiness state and next action
```

The normalizer accepts only:

- `routing.configured`: boolean or absent,
- `routing.routeReady`: boolean or absent,
- `routing.targetName`: bounded display text,
- `profileFreshness.stale`: boolean or absent,
- `hardLimitConflict`: boolean or absent.

Malformed routing state becomes not-ready. Malformed freshness becomes stale,
and malformed hard-limit conflict becomes a conflict. This is conservative:
unknown operational state must not make automation look ready. API keys, URLs,
hosts, passwords, tokens, and other raw routing fields are not retained in the
normalized result or readiness summary.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side allowlist validation with syntactic and semantic
  checks. The normalizer accepts explicit booleans only and validates their
  readiness meaning before the engine proceeds.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding, masking, or sanitizing secrets and sensitive event
  data. The normalizer removes raw routing configuration and control whitespace
  before readiness output can reach logs or telemetry.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side enforcement of valid state combinations. The
  normalizer converts invalid operational combinations into conservative
  readiness blockers rather than trusting caller input.

## Recommendations

1. Send only normalized operational state to readiness calculations.
2. Treat malformed freshness and hard-limit booleans as blockers, not false.
3. Keep raw Arr connection configuration in its dedicated settings service;
   never pass it through readiness output or trace attributes.
4. Expose only summary booleans needed for a user-facing next action.
5. Continue requiring bounded evidence, intent, and learning results through
   the existing readiness wrapper.

## Pros And Cons

Pros:

- Closes the last unbounded operational-input path in readiness.
- Makes malformed state conservative and deterministic.
- Prevents connection secrets and internal URLs from leaking into readiness
  output.
- Keeps the operator surface limited to a readiness state and next action.

Cons:

- Callers that send string booleans now receive a conservative readiness state.
- Detailed connection diagnostics remain in settings/test-connection flows,
  not readiness output.

## Final Recommendation Stack

1. `policyAutomationReadinessInputNormalizer.mjs` normalizes operational state.
2. `policyAutomationReadinessEngine.mjs` combines it with bounded evidence,
   intent, and learning.
3. `policyOperatorWorkflow.mjs` projects the one readiness action to the
   operator.
4. Settings and routing services own detailed configuration and connection
   diagnostics separately.

## Security Outcome

- Readiness has no access to API keys, URLs, hosts, passwords, or tokens.
- Unknown boolean state fails closed into a review, routing, stale-profile, or
  hard-limit action rather than `ready`.
- Readiness remains side-effect free: no routing, provider, learning, profile,
  or policy write occurs.
- The output summary is intentionally telemetry-safe and contains only
  booleans and bounded target-presence information.

## Verification

Focused tests cover normal routing/freshness input, raw configuration removal,
control-whitespace normalization, malformed boolean handling, and the readiness
engine's conservative result. Existing bounded readiness tests continue to
verify upstream evidence, intent, learning, fingerprint, and quality gates.

## Next Step

Proceed to the operator workflow projection audit. It should consume the
bounded readiness result and show only the destination-oriented next action,
without surfacing raw configuration or internal engine diagnostics.
