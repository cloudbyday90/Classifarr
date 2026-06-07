# Final Outcome vs Original Signal Snapshot Separation

Date: 2026-06-07

## Problem

Classification History can show a manually resolved final outcome while still rendering the signal breakdown captured during an earlier automated attempt. Before this change, the detail modal labeled the top card as the classification result and the signal footer as `Combined Score`, using the final row confidence. That made a final manual outcome such as `Movies (100%)` appear to be backed by the original RAG-only diagnostic snapshot.

The correct model is:

- Final outcome: the current canonical result and confidence.
- Classification lifecycle: the ordered audit path that led to the final row.
- Original signal snapshot: immutable diagnostic evidence captured during the automated attempt.

## Official-Source Research

- W3C Trace Context is a W3C Recommendation for propagating trace identity and supports correlating work across systems without mixing unrelated event meaning into a single field: https://www.w3.org/TR/trace-context/
- OpenTelemetry defines traces as trees of spans, where child spans represent sub-operations and attributes/events add bounded context. This supports separating operation diagnostics from final business outcomes: https://opentelemetry.io/docs/specs/otel/trace/api/
- OpenTelemetry common concepts require attributes to be bounded key-value data with unique keys and default truncation limits, which matches our approach of derived, compact UI view models instead of raw metadata dumps: https://opentelemetry.io/docs/specs/otel/common/
- OWASP Logging guidance calls out application logs as operational/security evidence and notes that process monitoring, audit trails, and transaction logs often have different purposes and should be kept separate: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Vue's official guidance recommends computed properties for complex reactive logic that would otherwise clutter templates, and conditional rendering for blocks that should only exist when the condition is true: https://vuejs.org/guide/essentials/computed.html and https://vuejs.org/guide/essentials/conditional.html
- W3C WAI-ARIA guidance exists to make dynamic web application controls and content accessible to assistive technologies; this reinforces explicit section headings and stable labels in the modal: https://www.w3.org/WAI/standards-guidelines/aria/

## Options Considered

### Option A: Rename Existing Signal Panel Only

Pros:

- Smallest UI change.
- Low risk.

Cons:

- Leaves the incorrect score binding to the final row.
- Does not explain when final outcome and signal snapshot differ.
- Does not create a reusable model for future History panels.

### Option B: Add Backend Snapshot Fields

Pros:

- Makes the API contract explicit.
- Could standardize snapshot source and score at write time.

Cons:

- Requires database/API compatibility work.
- Does not immediately fix already persisted rows.
- Higher risk for a UI clarity bug.

### Option C: Client View-Model Separation

Pros:

- Fixes existing rows immediately.
- Keeps immutable persisted metadata untouched.
- Uses a focused ES module utility that can be unit tested.
- Keeps `History.vue` template labels direct and readable.

Cons:

- Snapshot source inference depends on currently returned lifecycle events.
- Future API contracts may still benefit from server-side explicit snapshot metadata.

## Final Recommendation Stack

1. Keep the canonical history row as the final outcome.
2. Render final outcome, lifecycle, and signal snapshot as separate History modal sections.
3. Derive signal snapshot score from persisted `calculated_confidence`, explicit candidate scores, or final row confidence only when there is no later final outcome.
4. Derive snapshot source from the matching non-final signal-producing lifecycle event when possible.
5. Keep the derivation in `client/src/utils/historySignalSnapshot.js` as a pure ES module with direct unit tests.
6. Continue showing bounded trace and RAG evidence panels as diagnostics, not final routing proof.

## Security And Privacy Boundaries

- Do not expose raw prompts, provider payloads, vectors, or unbounded metadata in the History modal.
- Reuse existing sanitized classification metadata and lifecycle rows.
- Keep labels derived from existing method, confidence, date, and library fields.
- Avoid adding new persisted sensitive fields for this UI-only separation.

## Implemented Outcome

- Renamed the top result panel to `Final Outcome`.
- Renamed the signal section to `Original Signal Snapshot`.
- Added snapshot source, snapshot date, final outcome summary, and a warning when the snapshot differs from the final row.
- Changed the signal footer from final confidence to snapshot confidence.
- Added `client/src/utils/historySignalSnapshot.js` with tested view-model derivation.
- Added regression coverage for a manual final outcome at 100% with an original AI/RAG snapshot at 72%.

## Next High-Value Design Targets

1. Policy candidate evidence calibration: tune broad genre support so generic `Comedy` evidence does not over-promote specialized destinations like `Comedy and Standup`.
2. RAG evidence quality gating: demote or exclude neighbors that lack trusted final outcomes, known library identity, matching media type, or profile compatibility.
3. Manual outcome learning loop: use final manual corrections as clean training/validation signals without reintroducing intermediate attempts as duplicate outcomes.
