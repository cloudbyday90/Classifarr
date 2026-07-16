# Policy Compatibility Removal Completion Audit Artifact Exporter

## Intent

The compatibility removal completion audit artifact exporter generates a
machine-readable compatibility removal completion audit artifact from:

- a fingerprint-valid next-batch authorization artifact JSON,
- a ready fingerprint-valid compatibility deletion execution-plan artifact with
  approved manifest entries,
- final import/reference scan evidence,
- focused and full validation evidence.

The exporter no longer accepts detached completion-authorization or
post-removal-verification summaries. Its input JSON must include the applied
removal-review fingerprint so the nested runtime evidence can be bound to the
completion context.

This component does not delete files, archive files, write manifests, mutate
storage, run tests, run source scans, or run Git commands. It produces an audit
artifact that either proves compatibility removal is complete, reports bounded
remaining inventory, or blocks completion with explicit risks.

The current artifact retains the verified execution-plan wrapper, its derived
nested plan for diagnostics, and normalized audit input, then adds a SHA-256
fingerprint. Downstream closure gates validate that fingerprint and replay the
nested audit before consuming its status. Raw nested plan JSON is never an
authorization input.

## Official-Source Research

- NIST SP 800-128 frames configuration management as controlled change with
  integrity monitoring. The artifact verifies the final compatibility-removal
  state before cleanup exits compatibility mode.
- NIST SSDF recommends secure development practices across the SDLC. The
  artifact preserves evidence that legacy compatibility code was removed only
  after validation and scan evidence passed.
- SLSA artifact verification requires consumers to inspect provenance and
  reject unexpected values. The public exporter test exercises the retained
  authorization artifact, fingerprint-valid execution-plan wrapper, and review
  context as one verification chain rather than trusting a detached completion
  summary.
- OWASP input validation recommends server-side allowlisting. The generator
  accepts only explicit JSON artifact inputs and blocks altered authorization,
  cross-review, and final-reference evidence before writing normal output.
- OWASP Logging guidance recommends event records with enough context for
  review. The artifact records inventory counts, verification counts, final
  scan results, validation state, risks, and side-effect status.
- Git `mv` documents explicit tracked renames. The exporter cutover keeps the
  CLI, module names, and docs aligned with durable policy-domain behavior.
- OWASP API9:2023 Improper Inventory Management treats stale or unmanaged
  surfaces as a risk. The artifact treats compatibility paths as inventory that
  must be proven removed or explicitly reported as remaining.

Sources:

- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- SLSA Verifying Artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Consume One Authorization Artifact

The artifact exporter should consume a fingerprint-valid authorization artifact
instead of a detached authorization summary and a separately supplied runtime
verification list.

Pros:

- preserves the reviewed removal-loop evidence chain,
- distinguishes completion from remaining inventory,
- keeps the audit tied to the current execution manifest.

Cons:

- operators must retain the runtime evidence embedded in the authorization
  artifact.

### Require Removal, Scan, And Validation Evidence

Completion should require verified removal evidence, final scan evidence for
all approved paths, and focused/full validation evidence.

Pros:

- prevents false completion claims,
- catches lingering references after the last batch,
- keeps closure evidence release-ready.

Cons:

- the audit cannot complete until current validation output exists.

### Report Remaining Inventory Separately

Remaining approved paths should produce `remaining_inventory` rather than a
generic blocked state.

Pros:

- tells operators to continue the bounded removal loop,
- avoids treating expected incremental cleanup as corruption,
- makes final checkpoint inputs precise.

Cons:

- downstream consumers need to handle a non-complete but valid state.

### Verify The Public Artifact Chain

The public generator should be tested with the same retained authorization
artifact, exact execution plan, final scan, validation, and review context that
the checkpoint will consume. A complete chain writes a complete wrapper and
nested audit. A valid remaining-inventory chain writes its artifact but fails
`--require-complete`. Altered authorization, a different review fingerprint, or
final scan references must fail closed without writing output unless the caller
explicitly requests a blocked diagnostic with `--allow-blocked`.

Pros:

- catches CLI serialization and file-boundary regressions that service tests do
  not exercise,
- preserves remaining inventory as an explicit, resumable state,
- prevents an altered, cross-review, or reference-bearing artifact chain from
  being mistaken for closure evidence.

Cons:

- fixture builders must retain a small, coherent execution-plan and
  authorization-artifact chain.

## Final Recommendation Stack

Use this stack for compatibility removal completion audit artifact export:

1. Require a fingerprint-valid next-batch authorization artifact JSON.
2. Require a ready fingerprint-valid compatibility deletion execution-plan
   artifact with approved manifest entries; reject raw nested plan JSON.
3. Require the input review fingerprint to match the nested applied review.
4. Replay authorization against the current manifest before deriving completion.
5. Require final import/reference scan evidence covering every manifest path.
6. Block completion if references remain.
7. Require focused and full validation evidence to pass.
8. Emit `complete`, `remaining_inventory`, or `blocked` artifact status.
9. Retain the verified execution-plan wrapper, derived execution plan, and audit
   input; fingerprint the bounded artifact; and require exact audit replay in
   downstream closure gates.
10. Reject file deletion, archive, route/test removal, storage mutation,
    manifest writes, and Git side effects.
11. Exercise the public generator with coherent complete and remaining chains;
    fail closed without output for altered, cross-review, or final-reference
    evidence unless a blocked diagnostic is explicitly requested.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityRemovalCompletionAuditArtifact.mjs`.
- Added `generate-policy-compatibility-removal-completion-audit.mjs`.
- Added root npm script `policy:compatibility-removal-completion-audit`.
- Added focused tests for:
  - complete audit artifact generation,
  - remaining-inventory artifact generation,
  - altered authorization-artifact rejection,
  - blocked final reference scan evidence,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added a public generator test that verifies coherent complete and
  remaining-inventory chains, `--require-complete` semantics, fail-closed
  altered/cross-review/reference cases, and explicit blocked diagnostics.
- Added the completion-audit artifact suite and this design doc to the fixed
  policy storage closure validation evidence command set and the current
  closure evidence inventory.
- The artifact now emits `version =
  policy.compatibility_removal_completion_audit_artifact.v4`, retains the
  verified execution-plan wrapper for replay, binds its fingerprint through the
  audit and artifact provenance, and includes a bounded SHA-256 artifact
  fingerprint.
- The storage completion checkpoint now consumes the complete artifact, not the
  nested audit JSON, and blocks altered or non-replayable evidence.
- Production output emits
  `nextStep.stepId = policy_storage_completion_checkpoint`; production output
  does not expose `nextPhase.phaseId`.

Example:

```bash
npm run --silent policy:compatibility-removal-completion-audit -- \
  --next-batch-authorization-artifact .tmp/phase8r/next-batch-authorization-artifact.json \
  --execution-plan-artifact .tmp/phase8r/execution-plan-artifact.json \
  --input .tmp/phase8r/completion-audit-input.json \
  --output .tmp/phase8r/completion-audit.json \
  --artifact-output .tmp/phase8r/completion-audit-artifact.json
```

## Next Step

Use the generated completion-audit artifact as input for the policy storage
completion checkpoint artifact export. After that artifact is complete, proceed
with the policy storage current closure audit.
