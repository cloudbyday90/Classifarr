# Policy Compatibility-Removal Evidence Regeneration

## Intent

Compatibility-removal closure evidence must describe the current checkout and
the current validation result. A predecessor artifact can document historical
work, but it cannot prove that the present execution-plan contract, source
reference state, or validation results still satisfy the closure conditions.

This component adds a read-only regeneration path. It receives an explicit,
current compatibility-deletion execution plan and current validation evidence,
then derives filesystem state and source-reference evidence from the checkout.
It emits a current completion-audit artifact only when those inputs validate.
It never treats a historical plan as current approval and never deletes,
archives, mutates storage, writes manifests, or runs Git.

## Official-Source Research

- NIST's Secure Software Development Framework (SSDF) treats secure delivery
  as an outcome-based process and calls out collection and sharing of release
  component provenance in PS.3.2. Current closure evidence therefore binds
  plan, repository state, and validation rather than accepting an unverified
  historical summary.
- NIST's 2026 DevSecOps project describes risk-based practices aligned to SSDF.
  A read-only generator that produces explicit blockers supports that model: a
  failed readiness condition becomes evidence for the next decision instead of
  a reason to weaken the gate.
- SLSA artifact verification requires evidence to match consumer expectations;
  absent or mismatched provenance must fail verification. The regeneration path
  rejects predecessor execution-plan contract versions before they can support
  a current completion claim.

Sources:

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
- [NIST DevSecOps Practices](https://csrc.nist.gov/pubs/other/2026/03/24/devsecops-practices/iprd)
- [SLSA Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)

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

### Regenerate From A Current Explicit Plan

Pros:

- preserves operator approval as an input rather than fabricating it,
- derives path state and source references from the current checkout,
- rejects predecessor contracts and reports incomplete readiness clearly,
- is safe to run repeatedly because it is read-only.

Cons:

- cannot complete until deletion readiness produces a current execution plan,
- requires fresh validation evidence for each closure attempt.

## Final Recommendation Stack

1. Require the current `policy.compatibility_deletion_execution_plan.v1`
   execution-plan contract before accepting removal evidence.
2. Derive manifest path state from the checkout at generation time.
3. Scan source roots for operational references, while treating only named
   control-plane manifest inventories as evidence rather than dependencies.
4. Require completed source scanning plus focused and full validation evidence.
5. Emit a current completion artifact even when it is incomplete, so downstream
   gates report the real readiness blocker.
6. Do not synthesize deletion approval, run deletion actions, or alter storage.
7. Pass only a complete, valid generated artifact to the storage closure gates.

## Implementation Outcome

Implemented:

- `policyCompatibilityRemovalEvidenceRegeneration.mjs` composes current plan,
  path-state, source-reference scan, and validation evidence into a durable
  regeneration record and nested completion-audit artifact.
- `generate-policy-compatibility-removal-evidence.mjs` exposes that read-only
  collection path through `npm run policy:compatibility-removal-evidence`.
- Completion audits now reject a predecessor execution-plan contract, so an
  old plan cannot be rewrapped as current closure proof.
- The source scanner distinguishes named control-plane inventory records from
  operational imports. It still reports a real import from an evidence service.
- Focused tests cover complete, remaining, predecessor-plan, and incomplete
  source-scan outcomes.

Example:

```bash
npm run --silent policy:compatibility-removal-evidence -- \
  --execution-plan .tmp/policy-storage/execution-plan.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/compatibility-removal-evidence.json \
  --completion-audit-artifact-output \
    .tmp/policy-storage/compatibility-removal-completion-artifact.json
```

Use `--require-complete` only when a complete result is an explicit release
gate. Without it, the command writes an incomplete or blocked evidence record
for operator review and the next readiness task.

## Next Step

Run the regeneration command with the current plan and fresh validation
evidence. If it reports remaining inventory or blocked readiness, complete the
native cutover and deletion-readiness evidence before attempting another
closure audit.
