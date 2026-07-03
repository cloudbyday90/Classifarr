# Policy Evidence Engine Diagnostics Cutover

## Context

The policy evidence engine had already been renamed to the durable
`policyEvidenceEngine.mjs` module, but several production diagnostics and
reducer cutline targets still described the contract as Phase 6R evidence.
Those messages can appear in audits, test output, and operator-facing
diagnostics long after the roadmap phase is gone.

This cutover keeps behavior unchanged and removes phase-coded wording from the
evidence engine's production diagnostics.

## Official Guidance Reviewed

- NIST Secure Software Development Framework:
  https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP Application Security Verification Standard:
  https://owasp.org/www-project-application-security-verification-standard/
- OWASP Logging Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OpenTelemetry semantic convention naming:
  https://opentelemetry.io/docs/specs/semconv/general/naming/

## Recommendations

1. Use durable product-domain names in validation messages, warnings, and
   reducer cutline targets.
2. Keep exact risk ids stable so tests and downstream checks continue to reason
   over deterministic machine-readable fields.
3. Treat phase labels as roadmap history only; production diagnostics should
   describe the current contract, not the implementation phase that created it.
4. Keep the change side-effect-free: no provider calls, storage writes, routing
   changes, or compatibility aliases.

## Pros

- Removes stale roadmap terminology from evidence-engine audit output.
- Keeps diagnostics meaningful after the roadmap phase is complete.
- Preserves existing risk ids and behavior, so downstream consumers do not need
  a compatibility shim.
- Tightens the production naming regression baseline.

## Cons

- Historical docs still reference Phase 6R where they describe the original
  work sequence. Those are intentionally classified as docs history.
- Other production services still contain phase-worded diagnostics and need
  separate bounded cutovers.

## Final Recommendation Stack

- Server diagnostics:
  `server/src/services/policyEvidenceEngine.mjs`
- Focused test:
  `server/src/__tests__/services/policyEvidenceEngine.test.mjs`
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`
- Naming inventory:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Outcome

- Replaced phase-coded reducer replacement targets with policy-evidence and
  native-storage terms.
- Replaced phase-coded validation messages with policy evidence contract terms.
- Preserved evidence bucket ids, source ids, risk ids, contracts, and projection
  behavior.
- Verified the focused evidence-engine suite, naming regression suite, docs
  lint, security lint, inventory validation, and full server unit suite after
  the message cutover.

## Next Step

Continue the production diagnostic cleanup with the next highest-value
phase-worded runtime service, prioritizing messages that can appear in operator
or audit output.
