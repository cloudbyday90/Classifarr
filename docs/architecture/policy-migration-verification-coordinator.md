# Policy Migration Verification Coordinator

## Status

Implemented for Phase 6R.6 Task 6R.6.3.

This record defines the server-only coordinator that connects an accepted
library-rebuild proposal to persisted representative classification collection
and bounded migration verification. It is a non-writing orchestration boundary:
it does not create a rollback snapshot, replace a policy, route media, write
learning, or expose a browser control.

## Problem

The accepted rebuild transition, representative-classification source, and
migration verifier were intentionally separate contracts. Passing samples among
them at arbitrary call sites would create three risks:

- an unaccepted, expired, or mismatched rebuild could trigger history reads;
- an insufficient or tampered source result could be treated as verifier input;
- a completed comparison could be mistaken for authority to replace policy
  state or delete legacy paths.

The coordinator supplies one narrow sequence:

```text
validated rebuild proposal
  + current accepted rebuild transition
  -> persisted representative source
  -> source audit and explicit coverage gate
  -> bounded verifier and verifier audit
  -> sanitized verification result
```

Every non-ready dependency stops the sequence before the next stage. A ready
coordinator result means only that the comparison ran with verified inputs. It
does not mean parity, replacement, deletion, or rollback-snapshot authority.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default, least privilege, and validating authorization at
  each resource boundary. The coordinator derives policy and library IDs from
  the validated acceptance transition, not caller-provided context, and does
  not collect samples until acceptance is current and explicitly permits
  migration verification.
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
  recommends least-privilege database access. The coordinator has no database
  statements, delegates only to the read-only bounded source adapter, and
  represents the database read as its sole allowed side effect.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends small, quality-gated steps that halt on detected issues. Source
  validation, coverage sufficiency, and verifier validation are independent
  quality gates; failures do not fall through to later work.
- [Microsoft Well-Architected secure development lifecycle guidance](https://learn.microsoft.com/en-us/azure/well-architected/security/secure-development-lifecycle)
  recommends minimizing custom attack surface and enforcing security checks in
  delivery workflows. The coordinator reuses the established acceptance,
  source, and verifier contracts instead of duplicating their validation or
  adding a new route, provider client, or persistence path.

## Options Considered

### 1. Let every caller invoke the source and verifier directly

Pros:

- No coordinator module.
- Individual call sites can choose their own execution order.

Cons:

- Easy to bypass current acceptance, source audit, or coverage boundaries.
- Leads to inconsistent handling of unavailable data and verification failures.
- Makes later persistence and replay protection difficult to centralize.

### 2. Add a browser-run verification command

Pros:

- Could make diagnostics visible during development.

Cons:

- Reintroduces a manual policy-builder workflow the destination-first design
  is eliminating.
- Browser state is not an authority boundary and should not transport internal
  sample data.
- Creates a UI/API surface for a migration-only operation.

### 3. Make the coordinator perform replacement or snapshot writes

Pros:

- Fewer apparent stages.

Cons:

- Combines validation and irreversible work, increasing blast radius.
- Violates the existing rollback and replacement gate separation.
- Makes insufficient coverage and review-required results unsafe to handle.

### 4. Add a server-only, fail-closed verification coordinator

Pros:

- Uses accepted transition context as the single authority source.
- Stops before verification on source failure, source-audit failure, or missing
  representative coverage.
- Prevents raw sampled records from escaping the coordinator result.
- Keeps replacement, deletion, routing, and all storage writes disabled.

Cons:

- Adds a small orchestration and audit contract.
- Requires a later persisted verification-run handoff before the snapshot gate
  can consume the report automatically.

## Final Recommendation Stack

1. Validate the rebuild proposal and current acceptance transition before any
   history read; derive policy and library IDs from that transition only.
2. Invoke the read-only representative source with a fixed, sanitized context.
3. Audit source output before using it; map no coverage to an explicit stop
   result and all other source failures to a fail-closed stop result.
4. Pass source samples only in process memory to the existing bounded verifier.
5. Audit the verifier report before returning it; suppress invalid reports.
6. Return source counts, compact provenance, audit summaries, and a validated
   verifier report, but never raw representative samples.
7. Declare all replacement, deletion, routing, learning, rollback, and storage
   mutations disabled; hand off to a later persisted execution contract.

## Implementation Outcome

`server/src/services/policyMigrationVerificationCoordinator.mjs` exports
`createPolicyMigrationVerificationCoordinator()`. Its
`coordinateMigrationVerification()` operation accepts a validated proposal and
acceptance transition plus bounded verifier options. It then:

1. validates the proposal and transition at the supplied server evaluation
   time;
2. derives `{ policyId, libraryId }` from the transition's persisted context;
3. invokes `policyMigrationRepresentativeClassificationSource`;
4. audits the source and stops for an invalid source or insufficient coverage;
5. invokes `policyMigrationVerifierRollback` only for audited ready samples;
6. audits the verifier report and suppresses it on validation failure.

The companion
`server/src/services/policyMigrationVerificationCoordinatorContract.mjs` owns
versioned statuses, sanitized result assembly, and an output audit. The result
contains no `representativeClassifications` field. It retains only source
counts/provenance and a validated verifier report, which remains explicitly
unable to apply a replacement or delete legacy paths.

## Security Outcome

- An invalid, unaccepted, expired, or mismatched transition cannot cause source
  collection.
- A source result must pass its audit before samples reach the verifier.
- Missing coverage is a successful, explicit stop state rather than a parity
  claim or a verifier call.
- Invalid verifier output is suppressed; unexpected exceptions return a stable
  failure status without error details.
- Only the delegated database read is allowed. All mutation, routing, provider,
  media-server, quota, and browser interactions remain disabled.
- Coordinator output is audited for context/provenance mismatch, sample-record
  exposure, normal-workflow exposure, premature apply/delete flags, and side
  effects.

## Verification

Focused server tests cover:

- accepted-transition context derivation and source invocation;
- successful source-to-verifier coordination without replacement authority;
- insufficient coverage that does not invoke the verifier;
- unaccepted transition rejection before collection;
- source-audit failure, verifier-audit failure, and unexpected exception
  handling;
- raw sample suppression and output-audit tamper detection.

## Next Task

Phase 6R.6 Task 6R.6.4 should add a persisted, replay-protected verification
run handoff. It should record only the accepted-transition fingerprint, source
summary/provenance, verifier fingerprint/status, and bounded audit summaries.
It must not persist raw samples, replace policy state, create a snapshot, or
surface a browser control. That record can then become the sole input to the
existing snapshot gate.
