# Policy Controlled Removal Apply Artifact Exporter

Status: Historical mutable-CLI record. The generator, filesystem adapter, and
npm command described below were retired by 8R.37.3. The pure artifact builder
remains a read-only evidence contract and cannot mutate source by itself. See
[Policy CI-Only Retirement Command Contract](policy-ci-only-retirement-command-contract.md).

## Historical Intent

Controlled Removal Apply Artifact Exporter generates a machine-readable
controlled removal apply artifact from:

- a ready controlled removal-batch JSON,
- explicit apply input evidence,
- operator confirmation with an actor,
- an injected apply adapter.

Historically, this component wrapped controlled removal apply and delegated to a
CLI-provided adapter. That executor was retired. The current module only builds
and validates evidence through an injected adapter contract; no concrete
filesystem adapter, command, or npm runner remains.

## Official-Source Research

- OWASP Logging Cheat Sheet guidance says application logs and audit trails
  should include useful action, object, result, and reason context while avoiding
  excessive or unsafe detail. The artifact wrapper records apply status, actor,
  counts, risks, and side effects.
- NIST SP 800-128 frames configuration management as part of information-system
  security. The artifact wrapper preserves controlled apply evidence and blocks
  forbidden side effects.
- NIST SSDF SP 800-218 recommends secure development practices integrated into
  the SDLC. The artifact keeps destructive removal explicit, reviewed, bounded,
  and testable.
- Git `rm` documents tracked-path removal behavior. The CLI adapter deletes
  only repo-relative files when explicitly enabled and does not run Git commands.
- Node.js documents that `path.resolve()` normalizes an input path into an
  absolute path and `path.relative()` describes its relationship to a root.
  The file adapter uses both operations to reject a resolved path that escapes
  the configured repository before calling a filesystem API.
- OWASP path-traversal guidance recommends known-good input validation and
  normalization before filesystem I/O. The public command is tested against a
  sentinel outside an isolated temporary repository to prove the containment
  check is enforced at the command boundary.

Sources:

- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- Git `rm` documentation:
  <https://git-scm.com/docs/git-rm>
- Node.js path API:
  <https://nodejs.org/api/path.html>
- OWASP Path Traversal:
  <https://owasp.org/www-community/attacks/Path_Traversal>

## Recommendations

The following recommendations record the historical destructive-boundary
design. They are not a current executable interface.

### Require Reviewed Batch Evidence

The apply exporter should refuse raw path lists. It should consume a ready
controlled removal batch so path selection, manifest membership, review reason,
and reviewer metadata remain upstream concerns.

Pros:

- prevents ad hoc deletion,
- preserves review metadata,
- keeps apply evidence tied to the exact selected batch.

Cons:

- operators must preserve the removal-batch artifact between steps.

### Require Explicit Apply Confirmation

Apply input should include `executeApply: true` and
`operatorConfirmation.confirmed: true` with `confirmedBy`.

Pros:

- separates preview/export from destructive execution,
- makes the actor visible in audit output,
- prevents accidental deletion from default command invocation.

Cons:

- local apply runs require one more JSON input file.

### Keep Filesystem Mutation Adapter-Bound

The reusable service should not perform file I/O directly. The CLI should
provide a bounded adapter that deletes only repo-relative files when
`--apply-files` is present.

Pros:

- keeps the reusable service deterministic and testable,
- supports future adapters without changing the apply contract,
- prevents traversal outside the repository.

Cons:

- replacement-style code-path removals need a later adapter instead of being
  silently treated as file deletion.

### Verify The Public Apply Boundary In An Isolated Repository

The public command should be tested in a temporary repository with disposable
files. It must leave the reviewed file and output paths untouched without
`--apply-files`; with the flag, it may remove only the approved repo-relative
regular file. Traversal and absolute paths must fail before mutation, and a
blocked diagnostic must require explicit `--allow-blocked`.

Pros:

- proves the real CLI adapter, current working directory, and JSON boundaries
  preserve the service containment rule,
- demonstrates the opt-in apply flag rather than asserting it only through a
  mocked adapter,
- avoids risk to the checkout by exercising mutation only in a disposable
  temporary repository.

Cons:

- process-level filesystem tests cost more than pure service tests,
- the sandbox fixture must preserve an intact reviewed batch contract.

## Final Recommendation Stack

Use this stack for controlled removal apply artifact generation:

1. Require a ready controlled removal-batch JSON file.
2. Require explicit apply input JSON with `executeApply: true`,
   `operatorConfirmation.confirmed: true`, and `confirmedBy`.
3. Run the controlled compatibility path removal apply contract through an
   injected adapter.
4. Let the CLI adapter delete only repo-relative file paths when
   `--apply-files` is present.
5. Require a final per-entry revision, path-type, tree, and content recheck
   before the adapter receives an entry.
6. Reject archive, storage, and Git-mutation side effects.
6. Write nested apply-result JSON for post-removal runtime verification.
7. Optionally write the wrapper artifact for audit trails.
8. Verify the public apply command in an isolated repository, including the
   explicit apply flag and containment failures.

## Historical Implementation Outcome

Implemented:

- Renamed the service to `policyControlledRemovalApplyArtifact.mjs`.
- Renamed the focused test suite to
  `policyControlledRemovalApplyArtifact.test.mjs`.
- Replaced phase-coded contract exports with:
  - `POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_VERSION`,
  - `POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS`,
  - `POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_RISK_IDS`,
  - `buildPolicyControlledRemovalApplyArtifact`,
  - `validatePolicyControlledRemovalApplyArtifact`.
- Updated the artifact version to `policy.controlled_removal_apply_artifact.v3`.
- Propagates the apply boundary's bounded halt reason and semantic next step so
  a zero-removal blocked apply is not presented as ready for runtime
  verification.
- Retains the controlled apply's pre-apply verification count and policy so the
  exported artifact distinguishes read-only Git verification from forbidden Git
  mutation.
- Replaced runtime `nextPhase.phaseId` with semantic `nextStep.stepId`.
- Preserved focused tests for successful apply artifact generation through an
  injected adapter, blocked apply when explicit execution is missing,
  forbidden side-effect rejection, and artifact validation invariants.
- 8R.37.3 subsequently removed the generator, npm runner, concrete filesystem
  adapter, and mutable-boundary tests. The pure artifact service and its
  focused validation tests remain as read-only evidence infrastructure.

## Next Step

This design was superseded by the CI-only retirement contract. Reviewed source
changes are made through ordinary reviewed commits, and CI validates them
without an executable source-mutating command.
