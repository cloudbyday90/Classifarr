# Policy Automation Readiness Engine

## Status

Implemented as the durable policy automation readiness contract.

The readiness engine combines bounded evidence, intent, learning, routing, and
profile freshness into one server-owned answer:

```text
Can automation continue, and if not, what is the next operator action?
```

It does not execute routing, call providers, write learning, run replay, check
TMDB coverage, or expose raw scoring panels. The contract-only reducer accepts
validated evidence and intent contracts for focused internal composition, while
runtime callers use the bounded readiness entry point. Raw evidence is rejected
by the lower-level reducer.

## Native Creation Adoption

The native-create footer is intentionally narrower than a readiness result. It
may state only whether the operator selected a library and explicitly accepted
destination purpose in the unsaved local draft. It cannot infer routing,
provider, replay, TMDB, scoring, or automation state. The transaction-owning
server path validates and establishes native intent, and the post-create
handoff reports the resulting server-derived routing state. The implementation
and outcome are documented in [Policy Native Create Readiness
Boundary](policy-native-create-readiness-boundary.md).

Operational routing, freshness, and hard-limit input is normalized by
[Policy Automation Readiness Input Normalizer](policy-automation-readiness-input-normalizer.md)
before the engine evaluates readiness. The readiness result retains only the
small operational summary needed for a next action.

## Problem

The previous policy-builder direction exposed internal diagnostics as if they
were the normal operator workflow:

```text
impact preview
replay preview
provider readiness
TMDB coverage
raw signal scoring
```

Those diagnostics can help maintainers verify migrations, but they are not the
product decision surface. Operators need a small action-oriented readiness state
that is deterministic, auditable, and derived from already-bounded policy
contracts.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. Readiness is
  therefore explicit, reason-coded, and auditable instead of hidden behind
  diagnostic panels.
- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design, verification, and lifecycle traceability. The
  readiness contract is deterministic, testable, side-effect free, and does not
  depend on live lookups.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  supports server-side validation, workflow integrity, and auditability.
  Readiness is computed server-side and rejects unsupported state shapes.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  favor consistent names for operations and data. Readiness keeps stable state
  IDs, reason IDs, and boundary metadata that can later become telemetry
  attributes without leaking provider payloads.

## Recommendations

1. **Keep readiness small.**
   The only supported readiness states are:
   - `ready`,
   - `needs_more_examples`,
   - `needs_operator_review`,
   - `needs_routing`,
   - `blocked_by_hard_limit`,
   - `stale_profile`.

2. **Use priority ordering.**
   Readiness chooses the highest-priority issue:
   - stale profile,
   - hard-limit block,
   - missing identity examples,
   - operator review,
   - routing,
   - ready.

3. **Keep diagnostics out of the product path.**
   Replay parity, TMDB coverage, provider quota/cooldown, impact preview, and
   raw scoring panels are ignored by readiness. Migration tooling can use those
   signals only when it has a separate owner, retention plan, and deletion
   criteria.

4. **Keep learning and readiness separate.**
   The learning guard can report blocked learning or queued profile refresh.
   The readiness engine consumes those facts but does not write learning.

5. **Return the next action with every issue.**
   The UI should not infer what to do. The server returns the readiness state,
   reason codes, issue list, and next action target.

6. **Require bounded upstream contracts.**
   Runtime and rebuild flows should call the bounded readiness wrapper. It
   rejects failed evidence, intent, or learning handoffs, mismatched projection
   fingerprints, failed upstream audits, and missing or insufficient bounded
   evidence-quality snapshots.

7. **Preserve telemetry-ready names without leaking payloads.**
   Readiness should keep stable IDs and sanitized boundary context so future
   telemetry can explain automation blocks without raw labels, provider
   responses, or replay data.

8. **Normalize operational inputs before readiness.**
   Routing configuration, profile freshness, and hard-limit state must use the
   shared input normalizer. Invalid state is conservative, and raw connection
    configuration is never retained in readiness output.

9. **Separate bounded orchestration from contract reduction.**
   `buildPolicyAutomationReadinessFromBoundedContracts` is the only runtime
   entry point for raw upstream data. `buildPolicyAutomationReadinessFromContracts`
   rejects raw evidence keys and invalid contract versions.

