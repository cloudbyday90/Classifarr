# Policy Native-Storage Cutover Deletion-Evidence Integration Audit

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.2

**Decision date:** 2026-08-01

## Decision

The Phase 3R.10.1 handoff inventory identifies what would retire, but an
inventory cannot prove that a removal was authorized, complete, or safe. This
task introduces a separate, side-effect-free ESM audit that consumes the
existing `policyCompatibilityRemovalCompletionAudit` output rather than
creating a second removal authority.

For every compatibility-maintenance handoff, the audit derives:

1. Compatibility components that have a `delete_after_native_storage`
   disposition.
2. Compatibility test files that retire with their bridge.
3. Shared test files where only named compatibility assertions retire.

It accepts deletion evidence only when the existing completion audit proves an
intact authorization chain with no remaining paths, verified post-removal
runtime evidence, a clean final import/reference scan, and passed focused plus
full validation. Every full-file retirement path must be in both the authorized
manifest and verified removal evidence. For retained shared files, current
source evidence must show the old named assertions are absent while the mapped
native workflow assertions remain.

The result always sets `deletionAuthorized: false`. It does not delete files,
edit tests, mutate storage, run Git, or invoke an execution script. A complete
result is closure evidence, not a command to alter the repository.

## Research

Official sources were reviewed on 2026-08-01 and satisfy the requested
current-through-June-2026 baseline.

- OWASP recommends maintaining a clear legacy inventory and a granular,
  documented migration or decommissioning plan. Deriving every retiring path
  from the handoff inventory and checking it against the actual authorized
  manifest applies that guidance to the bridge boundary. [OWASP Legacy
  Application Management Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Legacy_Application_Management_Cheat_Sheet.html)
- NIST SSDF recommends integrating secure development practices into the SDLC
  to reduce released vulnerabilities and mitigate their impact. Separating
  evidence collection from destructive execution keeps removal reviewable and
  repeatable. [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- SLSA recommends verifying artifacts and their provenance against explicit
  expectations rather than merely storing provenance. The audit therefore
  checks the existing completion artifact's authorization, manifest, runtime,
  scan, and validation claims against the expected retiring paths. [SLSA Build:
  Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)

## Evidence Model

| Evidence | Source | Required result |
| --- | --- | --- |
| Compatibility handoff | `policyNativeStorageCutoverTestHandoff` | Valid and explicitly non-authorizing |
| Authorization and completion | `policyCompatibilityRemovalCompletionAudit` | Complete, integrity-valid, no remaining paths |
| Path coverage | Completion manifest and verified applied paths | Every delete-with-bridge component and test file present in both |
| Reference scan | Completion audit final scan | Completed with zero remaining references |
| Validation | Completion audit validation evidence | Focused and full checks passed |
| Shared test scopes | Current post-retirement source text | Old named assertions absent; mapped native successor assertions present |

The full-file retirement set currently contains three compatibility Vue
components plus the dedicated maintenance-surface and migration-notice test
files. `PolicyIntentEditor.test.js` and `PolicyBuilderModal.test.js` are not
full-file retirement targets: they require named-scope evidence because they
still contain separately owned native workflow coverage.

## Options Considered

### Treat the handoff registry as removal approval

**Pros:** Minimal implementation.

**Cons:** Static metadata cannot prove an authorized plan, actual path removal,
reference scan, or validation run. It would create a new and weaker removal
authority. Rejected.

### Create a parallel native-storage deletion authorization system

**Pros:** A specialized surface could contain all policy-builder fields.

**Cons:** Duplicates the existing integrity-protected authorization and
completion audit, creating divergent evidence and more security-sensitive
code. Rejected.

### Bind the handoff to the existing completion audit and inspect shared scopes

**Pros:** Reuses the established authorization chain, preserves exact path
coverage, handles shared test files safely, and keeps the integration audit
side-effect-free. Adopted.

**Cons:** A complete result cannot be produced until an actual authorized
removal process has produced current evidence. This is intentional: the audit
must not manufacture proof.

## Final Recommendation Stack

1. Keep the existing compatibility-removal completion audit as the only
   authorization and execution-evidence contract.
2. Derive retiring component and full-test-file paths from the immutable
   handoff inventory, then require manifest and verified-removal coverage.
3. Treat shared test files as named-scope retirements, never as automatic file
   deletion candidates.
4. Require zero final reference findings and passed focused plus full
   validation before recording closure evidence.
5. Keep this integration audit read-only and permanently non-authorizing.
6. Rehome any active native-workflow test ownership before deleting the
   component that its current test file imports.

## Implementation

- `server/src/services/policyNativeStorageCutoverDeletionEvidence.mjs` derives
  required removed paths, validates the existing completion artifact, verifies
  shared-test retirement evidence, and rejects side effects.
- `server/src/__tests__/services/policyNativeStorageCutoverDeletionEvidence.test.mjs`
  exercises an intact real completion-artifact chain, missing-manifest paths,
  stale shared compatibility assertions, missing native successors, and
  attempted side effects.
- `policyAuthoringWorkflowCompletionAudit.mjs` now lists the integration audit
  as a required authoring-completion server contract.

## Security Outcome

- A static handoff inventory cannot be mistaken for deletion approval.
- Every delete-with-bridge path is bound to the same authorized manifest and
  verified removal evidence.
- A clean reference scan and validation results are mandatory, not advisory.
- Shared source files cannot silently retain compatibility assertions or lose
  their named native successor tests.
- The integration layer introduces no storage, file, test, route, or Git
  mutation capability.

## Next Step

Proceed to **Phase 3R, Task 3R.10.3: Native Workflow Test Rehoming Audit**.
`PolicyIntentEditor.test.js` remains an active completion-audit owner for
destination-section and review-trigger behavior while `PolicyIntentEditor.vue`
is scheduled for deletion. Rehome those native behavior contracts to their
actual destination workflow tests before any cutover execution is considered.
