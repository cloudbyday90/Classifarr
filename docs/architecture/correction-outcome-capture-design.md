# Durable correction outcome capture

## Decision and scope

Capture bounded evaluation evidence automatically in the existing movie/TV correction workflows. A correction is an explicit destination choice, not proof that a subsequent external move succeeded. No acknowledgement, new dashboard, AI call, routing permission, or release is added.

The September 24, 2026 read-only installation check found 41 corrected/reclassified history rows, but zero correction events, feedback rows, eligible feedback labels, or feedback receipts. This does **not** establish how those events became absent. Code inspection separately establishes that history deletion cascades to correction events, retry cleanup deletes them, and the old evaluator depends on the current history destination. Status flags cannot safely reconstruct missing choices.

## Design

- Use one ESM correction writer across API, Discord, and reclassification. Insert the correction event and its minimal evaluation snapshot in one SQL statement. Existing transactional callers retain their transaction boundary.
- Snapshot typed TMDB identity, or a scoped source hash for a source-library history row with an exact, consistent inventory pointer. Missing or inconsistent identity remains unlabeled; never guess from titles or library names.
- Store only the correction ID, movie/TV type, identity key, destination ID, and observation time. Do not copy titles, descriptions, usernames, credentials, request bodies, or embeddings.
- Keep snapshots independent of history/event deletion. Deleting the destination library still removes its snapshots. Retry and ordinary history retention are not equivalent to deleting a library.
- Snapshot and legacy-correction evaluation reads only active, same-type destinations and observations from the last 30 days. Existing feedback-view retention/eligibility is unchanged. Bounded scheduled/startup queue maintenance physically expires old snapshots. Legacy exact events remain readable within that window, without duplicating captured events. Never reconstruct labels from a corrected status alone.
- Source-only keys are scoped membership identities, not global work IDs. A changed source identity must not silently inherit a label. Conflicting explicit destinations remain excluded by the evaluator.

## Alternatives and recommendation stack

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Keep joining mutable history | No schema change | Loses outcomes on retry/deletion and destination edits | Replace for new events |
| Retain all history forever | Easy retrospective queries | Excessive sensitive retention; still mutable | Reject |
| Database capture trigger | Covers every SQL writer automatically | Hidden behavior and source identity logic split across runtimes | Not selected |
| Shared ESM writer plus bounded snapshot | Explicit provenance, atomic event/capture, small storage surface | New schema; all correction entry points must use it | Implement |
| Train from current placement/status | Many apparent labels | Circular evidence and invented operator intent | Reject |

Recommended order: durable capture; transactional correction persistence; naturally accumulated held-out evaluation; only then consider evidence-backed ranking changes. Do not increase apparent confidence to compensate for missing labels.

Thirty-day retention is a deliberate privacy/coverage tradeoff: low-volume installations may have few labels. It matches the bounded intake diagnostic window, not a statistical sufficiency claim. Retention is fixed for this component; it does not change existing error-log retention settings.

Discord saves history, correction, snapshot, and outcome metadata in one transaction, with same-type/active-library checks and a locked duplicate-click guard. Reclassification moves remain external to the transaction: its history/event/snapshot writes now commit together, and a changed history destination or typed TMDB identity rejects the stale update. Removing its nonexistent `classification_history.updated_at` write restores the schema contract. External file/*arr side effects are **not** rolled back by PostgreSQL; the existing move rollback helper is only a logging stub and needs separate recovery work.

## Research basis

Reviewed official sources on September 24, 2026. These are engineering applications of the guidance, not claims of certification.

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/): retain the relationship between the explicit event and derived evaluation evidence; do not substitute a later mutable state for provenance.
- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html) and [BEGIN](https://www.postgresql.org/docs/18/sql-begin.html): event and snapshot must succeed together; multi-step workflow updates need transaction boundaries.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): minimize sensitive retained data and enforce expiry. Snapshot hashes remain private pseudonymous identifiers, not anonymized public data.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/): separate repeatable evaluation evidence from deployment decisions and document coverage limitations.

There is no UI change, so no new W3C/WCAG interaction pattern to validate. W3C provenance is the applicable guidance for this component.

## Verification contract

Test movie/TV and source-only capture, inconsistent pointers, missing identity, same-destination/non-actor exclusion, rollback, history retry/deletion survival, expiry, library deletion, and evaluator conflict handling using isolated PostgreSQL. Preserve the local installation and routing settings. Record actual test results separately in the outcome document.
