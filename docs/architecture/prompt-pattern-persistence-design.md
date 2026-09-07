# Prompt pattern persistence: design

## Problem and scope

The metadata-vote follow-up found that the legacy prompt response endpoint writes
a nonexistent `discovered_patterns.source` column, omits required `library_name`,
swallows failures and reports the number of attempted actions as created. Its
classification queries also reference removed columns. This makes feedback an
unreliable input for later analysis even before classifier accuracy is measured.

## Decision

Use a small ESM pattern writer shared with reviewed suggestion application. The
prompt response service owns one transaction containing pattern upserts, feedback,
learning statistics and classification completion. Pass its database client through
the existing feedback facade; never open a second connection inside that operation.
Return HTTP success only after commit. Preserve the historical `patternsCreated`
field as the count of distinct persisted pattern identities, including updates to
existing patterns. It is not a count of new database rows. Store those same distinct
actions in feedback provenance. Any invalid action rejects the whole request.

Validate bounded actions and positive destination IDs before writes. Resolve names
from current, active, media-compatible libraries. Lock policies in ID order before
libraries and classifications; validate policy/library ownership and use the existing
native-intent legacy-write guard for explicit pattern tuning. Lock and accept only
`pending` classifications, matching this endpoint's listing contract. A repeated or
concurrent response returns `409 PROMPT_NOT_PENDING`, preventing duplicate feedback.
No automatic retry is introduced.

Read current `metadata.classification_details.ranked_candidates` and `scores`, with
the row's confidence and method, instead of adding obsolete columns to the schema.
Keep stored media metadata intact. Other awaiting-decision workflows remain outside
this legacy endpoint's scope. Pattern actions remain explicit user choices; this
change adds no semantic counter-evidence or automatic routing behavior.

## Official sources and August 2026 baseline

Sources were discovered through web tools and read on 2026-09-06/07. These are
published specifications and PostgreSQL 18 guidance available by August 2026,
not an assertion that the live documentation is an archived August snapshot.

| Source | Application |
| --- | --- |
| [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html) | One commit makes the related writes atomic and hides partial state. |
| [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html) | Use parameterized upserts and `RETURNING id` to count rows actually persisted. |
| [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | A successful POST response describes the completed action's result. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) | Preserve the origin and changes behind machine-readable feedback; do not record attempts as outcomes. |

Applying W3C provenance guidance to this private JSON API is an engineering choice,
not a claim of formal W3C conformance. No UI is changed, so no new accessibility
interaction is introduced.

## Alternatives and recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Fix only the insert columns | Smallest patch | Still allows partial responses, false counts and duplicate feedback. |
| Per-action savepoints and partial success | Retains some work after failure | Requires detailed partial-result UI and operator recovery. |
| One transaction with bounded validation (selected) | Truthful outcomes, safe failure, no recovery checklist | An invalid action rejects the response; locks briefly serialize affected work. |
| Replace the deprecated pattern table now | Could remove legacy storage | Broad migration of readers and writers obscures this concrete bug fix. |

Recommended stack: bounded input → current destination/policy validation → pending
row lock → shared parameterized upsert → transaction-bound feedback/statistics →
commit → truthful response. Existing frozen evidence and readiness gates remain in
place. Real PostgreSQL tests must cover insert/update, duplicates, schema reads,
rollback at each write stage, invalid destinations, native authority and replay.

Implementation results and remaining work belong in the separate
[outcome document](prompt-pattern-persistence-outcome.md).
