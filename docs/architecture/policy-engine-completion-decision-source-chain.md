# Policy Engine Completion Decision-Source Chain

## Status

Implemented as the decision-source continuity check in the policy-engine
completion audit.

## Problem

Readiness, operator workflow, and migration planning each validate decision
source provenance at their own handoff. The completion audit previously proved
component audits, evidence-fingerprint continuity, quality continuity, and
sanitized provenance, but it did not prove that all three stages retained the
same approved decision source.

Without this end-to-end invariant, individually valid boundaries could be
assembled into a chain that dropped or substituted the decision source before
runtime inventory work used the completion result.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side validation of legal workflow combinations and tests
  for business invariants, rather than trusting individually well-formed
  values.
- [OWASP Web Security Testing Guide: Testing for the Circumvention of Work Flows](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/06-Testing_for_the_Circumvention_of_Work_Flows)
  recommends verifying workflow state server-side and testing attempts to skip
  or reorder required steps. The completion gate rejects a source gap or source
  substitution even when other handoff fields appear valid.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  describes outcome-based secure development practices. The decision-source
  chain provides a deterministic, testable completion criterion.
- [OpenTelemetry Context specification](https://opentelemetry.io/docs/specs/otel/context/)
  defines context propagation across logically associated execution units.
  Classifarr propagates a minimal source summary while revalidating it before
  treating the summary as completion evidence.

## Recommendation

Make source continuity a completion-gate invariant:

```text
readiness admission + summaries
             |
             v
workflow admission + summaries
             |
             v
migration source summary
             |
             v
policy-engine completion audit
```

The audit accepts the chain only when:

1. readiness has a passing admission audit and matching source summaries;
2. workflow preserves a passing admission audit and matching source summaries;
3. migration retains a valid source summary; and
4. all three stages agree on the same allowlisted source ID and decision
   version.

The completion result exposes only the verified source ID, decision version,
and admission state. It never exposes raw model output, evidence labels,
library data, or decision bodies.

## Pros And Cons

Pros:

- Converts three local protections into one release-gate invariant.
- Blocks missing, invalid, and valid-but-substituted source provenance.
- Reuses the shared source-contract validators instead of duplicating
  allowlist logic.
- Gives runtime inventory work one verified, read-only chain result.
- Keeps source data bounded and free of raw evidence.

Cons:

- Completion fixtures must include realistic source-admission handoffs.
- A future decision source needs coordinated readiness, workflow, migration,
  and completion tests.
- The audit proves contract continuity, not cryptographic or process-memory
  provenance; existing authorization and boundary controls remain necessary.

## Final Recommendation Stack

1. Allowlist source descriptors in server-owned decision producers.
2. Admit source descriptors in bounded readiness.
3. Require operator workflow to preserve the readiness admission and matching
   source summaries.
4. Require migration planning to compare that admission with workflow summaries.
5. Require the completion gate to compare readiness, workflow, and migration
   provenance before runtime work advances.
6. Return stable generic completion risks with source-specific risk IDs only as
   sanitized detail.
7. Keep the completion gate side-effect-free.

## Security And Data Handling

- Completion fails closed when a source admission or summary is absent.
- Completion fails closed when a summary is invalid or a valid summary differs
  from the admitted source.
- The check performs no network calls, policy writes, routing, storage changes,
  profile refreshes, or file deletion.
- Source data in completion output is limited to stable contract metadata.
- Existing controlled compatibility-removal services remain separate from this
  planning and verification gate.

## Implemented Files

- Completion gate:
  `server/src/services/policyEngineCompletionAudit.mjs`
- Shared source validators:
  `server/src/services/policyDecisionHandoffSource.mjs`
- Completion tests:
  `server/src/__tests__/services/policyEngineCompletionAudit.test.mjs`
- Workflow and migration source contracts:
  `server/src/services/policyOperatorWorkflow.mjs` and
  `server/src/services/policyMigrationDeletionPath.mjs`

## Verification

Focused tests prove that:

- the default completion chain reports one approved request-time source;
- a missing workflow admission fails the completion audit;
- an invalid migration source summary fails the completion audit; and
- a valid but different migration source fails the completion audit.

## Next Component

Define the runtime decision inventory entry point that consumes this verified
completion result. It should enumerate decision paths and their authority
owners without reconstructing policy-engine contracts in routes or client code.
