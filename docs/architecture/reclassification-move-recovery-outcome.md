# Durable reclassification move recovery: outcome

Status: implemented locally, Unreleased, September 24, 2026. See the separate
[design, official research, options, and tradeoffs](reclassification-move-recovery-design.md).

## Delivered

Reclassification now uses small ESM modules for contracts, filesystem evidence,
the Radarr/Sonarr adapter, durable persistence, orchestration, and scheduling.
The old no-op rollback and superseded non-durable move helper were removed.
This replaces an ineffective recovery hook; it does not remove a working undo
capability. The legacy `rollbackInfo` response field is retained for compatibility,
with no executable rollback configuration or promise of physical compensation.

An explicit move records its intent before filesystem effects. Only its initiating
request can start the verified copy/delete operation. A recovery attempt reads
the same journal; it cannot perform another copy or delete. The content witness,
typed provider identity, old/new remote paths, source/destination activity/type,
current mappings, and classification revision must agree before completion.
Reservations also reject overlapping local paths across different remote IDs.

Successful remote readback precedes the transaction that updates history, writes
the correction and eligible evaluation snapshot, and marks the journal complete.
Duplicate completed requests do not generate another correction. Database or
remote outages retain the journal for bounded scheduled recovery, including after
a restart. The worker checks one due operation every five minutes, first running
two minutes after startup; repeated failures back off to at most one check/hour.

Ambiguous filesystem evidence stops automatic actions. Errors include a recovery
reference, history ID in the log, a stable reason code, and inspection guidance.
Identical reasons are not warned again on every retry. Partial copies are
preserved, and a lost owner or changed evidence prevents source deletion after
verification. Path translation supports fresh, strict reads for this workflow;
mapping failures cannot silently choose an untranslated path. Prefix matching
requires a path-segment boundary and supports Windows separators.

Movies require TMDB IDs; shows require metadata TVDB IDs. There is no TMDB-as-TVDB
fallback, title-based identity guessing, or music support. Missing remote items
no longer count as successful moves. Cross-instance transfers are rejected.
The Plex scan query now uses the actual `media_server` table. Scan failure is
reported separately and does not undo or duplicate a completed correction.

Completed journals expire after 30 days, at most 100 per tick. Unresolved journals
are operational reservations, not disposable logs; they survive history/library
cleanup and are capped at 1,000. Credentials and full metadata are never stored
in the journal. Its path plan is private operational data and can contain media
folder names. Normal configured log retention remains unchanged.

## Verification

- Full backend unit run: 1,416 suites / 41,542 tests passed. Final focused run
  after additional safety checks: 14 suites / 238 tests passed.
- Full isolated PostgreSQL integration run: 154 suites / 1,753 tests passed;
  one pre-existing suite/test skipped. Final focused recovery run: 13 tests passed.
- Real-schema tests cover atomic correction capture, duplicate requests, crash
  recovery, dependency outages/backoff, identity drift, history deletion, active
  resource/path reservations, advisory-lock contention, capacity, and retention.
- A real temporary-filesystem plus PostgreSQL test simulates a lost remote update
  response and completes recovery with exactly one file move and one remote PUT.
  Remote services are simulated; no live Radarr, Sonarr, Plex, or library media
  were mutated. Temporary synthetic files/databases are removed after tests.
- Server/client typechecks, server lint, unused-code/dependency checks, ESM import
  and mock-shape checks, and copyright checks passed. One existing filesystem-path
  lint warning in `captureOperatorCorrectionFrozenPolicy.mjs` remains unchanged.
- An isolated Docker image built successfully, reusing the unchanged client build.
  The migration and canonical PostgreSQL 18.6 schema are included; the isolated
  fresh-container schema comparison passed. Migration integrity, Markdown/RAG API
  documentation lint, and whitespace checks passed. Client unit tests were not
  rerun because no client code or endpoint request/response shape changed.

## Limits and next component

This is verified forward recovery, not automatic compensation. Partial copies,
changed media, mapping drift, deleted history, and third-party path changes are
preserved for inspection. Recovery never guesses which conflicting copy to keep.
Historical moves without a journal are not reconstructed from current placement.
The design documents cooperative verification limits and concurrent-writer risk.

The next component should be **recovery-aware batch/history status**: project the
existing journal into the existing item views so a recovered item does not remain
visually failed in a previously paused batch. Link the recovery reference to the
item, distinguish recovering / completed / needs inspection, and offer an
evidence-checked same-destination retry. Preserve batch pause/cancel intent and
never auto-execute unrelated batch items. Use compact accessible status updates,
not another dashboard or acknowledgement gate. This is a read/status follow-up;
the current worker already completes eligible moves without a user click.

Recommendation stack: this durable recovery foundation → reconcile existing batch
and history status → planned release/deployment rehearsal → collect genuine
correction evidence → rerun the paired 300-case library-agnostic evaluation.

## PR, release, and deployment boundary

Two repository-scoped GitHub MCP searches on September 24 returned zero open PRs.
No random open PR could be implemented; none was fabricated, closed, or merged.
No release, tag, version bump, running-container restart, production migration,
or live routing/settings change was performed. This work takes effect only after
the normal future deployment of code and migration together.
