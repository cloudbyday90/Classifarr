# Neutral advice for unresolved generic classification

Research: November 10, 2026 Eastern. Baseline main 071b38924. Status: agreed;
the operator confirmed the complete scope before implementation. Work stays on
main; no release or deployment.

## Demonstrated problem

`aiResponseParserResults.getDefaultLibrary` prefers broad movie/TV names and
otherwise the last supplied library. Generic fallback, contract violations and
valid clarification results can therefore carry a primary destination without
evidence that it is the right destination. Contract-violation text can even call
that heuristic or raw `signalContext.suggestedLibrary` a deterministic preference.
An out-of-set raw suggested object can become the returned target despite the
displayed options being checked against the supplied list.

There is a related mode mismatch: JSON CLARIFY treats any truthy signal context
as verification, while pipe CLARIFY checks explicit mode. The production generic
owner supplies aggregate signal context, so this is a live consumer boundary.
That context is an ordinary object, not a privately bound reference. Confidence,
membership or source-shaped fields cannot establish a new primary recommendation.

The existing platform supports a pending result with `library: null`: persistence
stores null library fields, normalizer/review code offers known choices, web and
Discord use explicit destination actions, and the real route gate rejects a
missing library. Completed rows still require a valid library. No new schema,
UI surface or workflow is needed.

## Proposed complete first batch

Limit new behavior to fresh **generic classify** unresolved outcomes: invalid or
missing responses, malformed/contract-violation responses and valid pipe/JSON
CLARIFY. Return `library: null` and require clarification; no name, list position,
matched partial option or raw signal-context hint becomes the primary library.
Use neutral question/explanation text without asserting that deterministic
scoring favors a guessed destination. Suggested-primary metadata is null.

Keep known options as explicit choices. Preserve current validated-option order
and deduplication, matched-choice-first presentation where already applicable,
and the four-choice presentation cap. Remove only heuristic/default promotion.
Valid CLARIFY retains its two/three matched options and provider question text.
The existing normalizer and resolution path continue enforcing active/media
scope and current fingerprint/action membership. Option order/capping is not
ranking, identity proof or new permission.

Use the current classify diagnostic confidence/default rules and error IDs;
do not change policy scores, thresholds, calibration or ranking. Fix JSON's mode
check so signal-context presence alone cannot select verification. JSON classify
CLARIFY now uses the existing classify clarification contract/defaults, including
its pending-state meaning, rather than the verification advisory contract.
Diagnostic numbers do not prove a destination recommendation.

Own the generic unresolved projection in small pure service leaves, with explicit
mode-aware dispatch from the existing parser. Preserve valid CONFIDENT and
successful repair proposals. Keep actual verify/adjudicate paths, including
early invalid-input behavior, on their existing contracts. The shared legacy
factories/default helper may remain isolated for those compatibility callers;
do not silently change every caller or repurpose structural verification fields
as generic proof. Keep provider admission, repair/transient attempt bounds,
quotas, cancellation, routing and learning authorization unchanged.

Apply prospectively. Do not regenerate stored questions, infer historical
recommendations, upgrade old evidence or reinterpret receipts/action kinds.
Explicit candidate selection still uses the existing confirm_destination command;
that command is not automatically confirmation of a prior prediction. Preserve
completed replay, receipt recovery and transaction/ownership safeguards.

Add no UI, endpoint, API field, capture/schema version, setting, job, operator CLI
trigger, provider call or live configuration write. The separate AI-unavailable/
recovery last-library fallback in `classificationPathServiceShared.mjs` remains
a recovery follow-up. This does not make every platform fallback category-neutral.

## Verification and delivery

- Freeze old failures for renamed/reordered libraries, out-of-set/copied/raw
  high-confidence hints and pipe/JSON clarification parity. Verify generic
  unresolved results have no primary destination, bounded choices and neutral
  explanation/metadata; retain successful proposals and legacy-mode controls.
- Exercise actual local/custom loopback HTTP, existing repair success/failure
  and transient limits, and the production generic owner. A model result or raw
  signal context cannot bypass the real automatic-route gate.
- Use the production PostgreSQL factory against disposable data for fresh null
  pending persistence, explicit authorized resolution and exact completed replay.
  Retain stale/unauthorized rejection and the completed-library constraint.
  Send no real Arr command or paid/live provider request.
- Exercise the protected pending response, shared review reference, web/Discord
  choice presentation and bulk-confirm omission. Preserve the existing neutral
  selection controls without a new page or action protocol.
- Run fresh backend/client coverage, affected browser checks, lint/type/Knip,
  ownership/policy/ESM gates, audits and the coverage ratchet with current reports.
  Preserve assertions, timeouts, installed pins, scanner policy, ownership
  classifications and review limits. Perform scoped artifact maintenance.

Record observed results in a separate outcome document and update Unreleased.
Commit/push all agreed changes on main and inspect the exact code commit's CI.
No branch, release, deployment, historical backfill or production cleanup.

## Official guidance and application

Sources were discovered/opened through MCP on the research date.

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes data from its
  provenance. Our application is to represent missing recommendation proof
  explicitly instead of turning names, array order or ordinary context into
  attribution. No new RDF/PROV implementation or conformance claim.
- [W3C headings and labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
  supports accurate, descriptive cues; [labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
  supports sufficient guidance without unnecessary clutter. Reuse existing
  destination choices and remove the unsupported deterministic claim. This
  batch does not establish complete WCAG conformance.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires explicit permission enforcement at each request. Preserve server-side
  resolution, current membership and route/learning gates. Neutral advice itself
  is not an authorization boundary or a newly demonstrated vulnerability fix.

## Alternatives, pros/cons and recommendation stack

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| No primary for generic unresolved advice | Removes the demonstrated heuristic and false explanation with existing UI | Operator must choose; no new proof is created | First batch |
| New calculator-reference/provenance protocol | Could retain some independently bound advisory references | Adds a capture/binding/lifecycle boundary before its need is established | Separate design |
| Choose by name, first/last position or confidence | Small implementation | Supplies no destination proof and can mislead review | Reject |
| Change all verification/recovery fallbacks together | Wider coverage | Mixes parser advice with capability and recovery contracts | Separate follow-ups |

First qualify this generic uncertainty boundary. Then inspect AI-unavailable
recovery advice using its own recovery workflow and safeguards. Keep broader
purpose projection, unchanged compiler deferral and corrected runtime artifacts
as separate work; runtime-security qualification remains ahead of publication.
