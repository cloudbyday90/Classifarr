# Policy Builder Phase 6R Automation Readiness Engine

## Status

Implemented as the fourth Phase 6R engine contract.

This slice combines Phase 6R evidence, intent, learning, routing, and profile
freshness into one action-oriented readiness answer. It does not execute
routing, call providers, write learning, run replay, check TMDB coverage, or
expose raw scoring panels.

The compatibility reducer remains available for focused tests and internal
composition, but new runtime/rebuild callers should use the bounded readiness
entry point. That entry point requires successful Phase 6R.1 bounded evidence,
Phase 6R.2 bounded intent, and Phase 6R.3 bounded learning contracts before
readiness can be trusted. July 2026 hardening makes that gate stricter:
readiness now requires the upstream evidence, intent, evidence-fingerprint, and
learning audits to pass before automation state is evaluated.

## Problem

The previous policy-builder direction exposed too many internal diagnostics to
the operator:

```text
impact preview
replay preview
provider readiness
TMDB coverage
raw signal scoring
```

Those may be useful for maintainers or migration verification, but they are not
the product workflow. The operator needs one answer:

```text
Can automation continue, and if not, what is the next action?
```

Phase 6R.4 makes that answer deterministic and server-owned.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. Readiness is
  therefore explicit, reason-coded, and auditable instead of hidden behind
  diagnostic panels.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)
  supports secure design and verification practices. The readiness contract is
  deterministic, testable, and validates that live lookups and raw payloads do
  not become readiness dependencies.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  supports server-side validation, business-logic controls, and auditability.
  Readiness is computed server-side and rejects unsupported state shapes.
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  provides a model for structured spans, attributes, events, and status. Phase
  6R.4 keeps stable state IDs and reason codes that can later become trace
  attributes without leaking provider payloads.

## Recommendations

1. **Keep readiness small.**
   The only supported states are:
   - `ready`,
   - `needs_more_examples`,
   - `needs_operator_review`,
   - `needs_routing`,
   - `blocked_by_hard_limit`,
   - `stale_profile`.

2. **Use priority ordering.**
   Readiness should choose the highest-priority issue:
   - stale profile,
   - hard-limit block,
   - missing identity examples,
   - operator review,
   - routing,
   - ready.

3. **Use diagnostics only outside the normal product flow.**
   Replay parity, TMDB coverage, provider quota/cooldown, impact preview, and
   raw scoring panels are ignored by readiness. Migration tooling can still use
   them later if it has a separate owner, retention plan, and deletion criteria.

4. **Keep learning and readiness separate.**
   The learning guard can report blocked learning or queued profile refresh.
   The readiness engine consumes those facts but does not write learning.

5. **Return the next action with every issue.**
   The UI should not infer what to do. The server returns the state, reason
   codes, issue list, and next action target.

6. **Require bounded upstream contracts for new callers.**
   Runtime and rebuild flows should call the bounded readiness wrapper, which
   blocks failed evidence, intent, or learning handoffs and rejects missing or
   mismatched evidence projection fingerprints.

7. **Require passing upstream audits before automation readiness.**
   Matching fingerprints are not enough. Readiness should also reject bounded
   evidence, intent, or learning wrappers whose own audits are not passing.

## Pros And Cons

Pros:

- Replaces dense diagnostic panels with one action-oriented state.
- Keeps readiness deterministic and testable.
- Stops provider/TMDB/replay/scoring internals from becoming operator workflow.
- Gives Phase 6R.5 a clean UI contract.
- Keeps future telemetry stable through state IDs and reason codes.
- Prevents stale or cross-run evidence, intent, and learning results from being
  stitched together into a readiness decision.
- Prevents automation readiness from evaluating wrappers that claim success but
  carry failed upstream audit state.

Cons:

- This slice does not remove existing UI panels by itself.
- It does not execute routing or profile refresh.
- It does not persist readiness history.
- Maintainer diagnostic tooling still needs a separate migration/deletion
  decision.
- Existing pure reducer callers still exist for compatibility until runtime
  paths are moved onto the bounded wrapper.

## Final Recommendation Stack

- Evidence input:
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`
- Intent input:
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`
- Learning input:
  `server/src/services/policyBuilderPhase6LearningGuard.mjs`
- Readiness engine:
  `server/src/services/policyBuilderPhase6ReadinessEngine.mjs`
- Bounded readiness wrapper:
  `buildPolicyBuilderPhase6ReadinessFromBoundedContracts`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6ReadinessEngine.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-readiness-engine.md`
- Roadmap owner:
  Phase 6R.4 Automation Readiness Engine in
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
nextPhase
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
evidenceBoundary.projectionFingerprint
intentBoundary.statusId
intentBoundary.intentVersion
intentBoundary.projectionFingerprint
learningBoundary.statusId
learningBoundary.learningVersion
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
  provenance, mismatched projection fingerprints, and failed upstream evidence,
  intent, evidence-fingerprint, or learning audits before readiness is returned.

## Next Step

Proceed to **Phase 6R.5 Operator Workflow Rebuild**. That component should
replace old policy-builder diagnostic panels with destination-oriented sections
that consume the readiness contract directly.
