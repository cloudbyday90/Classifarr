# Per-library evidence coverage: implementation outcome

Status: Unreleased implementation, 2026-09-24. See the separate [design decision](library-evidence-coverage-design.md) for sources, alternatives, and tradeoffs.

## Delivered

- A versioned, administrator-only `GET /api/libraries/:id/evidence-coverage` contract with no-store and rate limiting. It returns only counts, bounded status identifiers, inventory revision, and observation time; no title, synopsis, vector, provider endpoint, or credential crosses the API.
- A short repeatable-read, read-only database snapshot that reconciles source rows with the existing movie/TV description corpus. It names type mismatch, missing TMDB identity, and unresolved source-conflict exclusions. More than 10,000 eligible rows produce `window_truncated` rather than a misleading partial ratio.
- A singleton, non-sensitive representation checkpoint written after the existing worker successfully inspects the local embedding model. Changed/stale configuration makes retrieval-cache coverage unknown until the worker re-verifies it; the read endpoint does not call the model or trigger backfill.
- A compact library-page card with manual refresh, accessible status text, and an expandable explanation of denominators and evidence gaps. It links source conflicts to Classifarr's existing media-ID review page. It explicitly says classification quality remains unmeasured.
- The matching migration and regenerated fresh-install schema snapshot. Existing routing, worker retry, classification decisions, and release/version remain unchanged.

## Verification

- Focused server unit and route tests passed (43 tests); focused PostgreSQL integration passed (4 coverage tests, including changed model, conflicting descriptions, and over-limit behavior; 11 tests across the coverage and existing refresh suites before the extra coverage cases).
- Full server unit suite passed: 1,407 suites and 41,217 tests. Full PostgreSQL integration suite passed: 150 suites and 1,722 tests (one suite/test skipped by the existing suite). Full client coverage suite passed: 378 files and 5,245 tests; the subsequent focused run covering the final parser/copy edits passed six tests. The coverage ratchet passed; server statement coverage 90.30%, client statement coverage 85.59%.
- Both typechecks, full code lint, client production build, migration naming/integrity check, schema snapshot freshness test, isolated-container snapshot parity check, and Markdown lint passed. Full code lint retained one unrelated pre-existing server-script warning, with no errors.
- The first full server coverage run encountered the newly added migration before its fresh-install schema snapshot was regenerated; only snapshot-freshness assertions failed. The snapshot was regenerated in an isolated container and the full server unit rerun passed. No persistent library data or routing settings were changed.

## Limits and next item

This is evidence availability, not accuracy, calibration, or proof that a placement was correct. A recent model inspection can become stale between worker cycles; the UI names it as a bounded recent check. Music/other media types and non-TMDB identities are unsupported rather than scored as empty. Very large libraries return an explicit truncated state instead of an estimate. There is no automatic rerouting or new media sync request.

GitHub's repository-scoped search returned zero open PRs, so none could be randomly selected or implemented locally. No PR was merged and no release was created.

The next high-value slice is a provider-independent content-identity/evidence adapter that can measure non-TMDB libraries without treating TMDB as the definition of media. Follow it with held-out operator-correction tests of actual placements before considering any confidence or automation change.
