# Evaluation activity and comparison coverage

Date: 2026-10-09. Scope: read-only Command Center reporting; no release.

## Problem and decision

A completed deterministic replay can evaluate 300 cases while the narrower
comparison history reports zero completed pairs. Identical automatic decisions
are excluded from that candidate pool; manual/verification paths can be selected
but unsupported. Calling every candidate "eligible" obscures this distinction.
AI-response capture also has an independent opt-in budget that may be disabled.

Keep three separate concepts: the latest saved deterministic pass, retained
comparison coverage for one revision, and capture configuration checked now.
Do not add their counts or imply their snapshots describe the same revision.
Surface selected-but-unsupported cases before opening the detailed disclosure.
Explain that inferred library-purpose rules are excluded by the independent test,
without asserting that this is the cause of every unsupported case.

## Read contract and safety

Extend the existing protected GET with `evaluation_history_summary.v4.activity`.
Use one repeatable-read, read-only transaction with the existing five-second
statement limit, two singleton SELECTs and a database timestamp. No schema change,
provider calls, vector reads, cleanup, budget resets or worker execution.
Allowlist counts/statuses/timestamps only; never return reports, identifiers,
prompts, provider configuration or exception messages. Keep admin authorization,
rate limiting, no-store and nonpersistent SWR. Older API versions remain readable
but must say activity is unavailable, not that capture is disabled.

A policy snapshot older than 15 minutes or dated in the future is stale, with no
fresh counts. Failed, missing, malformed, legacy and incomplete reports stay
distinct from a completed pass. Budget configuration is not a promise of worker
readiness: reservations are labeled with their UTC day, and a saved outcome is
not a live worker heartbeat. A failed refresh clears the entire displayed snapshot
even while paused. Resume displays the latest authorized snapshot.

No mutation is repeated by this work. Restart reads durable state; cancellation,
ownership fencing, resource admission and inference quotas are unchanged.
No new work is necessary on a fresh/disabled installation. Completion means the
operator can distinguish work done from unsupported or disabled work, not that
every comparison has become possible.

## Research and tradeoffs

Official sources discovered with web search and opened on 2026-10-09:

- [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  supports retaining a presentation pause that does not stop background work.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports programmatic, non-focus-stealing loading/error/pause feedback. Avoid
  making the entire changing results panel a repetitive live announcement.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports per-endpoint access control, generic errors and no-store for sensitive
  responses. These are applications of guidance, not a compliance certification.

| Choice | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Rename the old counter only | Minimal change | Still hides completed work and disabled capture | Insufficient |
| Automatically enable AI capture | Could fill supported cache misses | Unapproved inference; cannot fix unsupported paths | Reject |
| Separate bounded activity and historical coverage | Explains the observed installation without changing decisions | More snapshot semantics to label/test | Recommend |
| Remove inferred-source exclusions | More apparently testable cases | Risks evaluating against training-derived purpose | Reject |

Recommended stack: existing PostgreSQL snapshots → small ESM projection → existing
admin GET → strict client normalization → focused Vue activity component plus
historical disclosure. Test stale/failed/empty/malformed states, every capture
state, privacy, pause/access loss, keyboard use and narrow screens.

Next: design independent evaluation support for inferred-only policies. Any
AI-capture budget remains a separate administrator decision.

## Ownership review

Reviewed the complete history repository and its new activity reader. The reader
adds only fixed SELECTs inside the existing read-only transaction; no protected
inventory relation is read or written. History append/prune paths are unchanged.
Refresh only this repository's reviewed source digest; retain its unresolved
`analysis_debt` classification and analysis digest. This does not approve unrelated
dynamic SQL or establish production writer ownership.
