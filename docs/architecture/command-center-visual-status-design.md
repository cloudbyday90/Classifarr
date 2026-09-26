# Command Center: visual status and matching drill-down

Date: 2026-09-26. Status: implementation design; no release or deployment.

## Problem and previous-commit review

The previous commit (`f4ee3f16`) added protocol-bound offline quality review.
It did not measure live placement accuracy or repair the Command Center.
Keep that evaluation work: freshness must not be relabeled as AI accuracy.

The existing metadata count reads `media_source_observations` from recent,
complete full captures. Its link opens a different population: inventory rows
awaiting TMDb review. A matching count and destination are a prerequisite for a
useful chart. Existing repair previews are bounded/rotating and cannot serve as
the complete drill-down for this aggregate.

## Recommendation stack and tradeoffs

1. Share the source-issue SQL population between the aggregate and its new
   read-only paginated detail endpoint. Benefit: consistent membership, including
   all active libraries and issue categories. Cost: an aggregate read on opening
   details; pages are live snapshots, not an immutable historical export.
2. Use Vue components with native SVG/CSS, visible counts and accessible controls.
   Benefit: no chart dependency for one ring and a segmented bar. Cost: custom
   presentation tests; a plotting library can be reconsidered for real timelines.
3. Reuse the existing Vue SWR composable with `persist: false` for item details.
   Benefit: bounded retry and request coalescing without persistent private titles.
   Cost: unavailable data is withheld on errors rather than showing stale actions.
4. Show one next step and disclose technical details on demand. Benefit: fewer
   competing instructions. Cost: diagnostics require an extra click.

Final choice: the visual-overview design, backed by existing services and evidence.
Do not add another queue, AI call, chart framework, or approval workflow.

## Data and safety contract

- Ring: current library summaries / all assessed libraries; zero libraries has
  no percentage. Label this freshness, never understanding or correctness.
- Metadata count: exactly the same active, complete, full, unomitted capture
  scope and generation as upgrade readiness, within 30 days. No hidden preview
  cap. Page output is limited to 50 rows; offsets are strictly validated.
- Counts and each detail page use one SQL statement. Separate requests can
  legitimately differ after sync; show the fresh total and explain changes.
- Retry timestamps prove a claimed attempt and an eligibility boundary, not a
  running worker, scheduled execution time, or successful recovery. Distinguish
  waiting, eligible, source review, and no recorded recovery. Unknown is not zero.
- Invalid IDs/type get source-review guidance. Conflicts without a retry record
  do not automatically become human-required work. Never choose a provider ID.
- Pending decisions use the same returned list as Needs Attention, not metadata
  issues. Failed/unavailable reads must not become zero pending decisions.
- Authenticated, rate-limited, no-store GET only. Return allowlisted fields and
  opaque item keys, not raw source keys, provider payloads, URLs or credentials.
- Render titles as escaped Vue text. No raw HTML or source-supplied links.
- No changes to routing, matching, retention, retries, budgets or live data.

## Official research

Sources discovered with web search and GitHub MCP on September 26, 2026:

- [W3C image guidance](https://www.w3.org/WAI/tutorials/images/): charts need
  equivalent text. The ring has a percentage and numerator/denominator; the
  recovery bar has a textual count for every category.
- [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color):
  color is supplementary, never the sole state indicator.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  concise loading/results notices are programmatically exposed without moving
  focus on polling. Explicit navigation can move focus to the destination.
- [Vue security](https://vuejs.org/guide/best-practices/security): rely on escaped
  text and trusted templates, never render source metadata with `v-html`.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/15/transaction-iso.html):
  a statement reads a consistent snapshot. Keep page totals and rows together.
- [SWR error handling](https://swr.vercel.app/docs/error-handling): bounded
  retry/backoff informs reuse of the local Vue composable, not installation of
  the React hook package.

## Next component

Extend the existing source-recovery mechanism, not a parallel queue. Successful
repairs already persist `source_identity_recovery` receipts through
`mediaSyncIdentityRecoveryPersistence.mjs`; unsuccessful paths in
`mediaSyncIdentityRecovery.mjs` return `null`, including caught provider failures.
Add bounded, structured attempt/reason outcomes for those paths and relate them
to the existing success receipts before drawing recovery trends. Then the
overview can prioritize verified human-action cases and distinguish provider
downtime from unsupported evidence. Do not infer outcomes from a timer.
