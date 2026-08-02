# Policy Authoring Live Entry-Path And Action Inventory

Status: Source audit complete; live-browser evidence pending an approved browser
session.

## Decision

Phase 4R.1 uses a small deterministic inventory contract rather than another
policy-builder panel. It records each current policy-authoring entry point and
visible action, its client and server boundary, the current reachability
outcome, and the component that owns its replacement or removal.

The inventory is intentionally evidence-oriented. It confirms that named source
artifacts remain present and that every recorded control has one classification;
it does not claim that importing a component, mounting it in a unit test, or
capturing a historical screenshot proves the current browser flow works.

The current source audit establishes a material product gap: native policy
creation is implemented behind `PolicyBuilderModal`, but `/policies` has no
normal create trigger. `showCreateModal` is initialized and cleared in
`PolicyList`, but no source path assigns it `true`. The current primary policy
screen therefore reaches existing-policy configuration but not native creation.

## Scope And Method

The inventory uses the current route, list, modal, workflow, API, and server
route graph. It classifies controls as one of:

- server-backed action contract;
- local typed draft command;
- accessible navigation;
- read-only information; or
- replacement or removal candidate.

The contract lives in
`server/src/services/policyAuthoringLiveEntryPathInventory.mjs` with a focused
repository-artifact and classification test. It has no route, database,
scheduler, provider, mutation, or browser authority.

## Research Basis

