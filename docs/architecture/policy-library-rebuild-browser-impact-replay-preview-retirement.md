# Policy Library-Rebuild Browser Impact And Replay Preview Retirement

## Status

Implemented as Phase 6R.6 Task 6R.6.11.2.

The impact/replay browser preview component family was deleted in commit
`3dc018e9`. This task completes its controlled retirement by removing the
already-absent client files from current removal inventories, modal
orchestration metadata, migration candidate reports, and active presentation
test documentation.

## Problem

The current source tree had no browser preview cards, composables, utilities,
or focused browser tests. However, the migration deletion ledger still listed
those absent files as pending removal and the modal contract still stated that
the modal composed the cards. That made repository-retirement fingerprints and
architecture audits describe an impossible current state.

The retained server-side migration verifier is a separate concern. It remains
outside normal authoring and is not removed by this task.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege and deny-by-default. Keeping migration
  verification out of the browser authoring path avoids an unnecessary client
  capability.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats configuration state as controlled and monitored. Current removal
  inventories must describe the source that actually exists.
- [Microsoft Well-Architected testing guidance](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/testing)
  recommends layered, independent tests. This change uses focused contract
  tests for source inventory and modal boundaries while retaining server
  verifier coverage.
- [Microsoft Well-Architected safe deployment guidance](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends small, quality-gated releases. This is a metadata and contract
  correction with no policy, routing, provider, scheduler, or database write.

## Options Considered

### 1. Keep absent browser files in the retirement ledger

Pros:

- Preserves the original deletion history in the live inventory.

Cons:

- Produces fingerprints for files that cannot be deleted.
- Leaves modal and migration reports inconsistent with production source.

### 2. Recreate the preview UI to match stale contracts

Pros:

- Makes the stale records appear accurate.

Cons:

- Reintroduces a browser diagnostic path that the product model excludes.
- Expands client authority and normal-workflow complexity without improving
  policy establishment.

### 3. Retire stale browser references and retain server verification

Pros:

- Makes retirement evidence reflect the current repository.
- Preserves the server-only migration verifier for later gated retirement.
- Keeps the authoring bundle and modal contract free of migration diagnostics.

Cons:

- Maintainers use server-side verification evidence rather than an authoring
  panel.
- The later server-verifier retirement remains a separate gated task.

## Final Recommendation Stack

1. Keep the removal ledger limited to source artifacts still present in the
   repository.
2. Remove browser-preview extraction targets and touchpoints from the modal
   orchestration contract.
3. Remove the browser-preview deletion impact from migration candidate reports.
4. Preserve server verifier routes, services, and tests until Task 6R.6.11.3
   proves their independent retirement gates.
5. Use focused inventory and modal-contract tests, then normal quality gates,
   to prevent stale browser references from returning.

## Implementation Outcome

- Removed 12 already-absent browser preview paths from
  `policyMigrationDeletionPath.mjs`.
- Removed the obsolete diagnostic-preview extraction target and touchpoint from
  the modal orchestration contract.
- Removed the stale browser-preview deletion-impact record from the migration
  candidate report.
- Removed obsolete browser-preview test metadata and corrected active
  architecture records.

No browser component, API method, server verifier, policy write, routing
operation, provider call, scheduler action, database migration, or repository
write capability was added.

## Verification

- Focused server tests cover current removal inventory, modal orchestration,
  presentation-test inventory, and migration candidate reports.
- Client tests continue to prove the normal modal flow has no migration
  diagnostic panel.
- Full repository tests, linting, type checks, documentation linting, static
  ESM checks, and coverage ratchet validate the release.

## Next Task

Phase 6R.6 Task 6R.6.11.3 is **Legacy Migration-Verifier Service Retirement**.
It must evaluate only the still-present server verifier route, services, and
tests against current cutover/rollback evidence before deleting any runtime
artifact.
