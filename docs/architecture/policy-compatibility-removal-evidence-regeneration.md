# Policy Compatibility-Removal Evidence Regeneration

## Intent

Compatibility-removal closure evidence must describe the current checkout and
the current validation result. A predecessor artifact can document historical
work, but it cannot prove that the present execution-plan contract, source
reference state, or validation results still satisfy the closure conditions.

This component adds a read-only regeneration path. It receives a ready,
fingerprint-valid compatibility-deletion execution-plan artifact, a
fingerprint-valid next-batch authorization artifact, its applied removal-review
fingerprint, and current validation evidence. It derives the nested plan only
from that wrapper, then derives filesystem state and source-reference evidence
from the checkout. It emits a current completion-audit artifact only when that
one evidence chain validates. A raw nested plan is diagnostic data, not
authority. The path never treats a historical plan as current approval and
never deletes, archives, mutates storage, writes manifests, or runs Git.

## Official-Source Research

- NIST SP 800-218 describes secure development practices as additions to the
  SDLC that reduce exploitable vulnerabilities and their impact. Current
  closure evidence therefore binds the plan, checkout state, and validation
  instead of accepting a historical summary as a release decision.
- OWASP recommends server-side syntactic and semantic validation as early as
  possible. The command requires explicit JSON inputs, accepts only its fixed
  options, and asks the service to validate both their shape and their
  relationship before it writes an artifact.
- SLSA artifact verification compares provenance to trusted expectations and
  recommends failing unrecognized parameters. The regeneration path rejects a
  predecessor execution-plan contract and a blocked evidence chain by default;
  it never treats a caller-supplied ready flag as authority.
- GitHub's artifact-attestation guidance treats provenance as verifiable build
  context rather than an assertion made by a later caller. The regeneration
  path therefore distinguishes an absent evidence chain from a malformed
  supplied artifact, and never substitutes diagnostic output for approval.
- OWASP logging guidance favors useful security events without exposing
  sensitive values. Missing-input risks record stable evidence categories
  rather than echoing absent values. Regenerated output retains only the
  established replay inputs and bounded focused/full validation pass state; it
  does not include credentials, absolute filesystem paths, or copied policy
  payloads.

