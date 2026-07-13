# Policy Library Rebuild Acceptance Transition

Status: implemented as the verified transition from a library rebuild proposal
to bounded migration verification.

## Problem

A reviewable library rebuild proposal must not become replacement authority
because a client or integration sets `accepted: true`. The old migration
verifier accepted a free boolean and a disconnected rollback object, which did
not prove that the reviewed proposal, rollback plan, and operator action still
belonged to the same decision.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state, re-deriving security-relevant values,
  rejecting completed-step replays, expiring partial state, and protecting
  sensitive operations from races. The transition revalidates its source inputs,
  has a bounded acceptance window, and declares persistence-backed replay
  protection as a later requirement.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends binding authorization to the exact transaction and enforcing it
  server-side. The transition fingerprints the complete rebuild proposal and
  rollback plan, instead of trusting a client-controlled acceptance flag.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for defined security requirements, verification, and protection of
  release artifacts. The contract makes proposal, rollback, and approval
  invariants testable before a later write path exists.
- [OpenTelemetry Handling Sensitive Data](https://opentelemetry.io/docs/security/handling-sensitive-data/)
  recommends minimizing sensitive telemetry and avoiding unnecessary exposure.
  The transition uses a hashed operator reference and the rollback plan reports
  only actor presence and reason presence, not an actor ID or free-form reason.

## Recommendations

1. Require a valid, reviewable rebuild proposal. Only `ready_for_review` and
   `needs_operator_constraint_review` proposals may receive an acceptance
   transition. Stale, blocked, incomplete, or previously mutated proposals do
   not advance.
2. Bind the proposal to the policy being rebuilt. The transition requires a
   policy ID, intent ID, and library ID; the library ID must equal the rebuild
   proposal's selected library.
3. Require a valid rollback-window plan for the same policy and intent. The
   plan must be currently revert-ready, unexpired, side-effect-free, and have a
   complete redacted restore manifest.
4. Accept only a direct manual operator decision. Approval time is derived by
   the server, the actor reference is hashed, and the acceptance lasts from five
   to sixty minutes, with a thirty-minute default.
5. Fingerprint the complete proposal, rollback plan, and resulting transition.
   Migration comparison includes this transition fingerprint in its own sample
   provenance and trace attributes.
6. Keep this component non-executable. It can authorize migration comparison,
   but it cannot create a snapshot, persist acceptance, replace policy, delete
   policy, write routing, or write learning.
7. Require a later transaction to persist the idempotency key and actual
   rollback snapshot before any replacement operation. This contract explicitly
   reports that replay protection is not enforceable without storage.

## Pros And Cons

Pros:

- Prevents a boolean in a proposal or verifier request from becoming approval
  authority.
- Detects proposal substitution, rollback-plan substitution, expired approval,
  wrong-library context, and attempt to use an old proposal gate.
- Keeps migration comparison auditable without exposing operator IDs, free-form
  reasons, legacy payloads, or provider payloads.
- Establishes a deterministic idempotency key for the later transactional
  persistence path.
- Preserves the separation between proposal, comparison, snapshot creation, and
  replacement.

Cons:

- The operator must explicitly accept a current proposal before migration
  comparison begins.
- Acceptance expires, so a delayed review requires a fresh transition.
- The service intentionally cannot prevent replays by itself; durable uniqueness
  enforcement belongs to the native-storage write transaction.

## Final Recommendation Stack

1. Build `policy.library_rebuild_acceptance_transition.v1` from a validated
   proposal, same-policy rollback plan, and manual acceptance decision.
2. Validate the transition again immediately before migration comparison.
3. Bind the migration verifier sample fingerprint and trace to the transition
   fingerprint.
4. Keep `canApplyReplacement` false and require a persisted rollback snapshot.
5. In the native storage execution task, store the idempotency key and snapshot
   atomically before replacement, then revalidate the transition against the
   current time and policy state.

## Implemented Files

- Acceptance transition contract:
  `server/src/services/policyLibraryRebuildAcceptanceTransition.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLibraryRebuildAcceptanceTransition.test.mjs`
- Rollback-plan dependency:
  `server/src/services/policyRollbackSnapshotWindow.mjs`
- Rebuild proposal dependency:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Migration verifier integration:
  `server/src/services/policyMigrationVerifierRollback.mjs`

## Security Outcome

- A raw `operatorAccepted` value and raw `rollbackSnapshot` object are no
  longer accepted by the migration verifier.
- A verifier can compare samples only through a current accepted transition
  whose fingerprint matches the embedded proposal and rollback plan.
- Proposal-local `accepted` and `snapshotCreated` mutations are rejected as
  legacy authority attempts.
- Approval is short-lived, operator-bound, and redacted in reports.
- The transition and verifier remain read-only; an actual persisted snapshot and
  replay record are mandatory before a later replacement path can execute.

## Next Step

Continue **Migration Verifier And Rollback Path** by connecting the accepted
transition to the eventual transactional snapshot and replacement operation.
That work must enforce the transition's idempotency key and revalidate current
state inside the database transaction.
