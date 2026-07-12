# Policy Evidence Input Gate

## Intent

Validate the policy evidence input envelope before the evidence projection
builder consumes it. The gate keeps the evidence engine offline,
deterministic, and source-bounded: raw provider payloads, live lookup markers,
provider quota/cooldown state, UI diagnostic labels, and replay/impact preview
payloads are rejected before they can become policy evidence.

This is not a new policy authoring surface. It is a server-side boundary check
for the evidence engine.

## Official-Source Research

- OWASP Input Validation recommends allow-list validation for structured
  inputs. Policy evidence inputs therefore use a known section list rather
  than accepting arbitrary top-level evidence objects.
- OWASP REST Security guidance recommends validating type, range, format, and
  rejecting unexpected content. The input gate rejects unknown sections and
  known unsafe payload markers before projection.
- OWASP Logging guidance warns against capturing sensitive or unnecessary data.
  Gate issues report section and path only; they do not copy raw provider
  payload values into diagnostics.
- NIST SSDF emphasizes provenance and secure development practices. Evidence
  input sections map to known evidence sources and authority sources so later
  engines can preserve provenance.
- OpenTelemetry Semantic Conventions promote stable names for operations and
  data. The gate keeps section and source IDs stable for future trace mapping
  without adopting full telemetry in this component.
- OWASP Denial of Service guidance recommends preventing input-controlled
  resource allocation. Every evidence input array is therefore bounded before
  recursive inspection can consume an unbounded collection.

Sources:

- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- OWASP REST Security Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OpenTelemetry Semantic Conventions:
  <https://opentelemetry.io/docs/concepts/semantic-conventions/>
- OWASP Denial of Service Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html>

## Recommendations

### Use An Explicit Evidence Input Envelope

The allowed sections are:

- `libraryProfile`,
- `operatorIntent`,
- `classificationOutcomes`,
- `manualCorrections`,
- `pendingItemAnswers`,
- `arrRoutingOutcomes`,
- `metadataEvidence`,
- `profileFreshness`.

Pros:

- makes the policy evidence input boundary auditable,
- prevents provider diagnostics from becoming evidence by accident,
- keeps future runtime integration from passing arbitrary objects into the
  projection builder.

Cons:

- new evidence sources require an explicit section addition,
- loose debug payloads now fail the gate instead of being silently ignored.

### Reject Unsafe Payload Classes Before Projection

The gate blocks:

- raw provider payload markers,
- live provider lookup markers,
- transient provider quota/cooldown state,
- UI diagnostic labels,
- replay or impact preview payloads.

Pros:

- protects the evidence contract before projection,
- avoids leaking sensitive values into gate diagnostics,
- keeps policy evidence projection deterministic and offline.

Cons:

- existing debug fixtures with raw payloads need cleanup,
- future reducers must emit bounded evidence fields instead of legacy preview
  payloads.

### Keep Authority Mapping Server-Owned

Each input section maps to a server-owned policy evidence source and authority
source. The mapping is valid only when that authority is explicitly allowlisted
by the selected evidence source; existence of both IDs alone is insufficient.

Pros:

- keeps provenance explicit,
- prevents a known authority from being relabeled as a different source's
  authority,
- supports later intent/readiness engines without reinterpreting input shape,
- makes contract drift testable.

Cons:

- the input gate must be updated when new durable evidence sources are added.

### Fail Closed On Oversized Collections

The gate accepts at most 100 entries per evidence input array. Oversized
collections report their section, path, actual count, and maximum count, while
the scan inspects only the bounded prefix for independent safety markers.

Pros:

- prevents input cardinality from controlling server resource consumption,
- preserves an actionable result rather than silently dropping evidence,
- keeps rejected values out of diagnostics.

Cons:

- upstream collectors must aggregate or page large histories before handoff.

## Final Recommendation Stack

Use this stack for policy evidence input hardening:

1. `policyEvidenceInputGate.mjs` validates input envelope shape and
   unsafe payload markers.
2. `policyEvidenceEngine.mjs` remains the deterministic projection
   builder and projection audit.
3. Policy intent inference consumes projection output only after policy
   evidence input and projection audits pass.

## Implementation Outcome

Implemented:

- Added `policyEvidenceInputGate.mjs`.
- Added a stable policy evidence input section vocabulary.
- Added a bounded recursive scan for unsafe keys.
- Added a fixed per-collection cardinality limit and a count-only rejection
  result for oversized arrays.
- Gate issues include risk ID, section ID, and path only; raw values are not
  copied into diagnostics.
- Added a section contract audit that verifies evidence source and authority
  source mappings, including source-to-authority compatibility.
- Added focused tests for clean inputs, unsafe markers, unknown sections,
  contract drift, and read-only side-effect guarantees.

Not implemented in this component:

- no runtime classification wiring,
- no live provider calls,
- no projection builder replacement,
- no UI changes,
- no native storage writes.

## Next Step

Use the evidence boundary only after the input gate passes. Oversized evidence
collections return `blocked_by_input_cardinality` before projection, quality,
or fingerprint work begins. See
[Policy Evidence Input Cardinality](policy-evidence-input-cardinality.md).
