# Feedback cohort and CI repair design

Follow-up validation also identified machine-dependent deadlines in two existing
100-million-operation stress fixtures. Their numeric rejection and no-cache
assertions remain intact; explicit 30-second test deadlines replace the global
10-second default for those two cases only. No production work limit changed.

Date: 2026-09-13

## Findings and scope

The earlier [CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/34754893502)
failed on two unused ESM exports, before unit tests. The later
[copyright run](https://github.com/cloudbyday90/Classifarr/actions/runs/34758792153)
reported five missing headers. The corresponding
[latest CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/34758792168)
also failed two feedback-eligibility integration assertions. Release acceptance
correctly remained blocked by the failed prerequisites; it is not a separate
release publishing defect.

The feedback capture reads PostgreSQL `NOW()` into a JavaScript `Date`, serializes
it, and uses that value as the SQL upper bound. PostgreSQL keeps microseconds;
JavaScript truncates them. Feedback written earlier within the same millisecond
can consequently disappear from the captured cohort. This affects real learning
evidence, not only tests. Slowing tests or inserting arbitrary delays would conceal
the defect.

## Selected design

- Preserve the database transaction timestamp as UTC ISO text with six fractional
  digits before it crosses the database driver. Keep the existing parameterized
  query, repeatable-read snapshot, read-only capture and maximum cohort size.
- Test feedback before, exactly at and after the cutoff within one millisecond
  using real PostgreSQL and a fixed capture clock. Also test a non-UTC session.
- Remove the unused alias export and unused version constant. Keep the canonical
  artifact version and the actual consensus result version unchanged.
- Add the five missing repository headers. The SQL migration change is a comment
  only; no DDL or migration replay is needed.
- Add a local CI preflight command reusing the existing workspace runner. Include
  copyright and both development/production dependency checks in `test:ci`, so
  local behavioral tests cannot be mistaken for completion of those CI checks.

## Options and tradeoffs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Preserve the exact UTC capture boundary | Includes eligible recent feedback without widening the window | Six fractional digits instead of three in new manifests | Recommended |
| Round upward or add a timing allowance | Avoids some exclusions | Admits evidence after the declared boundary | Reject |
| Delay fixtures or retry CI | May make a run pass | Leaves the production boundary defect | Reject |
| Suppress unused exports or copyright findings | Small configuration change | Hides genuine maintenance defects | Reject |
| Reuse existing checks in local preflight | Earlier, repeatable feedback | Adds dependency-analysis time | Recommended |

## Security and user experience

No new HTTP endpoint, permission, metadata export, provider call, routing action,
automatic policy change, acknowledgement, dependency or persistent UI state is
introduced. Existing cohort fingerprints and current-evidence validation remain
in place. Existing manifests are not rewritten. No database-wide timestamp parser
is changed. No lint, release or evidence guard is weakened.

There is no UI behavior change: the existing SWR refresh, pause control, native
disclosure and status announcements remain intact. W3C guidance does not require
an additional settings page for this backend correction.

## Official research checked on 2026-09-13

- [node-postgres data types](https://node-postgres.com/features/types) explicitly
  documents microsecond truncation when PostgreSQL timestamps become JavaScript
  dates. This directly supports the diagnosed boundary failure.
- [PostgreSQL formatting functions](https://www.postgresql.org/docs/18/functions-formatting.html)
  document `US` precision and UTC ISO formatting with `to_char`.
- [Knip issue handling](https://knip.dev/guides/handling-issues) recommends resolving
  the module-graph finding before reaching for ignore rules. Repository search
  confirms both exports have no consumers.
- [GitHub workflow troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)
  supports inspecting the failed step and logs rather than treating all blocked
  downstream jobs as independent failures.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  informs the existing automatic-refresh pause control; this repair retains it
  without adding UI work or claiming a new accessibility audit.

## Final recommendation stack

1. Exact database timestamp boundary and deterministic PostgreSQL regression.
2. Remove unused exports and restore missing headers without changing contracts.
3. Local CI preflight, targeted regressions, full affected suites and new-run checks.
4. Resume the library-balanced movie/TV retrieval benchmark after CI repair.

The benchmark must distinguish placement agreement from verified correctness;
existing library contents are not automatically ground truth. Do not expand
routing authority merely because retrieval coverage improves.