10. **Allowlist bounded decision sources.**
    The bounded wrapper accepts only the request-time learning guard and the
    library-rebuild no-write handoff. It validates exact source and decision
    versions before readiness evaluation.

## Pros And Cons

Pros:

- Replaces dense diagnostic panels with one action-oriented state.
- Keeps readiness deterministic, server-owned, and testable.
- Stops provider, TMDB, replay, and raw scoring internals from becoming normal
  operator workflow.
- Prevents stale or cross-run evidence, intent, and learning results from being
  stitched together into a readiness decision.
- Prevents readiness from evaluating wrappers that claim success but carry
  failed upstream audit state.
- Preserves stable state and reason IDs for future telemetry.

Cons:

- This contract does not execute routing or profile refresh.
- It does not persist readiness history.
- Maintainer diagnostic tooling still needs separate migration and deletion
  decisions.
- Quality-gate failures block readiness before a normal operator action is
  produced.

## Final Recommendation Stack

- Evidence input:
  `server/src/services/policyEvidenceEngine.mjs`
- Intent input:
  `server/src/services/policyIntentEngine.mjs`
- Learning input:
  `server/src/services/policyLearningGuard.mjs`
- Readiness engine:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Bounded readiness wrapper:
  `buildPolicyAutomationReadinessFromBoundedContracts`
- Contract-only readiness reducer:
  `buildPolicyAutomationReadinessFromContracts`
- Test module:
  `server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs`
- Documentation:
  `docs/architecture/policy-automation-readiness-engine.md`
- Quality-gate hardening:
  `docs/architecture/policy-automation-readiness-quality-gate.md`
- Contract-boundary outcome:
  `docs/architecture/policy-automation-readiness-contract-boundary.md`
- Decision-source admission:
  `docs/architecture/policy-decision-handoff-source.md`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The readiness shape is:

```text
version
stateId
ready
nextAction
issues[]
reasonCodes[]
inputs
```

Each issue contains:

```text
stateId
reasonCode
sourceId
summary
nextAction
```

The input summary records:

```text
evidenceVersion
intentVersion
learningVersion
usesCachedStateOnly = true
liveProviderLookupPerformed = false
exposesRawPayload = false
diagnosticDependencies = []
ignoredDiagnostics[]
boundaryContext
```

The bounded wrapper returns:

```text
ok
statusId
boundaryContext
readiness
readinessAudit
issueCount
issues[]
nextStep
```

Supported bounded wrapper status IDs:

```text
ready
blocked_by_bounded_input
blocked_by_readiness_audit
```

The boundary context carries only sanitized contract metadata:

```text
evidenceBoundary.version
evidenceBoundary.statusId
evidenceBoundary.quality
evidenceBoundary.projectionFingerprint
intentBoundary.statusId
intentBoundary.intentVersion
intentBoundary.quality
intentBoundary.projectionFingerprint
learningBoundary.statusId
learningBoundary.learningVersion
learningBoundary.decisionSource
learningBoundary.quality
learningBoundary.projectionFingerprint
projectionFingerprintMatch
```

## Security Outcome

- Readiness does not perform writes.
- Readiness does not call live providers.
- Readiness does not expose raw provider, replay, TMDB, or scoring payloads.
- Diagnostic inputs are ignored instead of becoming hidden gates.
- Every non-ready issue carries a reason code and next action.
- The audit rejects live provider dependency, diagnostic dependency, raw payload
  dependency, missing next action, invalid state, and ready-state mismatch.
- The bounded wrapper rejects failed upstream contracts, missing projection
  provenance, mismatched projection fingerprints, failed upstream audits,
  missing bounded quality, insufficient bounded quality, and mismatched bounded
  quality before readiness is returned.
- The bounded wrapper rejects missing, unknown, noncanonical, or
  version-mismatched decision sources before it derives a readiness state.

## Next Step

Continue with **Policy Operator Workflow Architecture Cutover**. That component
should preserve consumption of the quality-gated readiness state while moving the
operator workflow design record and runtime wording to durable product-domain
language.
