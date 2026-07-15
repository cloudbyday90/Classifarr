# Policy Native Intent Conversion Maintenance UI

## Status

Implemented as the administrator-facing completion of the explicit native
intent conversion workflow. This is a dedicated maintenance screen, not a
policy-builder section and not a runtime-automation control.

## Problem

The server already required an authenticated administrator, a bounded selected
policy scope, fresh eligibility, and a typed confirmation before native intent
conversion. Without a focused product surface, an administrator had no clear
way to review the current candidates or provide the required confirmation.

Placing this action in the policy builder would conflate durable storage
conversion with authoring a library's future classification intent. It would
also recreate the broad, manual workflow the intent-first design removes.

## Official-Source Research

- [W3C WAI: Technique H102, HTML dialog](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
  documents that a native modal `dialog` handles focus movement, focus return,
  inert background content, and `Escape` closing. The confirmation uses this
  native primitive instead of a hand-built ARIA focus trap.
- [W3C WAI: Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  requires a visible close control and describes focus placement for a
  consequential action. The dialog names its action, contains a cancel path,
  and moves focus to the confirmation field.
- [W3C WAI: Alert and Message Dialogs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
  identifies action confirmation as an appropriate alert-dialog use case. The
  UI presents the selected count and what conversion does before submission.
- [WCAG 2.2, Input Assistance](https://www.w3.org/TR/WCAG22/#input-assistance)
  requires labels, error identification, and an opportunity to review before a
  consequential submission. The screen labels every checkbox and the phrase
  field, disables invalid submission, and renders bounded server errors.
- [W3C WAI: Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)
  recommends semantic table headers and data cells. Candidate rows use a real
  table so assistive technology can retain policy and library context while
  selection changes.

## Options Considered

### Put Conversion In The Policy Builder

Pros:

- One place to find policy actions.
- Reuses the existing modal.

Cons:

- Confuses conversion of existing durable storage with authoring future
  classification intent.
- Reintroduces an advanced, operator-heavy panel into the hands-off authoring
  experience.
- Makes it easier to mistake routing readiness for conversion eligibility.

### Automatically Convert All Candidates

Pros:

- Lowest operator effort.

Cons:

- Removes explicit scope selection and review.
- Cannot communicate the verified administrator or selected policy set in a
  meaningful action boundary.
- Violates the existing server design, which intentionally avoids automatic
  conversion at startup.

### Dedicated Maintenance Screen With Typed Confirmation

Pros:

- Keeps policy authoring, native conversion, and runtime automation separate.
- Uses the bounded, server-authored preview as the only source of candidate
  eligibility.
- Gives administrators a short, reviewable conversion batch and explicit
  confirmation without exposing raw legacy policy payloads.

Cons:

- Adds one administrator-only route.
- Requires a deliberate action per batch of at most twenty-five policies.

## Final Recommendation Stack

1. A dedicated `/policies/native-intent-migration` administrator maintenance
   route, linked from the policy list but separate from ordinary authoring.
2. The existing `GET /api/policies/native-intent-conversions/preview` endpoint
   for a bounded, current candidate report.
3. Semantic candidate table rows with native checkboxes, disabled for
   review-required candidates and capped at the server's twenty-five-policy
   selection limit.
4. A native modal dialog that shows selected scope, requires
   `CONVERT_NATIVE_INTENT`, and sends only `policy_ids` and `confirmation` to
   the existing apply endpoint.
5. Refresh the preview after each successful action. The server re-evaluates
   eligibility during apply, so UI data is never accepted as authority.

## Security And Product Boundaries

- The screen never receives or displays raw legacy JSON, client-supplied actor
  identifiers, database details, or a control to bypass server validation.
- Backend authorization, CSRF protection, rate limiting, current-state
  eligibility, transactional locks, rollback snapshots, and audit events remain
  mandatory; this UI is not an authorization control.
- Conversion readiness and automation readiness remain separate. A policy can
  be selected for native conversion while its routing target still needs setup.
- Review-required candidates remain visible with concise bounded reasons but
  cannot be selected.
- Ordinary policy creation and editing do not trigger this route or its apply
  endpoint.

## Validation

- Client API tests verify the preview and apply endpoints use the expected
  contract.
- Component tests cover ready-only selection, batch limits, typed confirmation,
  and error presentation.
- Browser verification confirms the native dialog opens from the maintenance
  page and the confirmation field controls the apply action.

## Outcome

Administrators can now see exactly which policies the server says can convert,
select a bounded batch, and deliberately confirm the durable change. This
completes the product boundary for Phase 8R.3 without adding another manual
policy-design workflow.
