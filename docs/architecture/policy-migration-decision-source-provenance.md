# Policy Migration Decision-Source Provenance

## Status

Implemented as the bounded migration-planning provenance gate for policy
decision sources.

## Problem

The migration/deletion wrapper already required a successful bounded workflow,
matching evidence provenance, passing workflow audit, and usable quality. It
did not carry the workflow's approved readiness source-admission result,
however. A reconstructed workflow result could therefore omit or substitute
the upstream decision source before migration planning started.

Migration planning is a state-changing control boundary even though this
component does not delete files or mutate storage. It must know which approved
decision source allowed the workflow to exist before it can prepare a deletion
plan.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side workflow state validation and testing the invariants
  that prevent skipped or reordered steps. Migration planning revalidates the
  upstream source instead of trusting a workflow-shaped input.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  distinguishes semantic validation from simple format validation. The gate
  verifies legal source, decision-version, and admission combinations across
  the complete handoff.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends defined security requirements and verification throughout the
  lifecycle. The source chain is a focused, versioned requirement with tests
  for missing and mismatched provenance.
- [OpenTelemetry Context specification](https://opentelemetry.io/docs/specs/otel/context/)
  defines context as propagation of execution-scoped values across boundaries.
  Classifarr propagates a minimal source summary, but treats propagated context
  as input that must still be validated before it authorizes planning.

## Recommendation

Preserve the original approved readiness admission in a successful bounded
workflow result, then require it to agree with both workflow-context summaries
before migration planning continues:

```text
readiness admission audit
          |
          +--> bounded workflow result
          |        |
          |        +--> workflow boundary source summary
          |        +--> embedded workflow source summary
          |
          +--> bounded migration plan
                    |
                    +--> sanitized migration source summary
```

The migration plan retains only:

```text
sourceId
decisionVersion
admitted
```

The plan blocks when the admission is absent or non-passing, either workflow
summary is unapproved or incompatible, or the summaries do not match the
admitted source. Plan validation re-audits the retained summary before a later
consumer can use the plan.

## Pros And Cons

Pros:

- Completes the source-provenance chain from readiness through workflow to
  migration planning.
- Prevents a workflow-shaped object from hiding an unapproved decision source.
- Retains one shared source-contract validator instead of reimplementing
  allowlist logic in the migration service.
- Keeps migration planning read-only and free of raw evidence, decision, model,
  provider, or media-library data.
- Produces stable, source-specific risk detail behind a migration-domain risk.

Cons:

- Future bounded workflow producers must preserve the approved admission audit.
- Source-contract upgrades require coordinated producer, workflow, and
  migration tests.
- This is contract continuity rather than cryptographic provenance; existing
  evidence, intent, learning, readiness, workflow, authorization, and rollback
  gates remain necessary.

## Final Recommendation Stack

1. Create source descriptors only in allowlisted server-owned decision
   producers.
2. Admit those descriptors in bounded readiness.
3. Require bounded workflow construction to preserve the successful admission
   audit and verified source summaries.
4. Require bounded migration planning to compare the admission audit with both
   workflow contexts.
5. Retain only the verified summary in migration-plan boundary context.
6. Revalidate the retained summary before later migration consumers use it.
7. Keep file deletion, storage mutation, and routing outside this read-only
   planning component and behind their existing dedicated controls.

## Security And Data Handling

- No UI, route payload, provider, model, or media server chooses the admitted
  source.
- Invalid source data is not copied into the migration plan.
- The component makes no provider calls and performs no policy, routing,
  profile-refresh, storage, or file-deletion side effect.
- Existing controlled compatibility-removal services remain the only mechanism
  that prepares and applies a reviewed file-removal batch.
- Validation fails closed for absent, altered, or mismatched source provenance.

## Implemented Files

- Source contract:
  `server/src/services/policyDecisionHandoffSource.mjs`
- Bounded workflow propagation:
  `server/src/services/policyOperatorWorkflow.mjs`
- Bounded migration consumer:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Workflow tests:
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`
- Migration tests:
  `server/src/__tests__/services/policyMigrationDeletionPath.test.mjs`

## Verification

Focused tests prove that:

- successful bounded workflow results retain the approved admission audit;
- migration planning retains the verified source summary;
- missing workflow admission blocks migration planning;
- valid but different workflow source summaries block migration planning; and
- a tampered source summary in a returned plan fails plan validation.

## Next Component

The completion gate now consumes this source chain; its outcome is documented
in [Policy Engine Completion Decision-Source Chain](policy-engine-completion-decision-source-chain.md).
Next, define the runtime decision inventory entry point that consumes the
verified completion result.
