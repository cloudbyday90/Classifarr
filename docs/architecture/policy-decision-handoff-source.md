# Policy Decision Handoff Source

## Status

Implemented as the allowlisted source-admission contract for bounded automation
readiness decisions.

## Problem

The bounded readiness wrapper already validated evidence, intent, quality,
fingerprints, and upstream audits. It accepted any structurally similar
`boundedLearningResult`, however. A caller could construct an object that
resembled a learning result but did not originate from the request-time learning
guard or the library-rebuild no-write adapter.

This is a business-logic boundary. Readiness must know which approved contract
produced the decision before it decides whether automation may continue.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side state transitions and re-deriving
  security-relevant values. Source admission makes the decision origin an
  explicit server-side contract instead of an inferred object shape.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side syntactic and semantic allowlist validation. The
  wrapper validates a fixed source ID, descriptor version, decision version,
  no-write state, and source-specific semantics.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  emphasizes tracked security requirements, risk decisions, and verification.
  The source descriptor is small, versioned, testable, and recorded in the
  sanitized readiness boundary context.

## Recommendation

Use a neutral source contract shared by decision producers and the readiness
consumer:

```text
request-time learning guard ------------------+
                                             |
library rebuild no-write handoff ------------+-> decision-source admission
                                                -> bounded readiness
```

The readiness wrapper accepts only these durable source IDs:

- `request_time_learning` with `policy.learning_guard.v1`;
- `library_rebuild` with `policy.library_rebuild_readiness_summary.v1`.

Unknown, missing, noncanonical, or version-mismatched descriptors block
readiness before a readiness state is derived.

## Decision

`policyDecisionHandoffSource.mjs` owns the common contract:

```text
policy.decision_handoff_source.v1
  sourceId
  decisionVersion
```

The policy learning guard and library rebuild handoff construct descriptors
from fixed source IDs. They do not receive a descriptor from a client, provider,
or UI flow.

`buildPolicyAutomationReadinessFromBoundedContracts` validates the descriptor
only after the caller supplied a successful bounded decision result. It then:

1. requires an allowlisted source and exact contract versions;
2. requires `learning.writesPerformed = false` for every source;
3. requires library rebuilds to keep profile refresh and all side effects
   explicitly disabled; and
4. records only source ID, decision version, and admission status in the
   sanitized readiness boundary context; and
5. requires the bounded operator-workflow handoff to retain and revalidate that
   summary before it can render a normal workflow; and
6. requires bounded migration planning to compare the preserved workflow
   admission with both workflow source summaries before migration can continue.

## Pros And Cons

Pros:

- Prevents generic object-shaped values from reaching readiness.
- Preserves one readiness authority rather than duplicating readiness logic.
- Makes the request-time and rebuild decision paths explicit and auditable.
- Retains only stable source metadata in readiness output.
- Uses durable product terminology with no roadmap-phase names in production.

Cons:

- New bounded decision producers must deliberately register a source contract.
- A source-contract upgrade needs a focused compatibility decision.
- The contract does not prove process memory provenance by itself; it combines
  with existing boundary audits, quality checks, and fingerprint validation.

## Final Recommendation Stack

1. Treat source admission as an allowlist, never a duck-typed shape check.
2. Construct descriptors only inside approved server-owned producers.
3. Require the descriptor and decision versions to match exactly.
4. Require explicit no-write state before readiness consumes any decision.
5. Apply stricter no-refresh and no-side-effect rules to library rebuilds.
6. Keep source metadata sanitized in readiness context and telemetry.
7. Add a new source only with a focused design record, test suite, and
   compatibility decision.
8. Run the production naming regression audit so source contracts never use
   roadmap-phase terminology.

## Security And Data Handling

- No client, provider, model, UI, or route payload can choose a source ID.
- Unknown source IDs are rejected without copying the supplied value into the
  readiness result.
- Source admission does not call providers, persist policies, route media,
  refresh profiles, or write learning.
- The request-time learning result and rebuild handoff still need their existing
  audits to pass.
- Readiness and bounded operator workflow return stable risk IDs when source
  admission or source-summary continuity fails.

## Implemented Files

- Source contract:
  `server/src/services/policyDecisionHandoffSource.mjs`
- Standard decision producer:
  `server/src/services/policyLearningGuard.mjs`
- No-write rebuild producer:
  `server/src/services/policyLibraryRebuildReadinessHandoff.mjs`
- Readiness consumer:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Source contract tests:
  `server/src/__tests__/services/policyDecisionHandoffSource.test.mjs`
- Readiness integration tests:
  `server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs`
- Workflow provenance design record:
  [Policy Operator Workflow Decision-Source Provenance](policy-operator-workflow-decision-source-provenance.md)
- Migration provenance design record:
  [Policy Migration Decision-Source Provenance](policy-migration-decision-source-provenance.md)

## Verification

Focused tests prove that:

- both approved durable sources are admitted;
- unknown and noncanonical sources are blocked;
- descriptor and decision-version drift are blocked;
- performed learning writes are blocked;
- rebuild profile-refresh and side-effect drift are blocked; and
- successful bounded readiness retains only admitted source metadata; and
- bounded operator workflow requires all readiness source summaries to match
  the admitted source before it returns a normal workflow; and
- bounded migration planning requires the preserved workflow admission and both
  workflow summaries to match before it returns a migration plan.

## Next Step

Connect the policy-engine completion audit to the verified source chain, then
define the runtime workflow entry point that consumes the bounded workflow
rather than reconstructing readiness or diagnostic data in a route or client
component.
