# Policy Authoring Draft Contract Module Cutover

Date: 2026-07-10

## Purpose

The draft authority contract has been renamed from phase-coded implementation
language to durable policy-authoring terminology. It defines which draft fields
represent declared intent, compatibility metadata, transient UI state, or
read-only server projections, and therefore prevents client projections from
becoming policy authority by accident.

## Official Research Inputs

- OWASP Business Logic Security Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Treat every client-provided draft field as untrusted until server validation
   applies its known authority and persistence rules.
2. Allow only declared operator intent to become a native intent candidate.
3. Keep compatibility metadata, UI state, and server read projections out of
   native persistence and legacy serialization unless explicitly allowed.
4. Represent prohibited responsibilities explicitly so draft state cannot create
   evidence, learn, route, or accept migrations.
5. Keep field semantics in durable product vocabulary rather than implementation
   phase names.

OWASP recommends recomputing security-relevant values on the server and
validating all client data syntactically and semantically. The contract keeps
that distinction executable: the client can propose intent, but server
boundaries decide authority, persistence, and side effects.

## Tradeoffs

Pros:

- Field authority remains clear after the roadmap closes.
- Downstream boundary services consume the stable draft-field adapter.
- Audit coverage makes unsafe persistence and authority drift fail closed.

Cons:

- The compatibility bridge remains necessary until native storage conversion is
  complete.
- Supporting vocabulary code still needs its own bounded cutover.

## Implemented Outcome

- Renamed the service to
  `server/src/services/policyAuthoringDraftContract.mjs`.
- Renamed the focused test to
  `server/src/__tests__/services/policyAuthoringDraftContract.test.mjs`.
- Renamed the design record to
  `docs/architecture/policy-authoring-draft-contract.md`.
- Replaced phase-prefixed field, authority, mapping, risk, audit, and helper
  names with durable policy-authoring terms.
- Updated `policyAuthoringDraftFieldContract.mjs` to re-export the durable
  contract directly, preserving its intentionally narrow consumer API.
- Preserved immutable field records and fail-closed authority, compatibility,
  read-only projection, raw-legacy-term, and prohibited-responsibility audits.

## Verification

Focused verification:

- `server/src/__tests__/services/policyAuthoringDraftContract.test.mjs`
- Draft command, view projection, and server authority preparation tests that
  consume the draft-field adapter.

Supporting verification:

- policy-builder production-name inventory;
- documentation lint; and
- Git whitespace check.

## Next Component

Cut over the policy authority vocabulary service and focused test. It supplies
the authority levels and sources used by the draft contract and remains the
next direct producer of phase-coded authority terminology.
