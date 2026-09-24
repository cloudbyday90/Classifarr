# Movie and TV content admission: outcome

Status: Unreleased, 2026-09-24. The [design](movie-tv-content-admission-design.md) records scope, root cause, research, and tradeoffs.

## Delivered

Removed the unreleased music discovery feature and its table migration, endpoint, interface, and recommendations. Existing source-evidence improvements for movie and TV libraries remain.

Provider item adapters no longer reinterpret unsupported types as movies. Library synchronization admits only movie/TV inventory; item synchronization excludes unsupported content before capture, identity recovery, analysis, and persistence while preserving pagination. Unsupported authenticated webhooks receive a successful ignored response before payload logging or queuing. Previously queued unsupported classification tasks finish as skipped without classification or retries. Direct classification requires an explicit supported type.

Movies and series with music-related names, titles, or genres remain supported. This adds no configuration, new table, external request, or music-learning pipeline. No live media was deleted, and the local container was not restarted. Removed source files and the unused migration remain recoverable in Git history.

## Verification

Regression tests exercise audio unexpectedly returned in movie/TV queries, metadata stripping, movie/TV preservation, an entirely ignored page followed by a valid page, unsupported library synchronization, explicit type aliases and conflicts, authenticated webhook skips, queued-item completion, and direct-classification rejection before side effects.

- Full backend unit suite: 1,409 suites and 41,278 tests passed. The first run exposed one queue success fixture missing its declared type; the fixture was corrected and the full suite rerun successfully.
- Full PostgreSQL integration suite: 150 suites and 1,722 tests passed, with one existing skipped suite/test.
- Focused client regression: three suites and 20 tests passed. The client production build passed after removal of the music interface.
- Both typechecks, backend code/test lint, ESM import/mock checks, migration/schema integrity checks, and Markdown lint passed. Backend lint retains one existing unrelated warning in `captureOperatorCorrectionFrozenPolicy.mjs` and no errors.

## Next item

Make existing movie/TV descriptions usable by retrieval and learned profiles when a TMDB ID is absent. Reuse the recovery orchestrator for resumable backfill and compare candidate recall, incorrect placements, and manual-review burden on held-out movie/TV items. Source metadata that falsely declares an audio item to be a movie remains a distinct diagnosis problem.
