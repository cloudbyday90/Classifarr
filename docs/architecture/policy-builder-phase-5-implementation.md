# Policy Builder Phase 5 Implementation

Status: in progress
Scope: server-side policy intent contract, read-only compatibility projection

## Goal

Phase 5 makes policy intent a server-owned contract instead of only a client UI
projection. The first slice does not add database storage and does not change
classification scoring. It validates the contract that is already derived from
legacy preset-backed policies.

The contract must answer:

```text
What intent does the server believe this policy expresses?
Is that intent complete, partial, or empty?
Which fields are safe for the client and future runtime logic to consume?
```

## First Implemented Component

The first implemented component adds schema validation for the read-only intent
contract:

1. Add `server/src/services/policyIntentSchema.mjs` as the canonical schema
   boundary for Phase 5 contract metadata, roles, collections, signal types,
   operators, and validation rules.
2. Keep `server/src/services/policyIntentContract.mjs` responsible for mapping
   legacy preset/configuration-view state into the contract.
3. Add `validation` metadata to each generated `policy_intent_contract` so
   client and future server consumers can distinguish valid, warning-only, and
   invalid contract shapes.
4. Enforce the first server-side semantic boundaries:
   - `purpose` uses identity-capable signals only,
   - `hard_limits` require strict constraints,
   - `helpful_hints` cannot be strict,
   - `avoid` entries should be exclusion-shaped.
5. Keep unsupported legacy preset signals represented as partial inference
   warnings, not fatal policy loading errors.

## Research Inputs

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html):
  OpenAPI exists so clients and servers can understand an HTTP API without
  guessing from implementation details. Phase 5 follows that principle by
  making policy intent response shape explicit and versioned.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  structured data should be validated with allow-listed expected values. Phase
  5 uses explicit enums for sources, inference states, roles, signal types,
  operators, constraint modes, and semantics.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html):
  REST APIs should validate content and avoid trusting client-controlled data.
  The first Phase 5 slice validates the server-generated read contract before
  later phases use it for writes or runtime decisions.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework):
  AI-adjacent systems need governance, traceability, and measurable controls.
  The intent contract validation is a traceable control between UI intent,
  server policy state, and later runtime AI/question behavior.

## Recommendation Stack

- Keep the first server-side intent contract read-only and additive.
- Validate the server-generated contract before clients or runtime services rely
  on it.
- Keep mapping and validation in separate ES modules:
  - mapper/contract projection owns legacy interpretation,
  - schema validation owns supported contract shape and semantic boundaries.
- Treat unsupported legacy preset data as `partial` inference with warnings
  unless it makes the generated contract itself invalid.
- Keep validation output bounded and non-sensitive. Do not include raw preset
  JSON, prompts, API keys, item metadata, or route traces in validation errors.
- Do not add native intent storage until the read contract is stable and impact
  preview can compare legacy versus native behavior.

Pros:

- Reduces client/server semantic drift without a database migration.
- Gives future Phase 5B/5C runtime question work a stable server-owned intent
  source.
- Makes partial legacy inference visible instead of silently pretending every
  preset maps cleanly.
- Keeps existing policies loadable even when legacy signals are unsupported by
  the new intent model.

Cons:

- The contract is still inferred from legacy preset/custom-signal storage.
- Validation metadata is additive, but clients must avoid treating it as a save
  blocker until server write validation exists.
- The first validator is intentionally conservative and may need new supported
  signal/operator enums as more policy concepts become first-class.

## Validation

Schema validation:

```bash
npm --prefix server test -- policyIntentSchema.test.mjs policyIntentContract.test.mjs
```

Focused policy route validation:

```bash
cd server && npx jest --testPathPatterns="policies-routes.coverage.test.mjs" --no-coverage
```

## Next Work

The next Phase 5 slice should add a policy intent mapper module or route-level
contract projection helper so read/create/update routes do not need to know the
composition details. That keeps the write/read routes thin before runtime
clarification logic starts depending on the contract.
