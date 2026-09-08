# Held-out Semantic Study Readiness Visible Refresh Outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-study-readiness-visible-refresh-design.md) for the
research, alternatives, and recommendation stack.

## Outcome

Classifarr now updates the passive held-out semantic-study readiness panel every
five minutes while the reconciliation page is visible, and once when the page
returns from a hidden state. It uses the existing administrator-only aggregate
endpoint and remains below its rate-limit budget during ordinary use.

The initial load remains in the reconciliation view. The new wrapper starts
only subsequent reads, preventing a duplicate mount request. A request sequence
in the readiness loader rejects late responses so an older aggregate cannot
replace a newer status.

The AI readiness refresh behavior is unchanged but now uses the shared bounded
visible-page lifecycle. This removes duplicated lifecycle code while keeping
each authority-specific wrapper small and explicit.

## Boundaries preserved

- No policy, library, configuration, receipt, provider, media, prompt,
  response, label, or cohort identity reaches the browser.
- Hidden pages make no automatic read, and visible updates never move focus.
- A refresh only reads existing aggregate state. It cannot start the private
  audit, create a cohort, collect labels, call AI, select semantic evidence,
  mutate policy, or route media.
- Server-side authentication, no-store behavior, closed response validation,
  and rate limiting remain the controlling security boundaries.

## Validation

Focused Vitest coverage verifies the existing AI lifecycle remains intact, the
held-out wrapper skips the duplicate mount fetch, refreshes on its five-minute
interval, stays idle while hidden, and refreshes after visibility returns.
The readiness loader test verifies an older response cannot overwrite a newer
one.

## Next item

Wait for ordinary native authoring to create a current normal lifecycle receipt
and complete retained declared-purpose evidence. The existing receipt-triggered
audit can run after the passive status becomes `eligibility_audit_available`.
Only a balanced real 24–32-case eligible cohort may then progress to
independent labels, adjudication, readiness, and frozen-study preflight.
Semantic counter-evidence remains conditional on a good measured error profile
and may only refer ambiguity to review.
