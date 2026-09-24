# Provider-neutral source evidence: implementation outcome

Status: Unreleased implementation, 2026-09-24. The separate [design decision](provider-neutral-source-evidence-design.md) records official sources, alternatives, and the recommendation stack.

## Delivered

- Added a small ESM adapter for a library- and server-scoped source-item anchor. It counts valid anchors and description presence after excluding media-type mismatches and unresolved source identity conflicts. Valid IMDb/TVDB IDs are counted as observations only; items are never merged by these fields, title, or TMDB.
- Extended the existing administrator-only, no-store evidence endpoint to a `library.evidence_coverage.v2` count-only response. A single read-only repeatable-read transaction supplies both source-level and narrower TMDB-based description/retrieval diagnostics. At most 10,000 source rows are projected. Larger libraries explicitly return `window_truncated` even if a TMDB-only subset is smaller.
- Updated the library page to show source descriptions, including source items with no TMDB ID. It states that these are **not yet** in the description-vector corpus. The strict client parser checks count reconciliation and strips unrecognized fields.
- No schema migration, new background job, metadata-provider request, cross-library identity resolution, training input, classification score, or routing change was added. The production `libraries` check constraint and synchronizers still admit only movie/TV; the adapter's other-type behavior is a forward-compatible synthetic test, not a deployable claim of non-movie/TV support.

## Verification and limitations

Focused unit, route, client, and PostgreSQL integration tests cover namespace separation, duplicate anchors, malformed alternate IDs, missing-TMDB descriptions, source conflicts, unsupported media types, privacy, and the 10,000-row boundary. The full server unit suite passed (1,408 suites; 41,236 tests); the full PostgreSQL integration suite passed (150 suites; 1,722 tests, with one existing skip); the full client coverage suite passed (378 files; 5,247 tests). The client production build and both typechecks passed. Code and Markdown lint passed; full code lint retained one unrelated pre-existing server-script warning with no errors. The final Unicode-anchor and accessibility-copy edits passed focused tests and lint after the broad runs.

A source anchor is current membership provenance, not a permanent work identifier; a media-server rebuild may change it. Description presence is neither semantic retrieval nor placement accuracy. The response exposes no raw item metadata. Unresolved source conflicts remain blocked. No live library data or local running container was modified. The repository-scoped GitHub MCP search returned zero open PRs, so none could be randomly selected or implemented locally; no closed PR was substituted or merged. No release was created.

## Follow-up status

Implemented in the subsequent [source-description learning increment](source-description-learning-design.md):
the UI no longer says all descriptions without TMDB IDs are outside the corpus.
Its cache/retry counters remain explicitly TMDB-scoped.

The source-only backfill/retrieval connection is now implemented using existing
recovery orchestration. The remaining follow-up is a paired evaluation of
candidate recall, incorrect placements, and manual-review burden on held-out
movie and TV items, excluding duplicate copies and unresolved source identities.

## Scope correction, 2026-09-24

The preceding recommendation incorrectly interpreted content agnosticism as adding media formats. The user clarified that music is outside Classifarr's scope. Library/content agnosticism means discovering the character of movie and TV libraries from their contents, without requiring predefined categories or manual purpose declarations.

The unreleased music-discovery commit `9609dd0a` was reversed, including its adapters, service, endpoint, UI, migration, schema additions, tests, and music-specific design/outcome documents. The provider-neutral movie/TV evidence work remains. The database schema was restored to `d7f4651e`, and explicit [movie/TV admission checks](movie-tv-content-admission-design.md) now protect ingestion and classification. No live database was changed and no release or container restart was performed. The removed work remains recoverable in Git history.

The [admission outcome](movie-tv-content-admission-outcome.md) records verification of the correction and the replacement safeguards.
