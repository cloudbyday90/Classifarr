# Policy Builder Phase 6R Evidence Boundary

## Status

Implemented as Phase 6R.1 boundary hardening.

This slice adds a single server-owned entry point for Phase 6R evidence
projection. Callers pass the public evidence input envelope into the boundary;
the boundary validates the envelope, adapts section names into the evidence
engine input shape, builds the projection, and audits the projection before
Phase 6R.2 or later runtime work can consume it. The boundary also emits a
sanitized SHA-256 projection fingerprint so later engines can prove which
bounded evidence they consumed without copying raw evidence labels or provider
payloads into trace metadata.

July 2026 hardening adds an explicit fingerprint audit at the boundary. The
boundary now validates that the fingerprint value, trace attributes, and
sanitized provenance match the projection being returned before Phase 6R.2 can
consume the handoff.

## Problem

Phase 6R.1 already had two strong pieces:

- an input gate that rejects unsafe evidence envelopes,
- an evidence engine that creates and audits deterministic projections.

The missing piece was the safe handoff between them. Without a boundary
orchestrator, future callers could validate one shape and accidentally project
another, or bypass the input gate and call the projection helper directly.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, mapped, measured, and managed AI risk. For Classifarr,
  this means evidence needs provenance and bounded authority before it informs
  policy intent.
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  calls out provenance, source verification, and ongoing monitoring for
  generative AI systems. The boundary therefore keeps raw provider/model data
  out of the evidence contract and exposes only normalized evidence.
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
  treats untrusted model inputs as a primary LLM risk. Phase 6R.1 keeps LLM or
  provider output as data that must pass deterministic gates, not instructions
  or policy authority.
- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  warns about missing or inappropriate resource limits. The boundary performs
  no live provider calls, quota reads, writes, or background work.
- [NCSC: Prompt injection is not SQL injection](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection)
  recommends treating LLMs as confusable privileged components rather than
  assuming prompt wording creates a security boundary. The boundary keeps
  evidence authority in deterministic server code.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  encourage stable names for operations and data. The boundary preserves stable
  Phase 6R source and bucket IDs so later tracing can attach to evidence
  without exposing raw values.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends verified, traceable software changes and retained integrity
  evidence. The boundary fingerprint creates a deterministic handoff artifact
  that downstream engines can reference during tests, audits, and runtime
  diagnostics.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides verification requirements for application security controls. The
  fingerprint keeps server-side validation evidence compact while avoiding
  sensitive or untrusted raw values in diagnostic output.

## Recommendations

1. **Expose one safe Phase 6R.1 boundary.**
   Future runtime, rebuild, or policy-builder callers should use
   `buildBoundedPolicyEvidenceProjection` instead of composing
   gate and projection steps manually.

2. **Validate before adapting.**
   The public envelope is validated first. Unsafe sections, raw provider
   payloads, live lookup markers, quota/cooldown state, UI diagnostic labels,
   and replay/impact payloads block projection entirely.

3. **Adapt public section names explicitly.**
   The boundary maps:
   - `classificationOutcomes` to `classificationFinalOutcomes`,
   - `arrRoutingOutcomes` to `routingOutcomes`.

   This prevents a quiet mismatch where valid public envelope sections do not
   reach the engine projection.

4. **Audit after projection.**
   The projection audit still runs after construction so tampered or future
   unsafe projection behavior cannot pass just because the input gate passed.

5. **Keep side effects visible and false by contract.**
   The boundary reports no live provider lookup, no provider quota read, and no
   policy storage mutation. Projection construction is the only allowed action
   after the input gate passes.

6. **Emit a sanitized projection fingerprint.**
   Successful projections include a SHA-256 fingerprint plus source IDs,
   authority-source IDs, bucket counts, and trace attribute names. The
   fingerprint is computed from the bounded projection, but the returned
   provenance does not expose evidence labels, media titles, provider payloads,
   or UI diagnostic strings.

7. **Audit the fingerprint before handoff.**
   A bounded evidence result is not ready unless its fingerprint, trace
   attributes, and provenance are derived from the same projection returned by
   the boundary.

## Pros And Cons

Pros:

- Gives Phase 6R.2 one safe evidence input instead of multiple helper calls.
- Prevents public-envelope/internal-projection naming drift.
- Blocks unsafe inputs before projection builds any evidence.
- Keeps evidence projection deterministic and offline.
- Makes side-effect expectations testable.
- Gives Phase 6R.2/7R a compact correlation handle for bounded evidence.
- Avoids leaking titles or provider data into trace metadata.
- Blocks stale or tampered evidence correlation handles before downstream
  engines can consume them.

Cons:

- Adds one small service layer.
- Existing callers still need to migrate to the boundary in later runtime work.
- The boundary does not delete legacy replay or impact diagnostics by itself.
- A fingerprint proves projection equality, not semantic correctness; the input
  and projection audits remain authoritative.

## Final Recommendation Stack

- Boundary service:
  `server/src/services/policyEvidenceBoundary.mjs`
- Evidence input gate:
  `server/src/services/policyEvidenceInputGate.mjs`
- Evidence engine:
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`
- Projection fingerprint:
  `server/src/services/policyEvidenceFingerprint.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceBoundary.test.mjs`
  and
  `server/src/__tests__/services/policyEvidenceFingerprint.test.mjs`
- Roadmap owner:
  Phase 6R.1 Evidence Engine in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The boundary exports:

- `POLICY_EVIDENCE_BOUNDARY_VERSION`
- `POLICY_EVIDENCE_BOUNDARY_STATUS_IDS`
- `adaptPolicyEvidenceInput`
- `buildBoundedPolicyEvidenceProjection`

Status IDs:

- `ready`
- `blocked_by_input_gate`
- `blocked_by_projection_audit`
- `blocked_by_projection_fingerprint`

The boundary output includes:

```text
version
ok
statusId
inputGate
projection
projectionAudit
projectionFingerprint
projectionFingerprintAudit
issueCount
issues
sideEffects
nextPhase
```

## Security Outcome

- Unsafe evidence envelopes do not create projections.
- Raw provider payloads are not copied into boundary output.
- Live lookups, quota reads, and policy writes are explicitly disallowed.
- Downstream engines can consume a projection only after input and projection
  audits pass.
- The public input shape and engine projection shape now have one explicit,
  tested adapter.
- Successful projections include a deterministic fingerprint and sanitized
  provenance for trace correlation without raw evidence leakage.
- Successful projections must pass a fingerprint audit, so a stale/tampered
  fingerprint or mismatched trace/provenance data cannot pass the Phase 6R.1
  boundary.

## Next Step

Proceed to **Phase 6R.2 Intent Engine boundary alignment**. That work should
consume the bounded evidence projection result instead of raw projections, so
intent inference cannot bypass Phase 6R.1 input and projection audits.
