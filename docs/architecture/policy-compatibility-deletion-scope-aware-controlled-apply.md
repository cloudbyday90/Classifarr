# Policy Compatibility Deletion Scope-Aware Controlled Apply

## Status

Complete. This document records Phase 3R, Task 3R.10.18.

## Decision

The first source-mutation capability is a server-only, dependency-injected ESM
component for one reviewed named test scope. It owns the final replay,
single-use authorization consumption, exclusive scope lock, exact bounded
replacement, external rollback evidence, and concise outcome record. It is not
an HTTP route, a client API, or a generic file-editing facility.

The caller can provide only an authenticated actor and authorization ID to the
factory adapter. Server-owned dependencies, clock, repository root, replay
adapter, lock, source writer, and authorization store are fixed when the
adapter is created. Supplied replay objects, dry-run objects, and dependency
substitutions are ignored.

## Problem

A ready review replay proves a particular named-test-scope edit is still safe
to consider. It does not make a source mutation safe on its own. A mutation
path must bind the exact current source and reviewed scope to a trusted actor,
prevent authorization replay, avoid widening into file replacement or deletion,
and leave recoverable evidence even when the final audit write fails.

## Research

The selected design follows the official guidance that transaction
authorization is server-side, bound to the exact operation data, unique to the
operation, and checked immediately before execution. OWASP also recommends
server-side state transitions, integrity checks, and explicit treatment of
business-logic abuse cases. NIST SSDF calls for protecting code from
unauthorized change and preserving evidence for secure software decisions.
These sources were current guidance as of June 2026.

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Reuse The Existing Path-Level Apply Flow

Pros: already has an operator-facing apply sequence.

Cons: it is intentionally path-oriented and rejects named scopes. Extending it
would conflate user interaction, broad-path behavior, and this exact-edit
security boundary. Rejected.

### Write The Reviewed File Directly After Replay

Pros: smallest implementation and no operation journal.

Cons: lacks single-use authorization, a durable pre-write recovery record,
independent outcome evidence, and a safe response to post-write audit failure.
Rejected.

### Server-Owned Scoped Apply With An External Journal

Pros: keeps authorization, replay, file handling, and persistence modular;
rechecks the source at the final write; limits a successful edit to hash-backed
offset ranges; restores the source automatically when outcome persistence
fails; and exposes no Git, deletion, storage, or route capability. Selected.

Cons: requires an isolated evidence directory and a production lock adapter.
The next task owns that production admission integration.

## Final Recommendation Stack

1. Issue an authorization only from trusted server workflow code after it has
   assembled the reviewed gate, artifact, reviewer metadata, and exact
   `named_test_scope:` identity. Bind it to one normalized admin actor and an
   expiry timestamp.
2. Persist pending, consumed, rollback, and outcome records as exclusive,
   fsynced JSON files in a non-symlink evidence root outside the repository.
   The store refuses an evidence root equal to or nested beneath the repository.
3. Serialize the scope before consuming authorization. Production callers must
   adapt the platform's server-side advisory lock; they must not use a process
   local lock or a client-provided lock result.
4. Consume the authorization exactly once, run the 3R.10.17 replay from the
   stored review context, and require a fresh ready dry run before preparation.
5. Require a regular non-symlink, repository-relative source file. Revalidate
   the parent and file immediately before writing, verify the original SHA-256
   fingerprint, apply only the reviewed non-overlapping ranges, fsync a
   same-directory temporary file, and rename it into place. No file deletion or
   Git command is allowed.
6. Write complete rollback evidence before the source write, then persist a
   compact successful outcome. If that final outcome write fails, restore the
   original source only when the result fingerprint still matches; otherwise
   fail closed and retain the rollback evidence for the next controlled task.

## Implementation Outcome

`policyControlledCompatibilityNamedScopeRemovalApply.mjs` is the orchestration
boundary. It returns only versioned status, compact authorization metadata,
risks, and side effects. It never returns source text, a replay result, a file
handle, or an authorization record.

`policyControlledCompatibilityNamedScopeRemovalApplyOperationStore.mjs` owns
the external, single-use authorization and rollback/outcome journal.
`policyControlledCompatibilityNamedScopeRemovalApplySourceWriter.mjs` owns
safe source preparation, final path and fingerprint checks, bounded replacement,
and restoration. The shared module owns the closed status, risk, actor, ID,
timestamp, and side-effect contract. The replay adapter exposes an internal
full fresh dry run only through `replayForControlledApply`; its normal public
replay remains compact and read-only.

The implementation does not add a route, browser control, client API, Git
operation, broad file replacement, whole-file deletion, or general-purpose
source mutation capability.

## Security Invariants

- The adapter ignores caller attempts to replace its dependencies, replay,
  dry-run, clock, or source writer.
- An authorization is generated server-side, bound to one trusted admin actor,
  expires, and is moved from pending to consumed with an exclusive write.
- Final replay is regenerated from the stored review context. A changed gate,
  source, scope, review, or bounded edit fails before source preparation.
- The source path is relative to the configured repository, cannot traverse
  outside it, and must remain a regular non-symlink file.
- The pre-write rollback record contains the original source outside the
  repository. It is never included in the API result.
- `filesDeleted`, `storageChanged`, and `gitCommandsRun` remain false in every
  status. A successful result also requires authorization consumption, rollback
  evidence, a source write, and durable outcome evidence.

## Validation

Focused unit tests cover successful bounded removal; ignored caller replay and
dependency input; expired and actor-mismatched authorization; unavailable scope
lock; source drift before replay; one-time authorization reuse; evidence-root
repository isolation; source drift after final preparation; and automatic source
restoration after an outcome-persistence failure. ESLint passes for test and
server source files.

## Next Task

Phase 3R, Task 3R.10.19: Compatibility Deletion Scope-Aware Controlled-Apply
Production Admission Adapter. Add one server-only composition component that
obtains the actor exclusively from existing trusted authentication middleware,
uses a configured repository-external evidence root, adapts the existing
database advisory-lock mechanism to the scoped-lock contract, and issues/apply
authorizations from server-derived review context. It must not expose a client
supplied actor, clock, authorization result, replay, dry run, file path, or
lock result, and it must not add a generic mutation endpoint.
