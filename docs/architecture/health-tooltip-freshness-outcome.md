# Health tooltip freshness: outcome

Date: 2026-10-12. See the separate
[design and official Vue research](health-tooltip-freshness-design.md).

## Cause and change

The visible badge already used the current service status, but the shared tooltip
directive's mouseenter handler retained the first mounted value. A card initially
showing Unknown could therefore keep that hover label after becoming Healthy or
Not Configured. Unrelated directive updates could also dismiss another card's
tooltip.

The directive now stores the latest binding per element in a WeakMap, tracks the
active owner, updates only that owner's visible tooltip and removes its listeners
on unmount. Repeat hovers use the current value. Plain-text rendering and the
single-tooltip limit remain intact; there is no new dependency, network request
or health-state calculation. Keyboard interaction on nonfocusable cards is not
added by this fix; status remains visible without hovering.

## Verification

- Two focused frontend files / 40 tests passed, including the real System view
  polling from Unknown to Healthy/Not Configured with the real directive.
- Seven directive cases cover repeat hover, visible updates, clearing text,
  unrelated updates/unmounts, single ownership, listener cleanup and literal
  untrusted markup.
- Two Chromium checks passed at 390px and 1280px. Each changes status and hovers
  twice, verifies current text and dismissal, and makes no API request. Screenshots
  were visually inspected after waiting for the normal fade-in to finish.
- Frontend lint and both type checks passed. Full frontend coverage passed all
  469 files / 7,190 tests; statements 87.63%, branches 81.56%, functions 87.29%,
  lines 89.33%. Twelve runner-configuration tests and eight production-navigation
  browser checks also passed.

Runtime source is `4aa3f0d9949c5d7cb639f22fcf4b583de0035580`. Local image identity,
deployment safeguards and shared verification are recorded in the
[configuration-dependency outcome](health-configuration-dependencies-outcome.md).
No release or Unraid deployment is made.

## Recommendation

Keep the shared lifecycle fix: it corrects every caller with little extra state.
A System-only workaround would leave other stale tooltips behind; replacing the
tooltip package would add scope without addressing the underlying binding error.
Treat the separately identified health-adapter/result-contract issues as the next
backend work, rather than changing labels to conceal unknown or failed checks.