- W3C's conformance-evaluation methodology requires scope, exploration,
  representative sampling, evaluation, and reporting. The source inventory is
  therefore explicit evidence only; it is not a replacement for representative
  rendered-state evaluation. [W3C Conformance Evaluation
  Methodology](https://www.w3.org/WAI/test-evaluate/conformance/)
- W3C's modal-dialog pattern requires focus to move into the dialog, remain
  contained while modal, close with Escape, and return to the invoker or another
  logical location. Any retained modal path must prove those behaviors in the
  live browser. [W3C Modal Dialog
  Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- WCAG 2.2 status-message guidance requires success, waiting, result, and
  error updates that do not change context to be programmatically available
  without unnecessarily interrupting the user. Action feedback must be scoped
  to the action that produced it. [W3C Understanding Success Criterion
  4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
- OWASP requires authorization on every request to be enforced server-side and
  authorization failures to exit safely without exposing sensitive details.
  Browser controls can describe availability, but the server remains the
  authority for native policy creation and every protected operation. [OWASP
  Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## Current Entry Points

| Entry point | Current result | Classification | Owner |
| --- | --- | --- | --- |
| `/policies` | Renders `PolicyList`, the legacy list and modal host | Replace | 4R.2 |
| Existing `Configure` | Fetches a policy, then opens one modal for native inspection, recovery, or legacy edit | Replace | 4R.7 |
| Native create modal | Supports native-create mode, but has no normal `PolicyList` opener | Replace | 4R.2 / 4R.3 |
| `/policies#policy-builder-advanced-settings` | Has no current hash target; a test asserts that the former target is absent | Remove | 4R.8 |
| Native-intent reconciliation route | Explicit router `admin-maintenance` route | Out of normal authoring scope | 8R maintenance |

## Representative States

| State | Current source path | Current evidence status | Required outcome |
| --- | --- | --- | --- |
| New library | Native-create modal with no persisted policy | Component exists, normal entry is unreachable | One small safe starting action; no false identity claim |
| Well-profiled library | Workflow shell and signal picker | Component exists, normal entry is unreachable | Server-derived proposal with explicit create admission, not mandatory reselection |
| Sparse library | Empty-state notice | Component exists, normal entry is unreachable | Guidance or one admitted navigation without a browser recovery action |
| Unmapped library | Empty-state route handoff to `LibraryDetail` | Component exists, normal entry is unreachable | Navigation with focus handoff; no routing execution in the browser |
| Automatic recovery | Native summary or recovery notice through existing Configure | Source-reachable through legacy list action | Informational, read-only automatic recovery state |
| Persisted native policy | Native summary through existing Configure | Source-reachable through legacy list action | Inspection and intentional maintenance must become separate actions |

The browser session available for this audit was denied by an enforced
local-access security check. That control was not bypassed. The inventory marks
live-browser evidence as pending; it does not reinterpret the current source
graph as a rendered-path success.

## Action Ledger

| Action | Boundary | Current outcome | Disposition |
| --- | --- | --- | --- |
| Open existing policy | `GET /policies/:id` | Opens an overloaded modal | Replace in 4R.7 |
| Reset existing policy | `DELETE /policies/:id` | Deletes and recreates a legacy policy after browser confirmation | Remove in 4R.8 |
| Show scoring weights | Local toggle | Exposes legacy scoring mechanics | Remove in 4R.8 |
| Create native policy | `POST /policies` with native establishment | Server-owned transaction, but no normal opener reaches it | Bind after 5R.1/5R.2 in 4R.3 |
| Defer creation | Local modal close | Leaves persistence untouched | Retain as explicit no-save action |
| Select and accept observed values | Local typed draft commands | Requires manual reselection before current create admission | Replace with proposal default in 4R.4 |
| Validate custom value | Named API operation | Returns a display-only workflow refresh; no persistence | Retain inside 4R.5 adjustment disclosure |
| Stage or clear boundaries | Local typed draft commands | Optional controls are default-visible | Move to material exception controls in 4R.6 |
| Open library mapping | Router navigation and focus handoff | Opens library mapping; does not route media | Retain for a declared routing exception |
| Inspect native summary or recovery | Read-only readiness projection | No intentional maintenance entry after inspection | Split in 4R.7 |

## Findings

1. Native creation has a valid protected server transaction but no normal UI
   entry point. Adding a button directly to the legacy list would hide the
   deeper presentation and action-admission gaps, so it is not the selected
   fix.
2. `PolicyCard` is still the normal authoring path and exposes preset counts,
   threshold values, reset, Configure, and raw scoring weights. This conflicts
   with the destination-first product model and must be removed only after its
   replacement is live.
3. The workflow already knows observed values, but its picker requires explicit
   checkbox selection and an add action before creation. That is an adjustment
   mechanism, not the ready-path default.
4. Optional hard limits, avoid values, and review triggers render whenever the
   constraint model is available. They should be hidden until a server-declared
   material exception requires them.
5. The native summary can report recovery and readiness, but it has no distinct
   maintenance entry. `Configure` currently conflates inspection, recovery, and
   legacy editing.
6. The former advanced-settings hash is not live and must not be preserved as a
   deep-link contract.

## Options Considered

### Add A Create Button To The Existing List

Pros: Restores a visible path to the existing native-create modal quickly.

Cons: Makes the legacy list the permanent primary authoring surface, retains
manual observed-value reselection, and binds a new visible action before the
server contract and action result are reconciled.

Decision: Rejected.

### Rewrite The Builder Before Capturing The Current Path

Pros: Can produce a cleaner visual result in a single change.

Cons: Loses the baseline needed to prove which control was removed or replaced;
risks recreating readiness or authorization logic in the browser; makes dead
actions difficult to detect.

Decision: Rejected.

### Source Inventory, Then Server Authority And Presentation Work

Pros: Keeps the browser as a bounded projection and command forwarder; exposes
the missing create path as an explicit replacement requirement; lets 5R.1 and
5R.2 establish the authoritative server contract before 4R.2 and 4R.3 create
a new live action; preserves automatic recovery as automatic.

Cons: Requires maintaining a small evidence ledger and completing a permitted
live-browser run before Phase 4R acceptance is complete.

Decision: Selected.

## Final Recommendation Stack

1. Complete **5R.1 Server Intent Contract Authority**, then **5R.2 Write
   Preflight And Persistence Boundary**. Establish one versioned, server-owned
   intent and admitted write result for every client.
2. Implement **4R.2 Server Workflow Presentation Adapter** on `/policies` from
   that validated projection. It replaces the legacy list as the normal
   authoring cutline; it does not add a second modal path.
3. Implement **4R.3 Action Binding And Admission Feedback** before placing the
   new create/save action in the product. Each action must have one pending,
   success, rejection, unavailable, and focus/status outcome.
4. Implement 4R.4 through 4R.8 in order: proposal first, adjustments and
   material exceptions only when relevant, intentional persisted-policy
   maintenance, then legacy card/modal/hash removal.
5. Run 4R.1 representative-state verification and 4R.9 browser end-to-end
   coverage in a browser session permitted to access the local application.

## Outcome And Verification

- Added `policyAuthoringLiveEntryPathInventory.mjs`, a pure, versioned,
  maintainer-facing inventory contract.
- Added a focused Jest suite that verifies artifact presence, action and entry
  classifications, known remediation records, and fail-closed invalid input.
- The audit deliberately reports the current product state as
  `source_audited_remediation_required`, not live-authoring ready.
- Focused verification: `cd server && node ./scripts/run-jest.mjs
  --testPathPatterns="policyAuthoringLiveEntryPathInventory.test.mjs"
  --no-coverage`.

## Next Task

**5R.1 Server Intent Contract Authority** is the next implementation task.
It is the first dependency gate for the replacement `/policies` presentation
and for an admitted native create or save action.