Sources:

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [SLSA Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- [GitHub Docs: Artifact Attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)

## Options Considered

### Reuse The Historical Completion Artifact

Pros:

- no new collection work,
- records the originally reviewed removal batch.

Cons:

- does not prove the current plan contract or source state,
- permits stale validation to reach the closure gate,
- makes a historical partial manifest look like present completion.

### Recreate An Approved Plan Automatically

Pros:

- could produce a fresh artifact with little operator input.

Cons:

- silently manufactures readiness and approval,
- bypasses deletion gates, rollback evidence, and support stance,
- violates the explicit approval boundary for destructive work.

### Regenerate From A Current Fingerprint-Valid Plan Artifact

Pros:

- preserves operator approval and its exact fingerprint as inputs rather than
  fabricating them,
- derives path state and source references from the current checkout,
- rejects predecessor contracts and reports incomplete readiness clearly,
- is safe to run repeatedly because it is read-only.

Cons:

- cannot complete until deletion readiness produces a current execution-plan
  artifact,
- requires fresh validation evidence for each closure attempt.

## Final Recommendation Stack

1. Require the ready, fingerprint-valid execution-plan artifact that carries
   the current `policy.compatibility_deletion_execution_plan.v1` contract;
   reject raw nested plan JSON at the public and service boundaries.
2. Require the fingerprint-valid next-batch authorization artifact and the
   exact applied removal-review fingerprint bound to its runtime evidence.
3. Derive the manifest and path state from the verified wrapper at generation
   time, and bind that wrapper fingerprint through authorization and completion
   audit evidence.
4. Resolve every relative CLI input and output from the same `--cwd` checkout
   that supplies manifest path state and source-reference evidence. Absolute
   paths remain explicit operator inputs.
5. Scan source roots for operational references, while treating only named
   control-plane manifest inventories as evidence rather than dependencies.
6. Require completed source scanning plus focused and full validation evidence.
7. Emit a current completion artifact even when it is incomplete, so downstream
   gates report the real readiness blocker.
8. Refuse blocked artifact writes by default; allow bounded diagnostic output
   only through an explicit operator flag.
9. In that explicit diagnostic mode, report each absent evidence category as a
   stable blocked risk. An unreadable explicitly supplied JSON path remains a
   command error, because it is not evidence absence.
10. Do not synthesize deletion approval, run deletion actions, or alter storage.
11. Pass only a complete, valid generated artifact to the storage closure gates.

## Implementation Outcome

Implemented:

- `policyCompatibilityRemovalEvidenceRegeneration.mjs` composes a verified
  execution-plan wrapper, path-state, source-reference scan, and validation
  evidence into a durable regeneration record and nested completion-audit
  artifact.
- `generate-policy-compatibility-removal-evidence.mjs` exposes that read-only
  collection path through `npm run policy:compatibility-removal-evidence`.
- Completion audits now require the same verified execution-plan wrapper that
  bound the authorization artifact. Raw nested plans, altered wrappers, and
  cross-chain wrappers cannot be rewrapped as current closure proof.
- Regeneration and the final-removal exporter require the same fingerprint-valid
  next-batch authorization artifact and applied removal-review fingerprint as
  the completion audit; neither adapter reconstructs approval from path checks.
- The source scanner distinguishes named control-plane inventory records from
  operational imports. It still reports a real import from an evidence service
  and marks evidence incomplete when a configured source root cannot be read.
- Focused tests cover complete, remaining, predecessor-plan, and incomplete
  source-scan outcomes.
- The public generator has an isolated-worktree artifact-chain test. It proves
  coherent current input can reach completion, remaining inventory remains
  observable, and predecessor plans or current operational imports fail closed.
  Blocked JSON is written only with explicit `--allow-blocked` diagnostic
  authorization.
- Explicit diagnostic mode now handles the realistic pre-approval state where
  a current execution plan, authorization artifact, review fingerprint, or
  validation artifact has not yet been created. It short-circuits before
  planning, source scanning, or completion-audit construction and emits only
  the exact missing categories with boolean input-presence flags. The compact
  record is non-authoritative, performs no side effects, validates only as a
  diagnostic, and cannot satisfy a closure gate. It does not write a nested
  completion-audit artifact. Default mode still exits before writing output;
  unreadable explicitly supplied JSON remains a command error.
- Relative evidence input and output paths now resolve from the requested
  `--cwd` checkout rather than the process caller directory. This keeps the
  verified artifacts, source scan, path state, and generated record in one
  checkout boundary while preserving explicit absolute-path support.

Example:

```bash
npm run --silent policy:compatibility-removal-evidence -- \
  --execution-plan-artifact .tmp/policy-storage/execution-plan-artifact.json \
  --next-batch-authorization-artifact \
    .tmp/policy-storage/next-batch-authorization-artifact.json \
  --review-artifact-fingerprint "$REVIEW_ARTIFACT_FINGERPRINT" \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/compatibility-removal-evidence.json \
  --completion-audit-artifact-output \
    .tmp/policy-storage/compatibility-removal-completion-artifact.json
```

When `--cwd <repository-root>` is supplied, every relative artifact path in
the command resolves from that repository root, not from the shell's current
directory. This prevents a checkout scan from being combined with artifacts or
outputs from a different caller directory.

Use `--require-complete` only when a complete result is an explicit release
gate. Without it, a valid remaining-inventory record is still written for
operator review. A blocked record requires explicit `--allow-blocked`; this
prevents invalid evidence from being accidentally reused as closure authority.
The nested completion-audit artifact is the only regeneration output accepted
by the current-closure command; that command's current-closure artifact is then
the input to the requirement audit.

To capture the current readiness state before a new approved chain exists:

```bash
npm run --silent policy:compatibility-removal-evidence -- \
  --allow-blocked \
  --output .tmp/policy-storage/compatibility-removal-evidence.json
```

This command intentionally exits `1` and writes only a blocked diagnostic. It
does not create an execution plan, authorization, review fingerprint, or
validation claim or nested completion-audit artifact. Supply an explicit path
only when that artifact actually exists; a supplied path that cannot be read
exits `2` and writes no output.

## Next Step

Run the regeneration command with the current plan and fresh validation
evidence. If it reports remaining inventory or blocked readiness, complete the
native cutover and deletion-readiness evidence before attempting another
closure audit.
