# Policy Legacy Builder Cutover Audit

## Status

Implemented as Phase 4R Task 4R.8 on August 7, 2026.

## Decision

A server-owned cutover audit scans the policy-authoring source tree to verify
that retired legacy builder surfaces, patterns, and workflows remain absent
from normal authoring. It enforces the 4R.8 acceptance criteria: one normal
policy-authoring path per native state, no reintroduction of raw alerts,
reset/recreate behavior, reconciliation maintenance links, or a second create
entry in normal policy authoring.

The audit is pure and side-effect-free. It reads source files, classifies
them, and reports violations. It performs no file deletion, route mutation,
policy persistence, or client rewrite.

## What The Audit Verifies

| Check | What it enforces |
| --- | --- |
| Retired diagnostic components absent | Impact/replay/preview cards, composables, utilities, and migration-verifier routes that were removed in 6R.1 must not reappear in normal authoring source |
| No browser `alert()` in policy authoring | `client/src/components/policies/` must not contain `alert()` calls |
| No reset/recreate control in normal path | No policy list action that resets and recreates a policy through a legacy path |
| No reconciliation-maintenance link in normal path | Reconciliation maintenance must live behind its named server-side boundary, not a policies page link |
| No second create entry | Only the 4R.4a lifecycle entry may open native create; no parallel modal or hash target |
| No raw threshold/weight controls in normal path | Legacy scoring weights, combination modes, and decision thresholds must not appear in normal authoring components |
| Compatibility artifacts have Phase 8R owner | Every retained compatibility artifact must carry an explicit temporary owner and deletion criterion |

## Retired Artifact Inventory

The audit consumes a frozen list of retired diagnostic artifacts (originally
defined in the 5R.8.1 cutline) and verifies they remain absent from the
repository:

- `client/src/components/policies/PolicyIntentImpactPreviewCard.vue`
- `client/src/components/policies/PolicyIntentReplayPreviewCard.vue`
- `client/src/composables/usePolicyIntentImpactPreview.js`
- `client/src/composables/usePolicyIntentReplayPreview.js`
- `client/src/utils/policyIntentImpactPreview.js`
- `client/src/utils/policyIntentReplayPreview.js`
- `server/src/services/policyIntentImpactPreview.mjs`
- `server/src/services/policyIntentReplayPreview.mjs`
- `server/src/routes/policiesRouteMigrationVerifier.mjs`

## Reintroduction Pattern Guards

The audit scans `client/src/components/policies/` source for patterns that
must not appear in normal authoring:

| Pattern | Why it is prohibited |
| --- | --- |
| `alert(` | Browser dialogs are not accessible and leak raw errors |
| `window.confirm(` in normal authoring components | Destructive actions need accessible confirmation, not browser dialogs |
| `reset_existing_policy` / `resetPolicy` action | Reset/recreate bypasses the lifecycle entry |
| `reconciliation` route/link in normal components | Reconciliation is server-side maintenance, not a normal link |
| `showMigrationVerifierPanels` | Retired modal visibility prop must not return |

## Official Guidance Reviewed

- [OWASP API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  requires endpoint inventory and retirement plans. The audit enforces the
  retirement plan for removed diagnostic components.
- [OWASP A06:2021 Vulnerable and Outdated Components](https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/)
  recommends removing unused functionality and addressing unmaintained
  components. The audit verifies retired components stay removed.
- [NIST SSDF](https://csrc.nist.gov/projects/ssdf) supports traceable,
  auditable software changes. The audit produces evidence that the cutover
  is enforced in regression coverage.
- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  recommends limiting the initial display to core features. The audit
  ensures legacy controls do not clutter the normal authoring path.

## Options Considered

### 1. Manual code review only

Pros:

- No new service.

Cons:

- No regression protection. A future PR can reintroduce a retired component
  without failing any gate.
- Not machine-checkable.

### 2. Reuse the live-entry-path inventory

Pros:

- Already tracks retired items.

Cons:

- The inventory describes intent (REMOVE disposition); it does not verify
  actual source-level absence or scan for reintroduction patterns.
- Does not check `alert()`, reset/recreate, or reconciliation links.

### 3. Build a dedicated cutover audit with source scanning

Pros:

- Verifies actual source-level cutover, not just intent.
- Scans for reintroduction patterns in client source.
- Is testable without a browser.
- Follows the proven pattern of the 5R.8.1 cutline and 5R.8.2 boundary audit.

Cons:

- Adds one more audit service.
- Requires maintaining the retired artifact list and pattern guards.

## Final Recommendation Stack

1. Build a pure, side-effect-free audit that scans the policy-authoring
   source tree.
2. Verify retired diagnostic components remain absent from the repository.
3. Scan `client/src/components/policies/` for prohibited patterns (`alert()`,
   reset/recreate, reconciliation links, second create entry, raw thresholds).
4. Confirm compatibility artifacts carry explicit Phase 8R deletion owners.
5. Fail closed when any check fails.
6. Run in regression coverage so reintroduction fails the gate before release.

## Implementation Outcome

`server/src/services/policyLegacyBuilderCutoverAudit.mjs` owns the audit.
It defines the retired artifact inventory, reintroduction pattern guards,
compatibility owner requirements, and a self-validating audit result.

Focused regression tests cover the clean current-state audit, a reintroduced
retired component, an `alert()` pattern in policy code, a reset/recreate
action, a reconciliation link, a second create entry, a missing compatibility
owner, and side-effect rejection.

## Security Outcome

- Retired diagnostic components cannot be silently reintroduced into normal
  authoring.
- No browser dialogs, reset/recreate controls, or reconciliation links
  appear in normal policy authoring.
- Compatibility artifacts have explicit temporary ownership and Phase 8R
  deletion criteria.
- One normal policy-authoring path per native state is enforced by regression.

## Next Task

The next task is **4R.9 Accessibility, Responsive Behavior, And End-To-End
Workflow Tests**, which proves the delivered flow works in the live product
through browser-level coverage.
