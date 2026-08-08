# Policy Storage Current Closure Audit

## Intent

The policy storage current closure audit verifies the current checkout against
the policy-storage closure chain before a final completion claim is made.

It consumes:

- the current repository files for mapped closure artifact inventory,
- the current roadmap,
- the current changelog,
- an explicit compatibility-removal completion-audit artifact,
- explicit validation evidence.

It then builds:

- the existing current evidence run,
- a policy storage completion-checkpoint artifact,
- a policy storage final closure readout,
- a fingerprinted, replay-verifiable policy storage current closure audit JSON
  with a content-only fingerprint for the selected checkout's mapped evidence.

The audit reports repository implementation readiness and active-installation
cutover as separate top-level scope summaries. Only the latter depends on one
installation's controlled compatibility-removal evidence.

The service reads repository files but does not run tests, run Git, write files,
write manifests, mutate storage, or infer missing removal evidence.

## Official-Source Research

- NIST SSDF frames secure software work as defined practices across the SDLC.
  The audit preserves validation and implementation evidence as explicit inputs
  before a completion claim is made.
- NIST SP 800-128 frames security-focused configuration management as controlled
  change with integrity monitoring. The audit inspects current configuration
  artifacts, roadmap evidence, and changelog coverage instead of relying on
  historical intent.
- OWASP Logging Cheat Sheet recommends consistent, attributable, bounded event
  records. The audit emits structured status, risk, validation, and next-step
  fields rather than raw logs or ambiguous prose.
- OWASP Input Validation Cheat Sheet recommends server-side syntactic and
  semantic validation with allow-listed values. The public command accepts only
  explicit artifact paths and refuses altered validation evidence before it
  writes a completion claim.
- Node.js documents that `path.resolve(base, relativePath)` uses the supplied
  base for a relative path. The public command therefore binds all relative
  evidence and generated artifacts to its selected checkout.
- Git `mv` documents move handling as an explicit index operation. The module
  cutover keeps durable file names and references synchronized instead of
  leaving stale compatibility wrappers.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- Node.js path API:
  <https://nodejs.org/api/path.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Reuse Existing Closure Contracts

The current closure audit should compose the current evidence run, policy
storage completion-checkpoint artifact, and policy storage final closure readout
instead of adding another scoring model.

Pros:

- keeps each closure layer single-purpose,
- prevents drift between current-state evidence and final operator readout,
- makes blockers traceable to existing artifacts.

Cons:

- incomplete upstream artifacts block the audit even when the current checkout
  appears structurally complete.

### Read Current Repository Files, But Do Not Execute Commands

The service should read roadmap, changelog, and mapped artifact paths. It should
not run validation, source scans, Git, or mutation commands.

Pros:

- keeps evidence collection deterministic and cheap,
- prevents the audit from changing the state it evaluates,
- allows test injection for repository reads.

Cons:

- validation evidence must be generated before calling this audit.

### Require Explicit Removal And Validation Artifacts

The audit should require a complete compatibility-removal completion-audit artifact and
complete validation evidence.

Pros:

- prevents current file presence from masking incomplete compatibility-removal
  proof,
- keeps final closure tied to the actual validation run,
- makes closure decisions reproducible.

Cons:

- stale or missing JSON artifacts block closure until regenerated.

### Separate Repository Readiness From Installation Cutover

The audit should report a ready repository independently from an installation
whose cutover evidence remains incomplete. Final closure still requires both
scopes, but a pending installation cutover must not be described as a missing
source implementation.

Pros:

- keeps source validation configuration-agnostic,
- preserves strict active-installation deletion gates,
- gives a precise, actionable next step.

Cons:

- closure consumers must distinguish readiness from final completion.

### Bind And Replay The Current Closure Artifact

The emitted current-closure artifact should retain the normalized inputs needed
to rebuild the evidence run, checkpoint, and final readout. A downstream
consumer must validate a bounded SHA-256 fingerprint and require exact
deterministic replay before it relies on the reported status.

Pros:

- detects altered or stale closure summaries before a final requirement audit,
- prevents a detached status field from standing in for the evidence chain,
- preserves a pure verification path without repository reads or commands.

Cons:

- current-closure artifacts retain more bounded evidence,
- the requirement-audit boundary is asynchronous because it performs replay.

### Public Artifact-Chain Verification

The public current-closure command should be tested against an isolated
checkout containing the complete mapped artifact range. The test must confirm
that its audit, checkpoint, and final-readout outputs are one coherent chain,
that altered validation evidence writes no output by default, and that missing
checkout evidence writes diagnostics only through explicit blocked-output mode.

Pros:

- verifies the real command boundary rather than only in-process composition,
- keeps output-write policy fail-closed for altered evidence,
- detects contract-map drift when a closure artifact changes.

Cons:

- requires temporary filesystem fixtures,
- repeats some service-level coverage at the public command boundary.

### Checkout-Bound Artifact Paths

The public audit command must use its explicit `--cwd` both to read relative
evidence artifacts and to write relative audit artifacts. The shell working
directory is not audit authority.

Pros:

- prevents cross-checkout artifact mixing,
- makes CI and local invocations deterministic,
- preserves absolute paths as explicit operator choices.

Cons:

- a caller must use an absolute path to intentionally use an artifact outside
  the selected checkout.

## Final Recommendation Stack

Use this stack for the policy storage current closure audit:

1. Read current mapped closure artifact inventory.
2. Read the current roadmap evidence.
3. Read the current Unreleased storage outcome note. It confirms the release
   result, while mapped docs, contracts, and focused tests remain the
   component-level evidence.
