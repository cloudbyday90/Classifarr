# Policy Runtime Evidence Trace Contract

## Status

Implemented as the bounded trace and warning contract for runtime evidence
projections.

This component does not classify items, call providers, route media, write
learning, or persist policy state. It derives trace reasons from sanitized
evidence entries and permits only server-owned warning records before the
runtime evidence projection is handed to automation decisions.

## Problem

The runtime evidence fingerprint previously bound the normalized evidence
entries and a summary of warning reason codes, but it did not independently
verify all outward-facing trace details. A mutated projection could replace a
warning message, remove a trace reason, or alter a trace summary count without
changing the evidence entries themselves.

That creates two risks:

- diagnostic traces can misrepresent why evidence was accepted or demoted;
- arbitrary warning or trace text can become a raw-data disclosure path.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure development practices and tracked design decisions. The
  trace contract makes its diagnostic boundary deterministic and testable.
- [NIST AI Risk Management Framework Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented, repeatable measurement and tracking of AI-system risk.
  Evidence demotion reasons remain reliable inputs to that record.
- [OWASP ASVS Logging Guidance](https://cornucopia.owasp.org/taxonomy/asvs-5.0/16-security-logging-and-error-handling/02-general-logging)
  requires useful investigation metadata while protecting sensitive data.
  Warnings and traces use fixed, bounded fields rather than caller-supplied
  messages.
- [OpenTelemetry Semantic Convention Guidance](https://opentelemetry.io/docs/specs/semconv/how-to-write-conventions/)
  recommends stable names, bounded attribute values, and opt-in treatment of
  verbose or sensitive attributes. The contract uses a small fixed attribute
  set and derived reasons.

## Recommendations

1. **Derive trace reasons from sanitized entries.**
   Do not accept a separately authored reason list. Sort and project only the
   bucket, source, runtime source, reason code, and demotion bucket.

2. **Use a server-owned warning allowlist.**
   Each warning reason maps to one exact bounded record. Unknown reasons,
   altered messages, and extra fields fail validation.

3. **Bind the complete trace attribute map.**
   Projection version, entry count, warning count, and fingerprint provenance
   attributes must exactly match the recomputed projection. Extra attributes
   are rejected rather than becoming an unreviewed disclosure surface.

4. **Keep diagnostics separate from authority.**
   Trace reasons explain projection treatment; they cannot change destination
   identity, routing readiness, learning eligibility, or final policy intent.

## Pros And Cons

Pros:

- Prevents forged warning text and missing demotion explanations.
- Keeps evidence telemetry useful without allowing raw provider data into
  trace attributes or warning messages.
- Makes trace output deterministic across equivalent input ordering.
- Preserves the existing side-effect-free projection and fingerprint APIs.

Cons:

- New warning types require an explicit server-owned definition.
- Consumers constructing projections manually must regenerate trace and
  fingerprint fields instead of editing diagnostics in place.

## Final Recommendation Stack

- Trace and warning contract:
  `server/src/services/policyRuntimeEvidenceTraceContract.mjs`
- Runtime projection integration:
  `server/src/services/policyRuntimeEvidenceProjection.mjs`
- Focused trace-contract tests:
  `server/src/__tests__/services/policyRuntimeEvidenceTraceContract.test.mjs`
- Projection regression tests:
  `server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs`
- Projection design:
  `docs/architecture/policy-runtime-evidence-projection.md`

## Implemented Contract

The trace module exports:

- `POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS`
- `POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS`
- `createPolicyRuntimeEvidenceWarning`
- `buildPolicyRuntimeEvidenceTrace`
- `buildPolicyRuntimeEvidenceTraceAudit`
- `listPolicyRuntimeEvidenceTraceReasons`

The permitted warning records are:

- `raw_payload_suppressed`
- `operator_intent_boundary_blocked`
- `no_runtime_evidence_inputs`

The projection audit rejects:

- altered or omitted trace reasons;
- unknown or modified warning records;
- changed entry or warning counts;
- missing, altered, or extra trace attributes.

## Security Outcome

- Raw provider payloads cannot be introduced through projection warnings or
  trace attributes.
- Evidence demotions remain explainable and cannot be silently removed.
- Automation receives a projection whose entries, warnings, trace reasons, and
  trace attributes are consistent with one sanitized fingerprint.
- No provider call, storage write, routing action, or classification behavior
  changes.

## Next Step

Continue with the **Automation Decision Contract** and require it to reject a
projection whose trace or fingerprint audit is not clean.
