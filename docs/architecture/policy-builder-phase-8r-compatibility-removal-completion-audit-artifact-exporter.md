# Policy Builder Phase 8R Compatibility Removal Completion Audit Artifact Exporter

## Intent

Phase 8R.31 generates a machine-readable Phase 8R.21 compatibility removal
completion audit artifact from:

- Phase 8R.20 completion or remaining-inventory authorization JSON,
- Phase 8R.15 execution-plan JSON with approved manifest entries,
- verified Phase 8R.19 removal verification evidence,
- final import/reference scan evidence,
- focused and full validation evidence.

This component does not delete files, archive files, write manifests, mutate
storage, run tests, run source scans, or run Git commands. It produces an audit
artifact that either proves compatibility removal is complete, reports bounded
remaining inventory, or blocks completion with explicit risks.

## Official-Source Research

- Git `grep` documents bounded source searches across tracked files, the index,
  or tree objects. The artifact consumes final reference-scan evidence rather
  than running implicit searches.
- Git glossary pathspec documentation defines exact path selection concepts.
  The audit remains tied to approved manifest paths instead of broad selectors.
- NIST SP 800-128 frames configuration management as controlled change with
  integrity monitoring. The artifact verifies the final compatibility-removal
  state before the phase exits cleanup mode.
- NIST SP 800-218 SSDF recommends secure development practices across the SDLC.
  The artifact preserves evidence that legacy compatibility code was removed
  only after validation and scan evidence passed.
- OWASP API9:2023 Improper Inventory Management treats stale or unmanaged
  surfaces as a risk. The artifact treats compatibility paths as inventory that
  must be proven removed or explicitly reported as remaining.

Sources:

- Git `grep` documentation:
  <https://git-scm.com/docs/git-grep>
- Git glossary pathspec documentation:
  <https://git-scm.com/docs/gitglossary>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST SP 800-218 Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Consume Phase 8R.20 Authorization Directly

The artifact exporter should consume Phase 8R.20 authorization JSON instead of
inferring completion from current files alone.

Pros:

- preserves the last authorized removal-loop state,
- distinguishes completion from remaining inventory,
- keeps the audit tied to operator-reviewed evidence.

Cons:

- operators must preserve the authorization artifact.

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

- tells operators to continue the 8R.17 through 8R.20 loop,
- avoids treating expected incremental cleanup as corruption,
- makes final checkpoint inputs precise.

Cons:

- downstream consumers need to handle a non-complete but valid state.

## Final Recommendation Stack

Use this stack for Phase 8R.21 audit artifact export:

1. Require Phase 8R.20 authorization JSON.
2. Require Phase 8R.15 execution-plan JSON with approved manifest entries.
3. Require verified Phase 8R.19 removal verification evidence.
4. Require final import/reference scan evidence covering every manifest path.
5. Block completion if references remain.
6. Require focused and full validation evidence to pass.
7. Emit `complete`, `remaining_inventory`, or `blocked` artifact status.
8. Reject file deletion, archive, route/test removal, storage mutation,
   manifest writes, and Git side effects.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact.mjs`.
- Added `generate-policy-builder-phase-8r-completion-audit.mjs`.
- Added root npm script `policy:phase8r:completion-audit`.
- Added focused tests for:
  - complete audit artifact generation,
  - remaining-inventory artifact generation,
  - blocked final reference scan evidence,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added the completion-audit artifact suite and this design doc to the fixed
  Phase 8R validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:completion-audit -- \
  --completion-authorization .tmp/phase8r/next-batch-authorization.json \
  --execution-plan .tmp/phase8r/execution-plan.json \
  --input .tmp/phase8r/completion-audit-input.json \
  --output .tmp/phase8r/completion-audit.json \
  --artifact-output .tmp/phase8r/completion-audit-artifact.json
```

## Next Step

Use the generated Phase 8R.21 audit JSON as input for Phase 8R.32 completion
checkpoint artifact export. That exporter should package the final Phase 8R.22
checkpoint evidence from the roadmap, contracts, tests, docs, changelog,
validation evidence, and completion audit.
