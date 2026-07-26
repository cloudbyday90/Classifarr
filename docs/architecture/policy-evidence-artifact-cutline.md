# Policy Evidence Artifact Cutline

## Status

Implemented as a static completion-audit component for Phase 6R.1.

## Problem

The policy-engine artifact inventory records every active legacy group and its
Keep, Rewrite, Replace, or Delete decision. The evidence engine separately
defines allowed buckets and source admission. Without an explicit reconciliation
contract, a new or renamed legacy group can have a cutline decision but no
bounded successor, and an evidence replacement can claim an invalid source or
bucket relationship.

This is a build-integrity concern, not a media-classification runtime concern.
The running service must not scan its checkout to decide whether a library can
be classified.

## Research

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early, server-side allowlist validation. The cutline uses fixed
  group, successor, bucket, and source IDs, and rejects all unmapped values.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  recommends data-flow analysis and validation at trust boundaries. The audit
  traces active legacy groups to one bounded successor before completion is
  recorded.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined, verified software security requirements. The completion
  audit records this reconciliation as a deterministic, testable requirement.

## Options

### Reconcile During Runtime Evidence Handoff

Pros:

- Every handoff would recheck the current cutline.

Cons:

- Couples media classification to repository files and deployment layout.
- Repeats static work for every library request.
- Can turn a maintenance concern into an operator-visible outage.

### Infer A Successor From Names Or Ownership

Pros:

- Requires less maintained configuration.

Cons:

- File and owner names cannot prove which evidence source or bucket is safe.
- Renames can silently change inferred behavior.

### Explicit Static Successor Mapping

Pros:

- Every active Rewrite, Replace, or Delete group has one reviewable successor.
- Evidence successors must use existing source-to-bucket admission.
- Runtime remains independent of the checkout audit.

Cons:

- New cutline groups require a deliberate successor mapping.

## Final Recommendation Stack

1. Keep active artifact decisions in `policyEngineArtifactInventory.mjs`.
2. Keep group-to-successor reconciliation in a separate pure service.
3. Allow evidence mappings only through existing evidence bucket and source IDs.
4. Require every other active group to name a bounded downstream successor.
5. Run the audit through policy-engine completion checks, never the runtime
   library evidence handoff.

## Outcome

`policyEvidenceArtifactCutline.mjs` reconciles all active rewrite, replacement,
and deletion groups. The template-name heuristic is the only direct evidence
successor: it uses identity and compatibility evidence from the observed media
server library profile, with optional operator-declared identity confirmation.
Scoring, workflow, intent, readiness, and migration groups remain mapped to
their respective engine successors rather than being mislabeled as evidence.

The audit performs no database, media-server, provider, policy-storage, or
network activity. `policyEngineCompletionAudit.mjs` consumes it as the
`evidence_artifact_cutline` component.

## Verification

Focused tests prove that the audit:

- maps every active Rewrite, Replace, and Delete group exactly once;
- rejects missing, duplicate, or unknown successor mappings;
- rejects unknown evidence buckets and sources;
- enforces source-to-bucket admission for evidence successors; and
- blocks completion when the underlying artifact inventory is invalid.
