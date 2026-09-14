# Unseen profile-comparison diagnosis design

Date: 2026-09-13. Scope: one automatic diagnostic component; no release.

## Finding

The previous recovery commit fixed a real 64-pass exhaustion and preserved all
29 completed starts. All six CI workflows passed. Its next recommendation was
to evaluate disagreements on genuinely unseen content before changing routing.

The existing observer cannot distinguish unfinished learning from disagreement
between fitted models: both become `unstable_profiles`. Likewise, an absent
positive description match and tied destinations both become `ambiguous_profiles`.
The UI combines these with known items, duplicates and unavailable inputs. That
does not reveal whether further recovery or better content matching is needed.

## Decision and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Raise confidence or ignore an alternative | More completed comparisons | Conceals uncertainty; reject |
| Send every disagreement to an AI judge | Potential semantic explanation | Extra cost, privacy exposure and another prediction rather than verified truth; defer |
| Classify existing comparison failures precisely | No extra inference; preserves all candidates; identifies the next matching problem | Diagnoses disagreement, not correctness; implement |
| Retain full per-item diagnostic histories | Rich investigation | Additional sensitive storage and lifecycle complexity; unnecessary for this slice |

Recommended stack: content-neutral candidate comparison, source-verified bounded
observer, fixed aggregate projection, existing SWR summary with collapsed details.
No new endpoint, setting, database table or user acknowledgement is needed.

## Implementation contract

Extract candidate geometry comparison into a small ESM module independent of media
type, titles, genres and library names. Preserve the current positive-score and
tie rules, all three starts plus selected view, and complete candidate scope.
Never discard an inconvenient candidate to obtain agreement.

Replace the coarse observer protocol with v2 fixed categories:

- Completed comparison: agrees or disagrees with the existing destination.
- Unseen content not compared: unfinished profiles, insufficient supported
  examples, fitted views selecting different destinations, no positive match,
  or tied destinations.
- Excluded/unavailable observations: existing identities/descriptions, changed
  scope/representation, invalid inputs, missing queries, duplicate attempts,
  expiry or capacity. Invalidated batches are batches, not items.

Only compatible, valid, previously unseen observations enter the unseen-content
denominator. Invalid model structure must not be mislabeled as semantic ambiguity.
Every category remains bounded and commits only after current-source validation.
Keep the 32-item queue, eight-item batches, vector-component cap, expiry,
deduplication, cancellation and passive-observer authority boundary unchanged.

Publish only fixed counts, never example text, titles, IDs, vectors, arbitrary
model explanations or raw scores. The client validates the new version and keys;
mixed-version or malformed summaries are hidden. No data is automatically used as
a training label. All counters reset on service restart and can saturate, so they
are not unique lifetime-item counts or accuracy.

The follow-up [validation/recovery service](representative-validation-recovery-design.md)
adds fixed failure diagnoses at query receipt and decision binding, plus validation
of complete cached profile geometry before comparison. Corrupt profile caches are
withdrawn and rebuilt through the existing scheduler; logs contain repair guidance
instead of raw malformed payloads. This does not promote diagnostics into routing.

Use the existing Command Center section and pause boundary. Add only nonzero
reason counts inside its existing collapsed details, with plain-language labels.
Do not announce each numerical refresh or add another panel to the main view.

## Research, discovered and read on 2026-09-13

- [Google's classification metrics guidance](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)
  distinguishes correct classifications from predictions and explains why metrics
  depend on the task and denominator. Application: an AI/profile agreement is not
  correctness; report comparison coverage separately from placement accuracy.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  emphasizes provenance, cache invalidation, bounded inputs and output enforcement.
  Application: preserve source/model validation and emit only allowlisted counts;
  diagnostic evidence cannot acquire routing or tool authority.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  explains programmatic status identification and warns against excessive live
  announcements. Application: retain the existing quiet status region and pause
  control; use native disclosure for optional explanations.

These are engineering applications of the sources, not a claim of certified
security/accessibility or verified classification accuracy.

## Verification

Test every diagnostic cause, changed/known inputs, candidate-order and media
invariance, atomic commit, expiry, redaction, strict API projection and client
pause/failure behavior. Run backend/client coverage and real PostgreSQL integration.
Use local Compose with existing cached vectors and known-item negative controls;
do not manufacture novel identities from library items to claim accuracy. If no
natural unseen decisions arrive, report that limitation explicitly.