4. Require a complete, fingerprint-valid, replay-verified
   compatibility-removal completion-audit artifact.
5. Require focused, lint, markdown, and full validation evidence to pass.
6. Build the current evidence run.
7. Build the policy storage completion-checkpoint artifact from current
   evidence.
8. Build the policy storage final closure readout.
9. Retain normalized closure inputs and bind the full current-closure artifact
   with a SHA-256 fingerprint.
10. Bind the selected checkout's mapped artifact, roadmap, and changelog
    content with a separate SHA-256 fingerprint before requirement-audit use.
11. Establish one generated-at timestamp at the current-closure boundary and
    pass it to the nested checkpoint and final readout artifacts.
12. Require exact replay and a selected-checkout fingerprint match before the
    final requirement audit consumes the
    artifact status.
13. Emit complete only when all three layers complete.
14. Reject file writes, storage mutation, command execution, Git commands, and
    manifest writes.
15. Verify the public command against an isolated mapped checkout and require
    one coherent audit, checkpoint, and final-readout artifact chain.
16. Resolve all relative input and output artifacts from the selected `--cwd`
    checkout.
17. Treat the CLI result as a machine contract: emit exactly one complete JSON
    document on stdout, send diagnostics to stderr, and set `process.exitCode`
    rather than forcing process termination before asynchronous output drains.
18. Resolve imported test files using the syntax of the inspected path. A
    Windows path must retain Windows path semantics when evaluated on a POSIX
    CI runner, and vice versa.

## Implementation Outcome

Implemented:

- Added `policyStorageCurrentClosureAudit.mjs`.
- Added `policyStorageReleaseNoteCoverage.mjs` so the audit requires the
  durable Unreleased storage outcome rather than internal component labels.
- Added `run-policy-storage-current-closure-audit.mjs`.
- Added root npm script `policy:storage-current-closure-audit`.
- Added focused tests for:
  - complete policy storage current closure audit generation,
  - missing mapped repository artifact blocking,
  - missing validation evidence blocking,
  - incomplete completion-audit artifact blocking,
  - forbidden side-effect rejection,
  - audit validation invariants.
- Added the policy storage current closure audit suite and this design doc to
  the fixed validation evidence command set.
- The audit now passes the full completion-audit artifact through the current
  evidence run and checkpoint artifact. It never unwraps a detached nested
  audit object.
- Current closure audit v4 retains normalized replay inputs and emits a
  fingerprint that binds the full closure decision, including current evidence,
  completion evidence, validation evidence, status, risks, and side effects.
- Repository `implementationReadiness` and active-installation `instanceCutover`
  are now explicit, fingerprint-bound summaries. When only installation
  evidence is pending, the audit returns `blocked_by_instance_cutover` and the
  `policy_storage_instance_cutover` next step rather than a generic source
  evidence failure.
- The detailed scope contract is documented in
  [Policy Storage Closure Scope Separation](policy-storage-closure-scope-separation.md).
- The current-closure boundary now establishes one timestamp for the audit,
  checkpoint, and final readout when a caller does not provide one. A normal
  command invocation therefore produces a replayable artifact rather than
  nested timestamps that diverge by milliseconds.
- The downstream requirement audit validates that fingerprint and rebuilds the
  pure closure chain before it accepts the current-closure status. Altered,
  refingerprinted-but-inconsistent, or non-replayable artifacts block closure.
- Current closure audit v6 retains a bounded SHA-256 digest of the mapped
  source, documentation, test, roadmap, and changelog content. The requirement
  audit v3 recomputes it from its selected checkout and blocks cross-checkout
  or stale evidence before evaluating completion.
- The detailed integrity contract and trust boundary are documented in
  [Policy Storage Current Closure Audit Artifact Integrity](policy-storage-current-closure-audit-artifact-integrity.md).
- The audit also retains a fingerprint-bound component scope map that proves
  active-installation compatibility-removal components are not counted as
  repository implementation evidence. See [Policy Closure-Map
  Reconciliation](policy-closure-map-reconciliation.md).
- Added an isolated-checkout command test proving that complete mapped evidence
  produces matching audit, checkpoint, and final-readout outputs; altered
  validation evidence writes nothing by default; and missing checkout evidence
  produces diagnostics only with explicit blocked-output allowance.
- Relative completion-audit, validation, audit, checkpoint, and final-readout
  paths now resolve from the selected `--cwd` checkout. Cross-directory public
  coverage proves the shell caller cannot mix another checkout's artifacts or
  receive the selected checkout's outputs.
- The public CLI now waits for its JSON result to be written and then sets an
  exit code for Node's normal shutdown. Large audit artifacts can no longer be
  truncated when stdout is a Linux pipe, while blocked and operational
  diagnostics remain on stderr.
- Static-import mock-boundary assessment now chooses POSIX or Windows path
  semantics from the file being inspected rather than from the CI host. The
  quality gate therefore yields the same candidate assessment for either
  checkout path syntax.

Example:

```bash
npm run --silent policy:storage-current-closure-audit -- \
  --completion-audit-artifact .tmp/policy-storage/completion-audit-artifact.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/current-closure-audit.json \
  --checkpoint-artifact-output .tmp/policy-storage/current-checkpoint-artifact.json \
  --final-readout-output .tmp/policy-storage/current-final-readout.json \
  --require-complete
```

## Next Step

Generate current compatibility-removal and validation evidence, then run the
policy storage current closure audit. The final requirement audit will replay
the artifact before it accepts completion. If either audit blocks, resolve the
exact component, roadmap, validation, or release-outcome evidence category
reported by its structured risks.
