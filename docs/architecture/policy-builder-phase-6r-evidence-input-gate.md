# Policy Builder Phase 6R Evidence Input Gate

## Intent

Harden Phase 6R.1 by validating the evidence input envelope before the
evidence projection builder consumes it. The gate keeps the engine offline,
deterministic, and source-bounded: raw provider payloads, live lookup markers,
provider quota/cooldown state, UI diagnostic labels, and replay/impact preview
payloads are rejected before they can become evidence.

This is not a new policy authoring surface. It is a server-side boundary check
for the evidence engine.

## Official-Source Research

- OWASP Input Validation recommends allow-list validation for structured
  inputs. Phase 6R evidence inputs therefore use a known section list rather
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
  without adopting full telemetry in this slice.

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

- makes the Phase 6R.1 input boundary auditable,
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
- keeps Phase 6R.1 deterministic and offline.

Cons:

- existing debug fixtures with raw payloads need cleanup,
- future reducers must emit bounded evidence fields instead of legacy preview
  payloads.

### Keep Authority Mapping Server-Owned

Each input section maps to a Phase 6R evidence source and a Phase 0R authority
source.

Pros:

- keeps provenance explicit,
- supports later intent/readiness engines without reinterpreting input shape,
- makes contract drift testable.

Cons:

- the input gate must be updated when new durable evidence sources are added.

## Final Recommendation Stack

Use this stack for Phase 6R.1 hardening:

1. `policyBuilderPhase6EvidenceInputGate.mjs` validates input envelope shape and
   unsafe payload markers.
2. `policyBuilderPhase6EvidenceEngine.mjs` remains the deterministic projection
   builder and projection audit.
3. Phase 6R.2 intent inference consumes projection output only after Phase 6R.1
   input and projection audits pass.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase6EvidenceInputGate.mjs`.
- Added a stable Phase 6R evidence input section vocabulary.
- Added a bounded recursive scan for unsafe keys.
- Gate issues include risk ID, section ID, and path only; raw values are not
  copied into diagnostics.
- Added a section contract audit that verifies evidence source and authority
  source mappings.
- Added focused tests for clean inputs, unsafe markers, unknown sections,
  contract drift, and read-only side-effect guarantees.

Not implemented in this component:

- no runtime classification wiring,
- no live provider calls,
- no projection builder replacement,
- no UI changes,
- no native storage writes.

## Next Step

Proceed with **Phase 6R.2 Intent Engine**. The next component should consume
only gated Phase 6R.1 evidence projections and produce bounded destination
intent suggestions without turning observed evidence or AI output into durable
policy authority.
