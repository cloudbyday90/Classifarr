# Policy Intent-Signal Custom Entry

Status: implemented as the non-persistent server validation boundary for a
custom native destination signal.

## Scope

This design covers the sparse-library path where the server-owned intent-signal
projection does not provide a specific enough destination value. It adds one
validation endpoint:

```text
POST /api/policies/operator-workflow/libraries/:libraryId/intent-signals/custom
```

The request accepts exactly `signalType`, `value`, and `explanation`. It
normalizes and validates those fields, adds no evidence supplied by the client,
and invokes the existing workflow reader with the resulting custom candidate.
The response is the existing display-only workflow-read projection, not a
write, preview, policy change, template attachment, provider call, quota read,
learning event, or routing operation.

The browser can only add the result after it appears in the server projection
and the operator explicitly selects it. A broad custom genre without matching
library evidence remains a disabled option with the server-provided reason.

## Official Guidance Reviewed

The following official sources were reviewed for this design, current through
June 2026:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side validation before processing, canonical Unicode
  normalization, allowlists, and explicit length bounds.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends validating input type, range, format, and expected content, as
  well as limiting request frequency for sensitive business flows.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  recommends testing server-side workflow-state validation, resource limits,
  and workflow bypass attempts.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports explicit interfaces and verification for data moving between
  components.
- [RFC 9457, Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
  distinguishes safe interface-level error details from implementation debug
  data; Classifarr retains its established `ValidationError` response format
  and avoids exposing internal stack or profile data.

## Recommendations

1. Accept an allowlisted signal type only: `genres`, `keywords`, or `studios`.
2. Require string input, reject control characters and unknown top-level
   fields, normalize text as NFKC, collapse whitespace, and enforce 160- and
   320-character limits for the value and explanation.
3. Never accept evidence, source IDs, candidate IDs, selection state, policy
   IDs, or auto-declare flags from the browser.
4. Run the custom candidate through `policyIntentSignalOptionProjection` and
   its broad-identity evidence guard before sending any selectable option.
5. Return the existing workflow-read contract so the client accepts the same
   display-only authority model used by the normal page load.
6. Rate-limit the endpoint and log rejected request codes without recording the
   submitted value or explanation.
7. Keep the custom-entry form optional and collapsed; it is an explicit
   fallback when the connected library cannot provide a sufficiently specific
   destination value.

## Pros And Cons

### Server-Validated Candidate

Pros:

- The browser cannot fabricate a custom source, counterfeited evidence, or an
  auto-declare instruction.
- One validator and one projection guard protect UI, API, and later callers.
- The custom candidate is bounded and auditable before it reaches a local
  draft.

Cons:

- A custom value requires an explanation and one validation round trip.
- An unsupported broad genre is intentionally unavailable until the library
  provides supporting evidence.

### Reusing The Workflow-Read Response

Pros:

- Avoids a second client-side response model and duplicated source semantics.
- Keeps authority, raw-payload, and side-effect checks identical to the normal
  policy-creation read.

Cons:

- The endpoint reloads bounded library-profile context before validating a
  value instead of validating entirely in the browser.

## Final Recommendation Stack

- `policyIntentSignalCustomEntry.mjs` owns request normalization, allowlists,
  bounds, custom-candidate creation, and the server-owned input contract.
- `policyIntentSignalOptionProjection.mjs` publishes that input contract,
  validates candidates through the common option-selection contract, and keeps
  a just-submitted custom candidate visible within the bounded option list.
- `policiesRouteOperatorWorkflowCustomIntentSignal.mjs` is a display-only,
  rate-limited endpoint. It loads the same library context as the workflow read,
  validates input, audits the final projection, and does not write storage.
- `usePolicyOperatorWorkflow.js` accepts only the existing display-only
  workflow response and replaces its local projection after server validation.
- `PolicyIntentCustomSignalEntry.vue` is a collapsed optional form that only
  submits input; `IntentSignalPicker.vue` still requires the explicit checkbox
  action before creating a typed local draft command.

## Verification

- Unit tests cover valid canonicalization plus unsupported types, unexpected
  fields, invalid control characters, oversized values, and missing
  explanations.
- Route tests cover malformed input without database access, rate-limit wiring,
  the no-write workflow request, and a returned projection containing the
  submitted candidate or an evidence-guarded unavailable state.
- Client tests cover API payload transport, display-only response validation,
  custom-entry form behavior, and explicit selection after a successful
  validation response.

## Outcome

Custom destination values now have an explicit but narrow path. They are not a
generic browser list and they do not bypass the library-first policy model:
Classifarr validates them server-side, explains any evidence guard, and waits
for an explicit local-draft selection before policy creation can persist them.
