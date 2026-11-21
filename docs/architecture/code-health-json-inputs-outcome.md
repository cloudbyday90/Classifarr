# Stable code-health JSON inputs outcome

November 21, 2026 Eastern. Implementation of the
[approved design](code-health-json-inputs-design.md).

The code-health test now uses a small JSON discovery helper. It prunes
`client/test-results` and `client/playwright-report` before walking them and
sorts the remaining file paths. A directory with the same basename elsewhere
continues to contribute authored cases. The original depth and package
lockfile boundaries, parser assertions and web manifest checks still apply.

The baseline listed two generated `.last-run.json` cases. After the fix,
3,475 focused cases matched by name and outcome before and after real
Playwright runs. Both generated cases dropped out of JSON validation. The
39 authored JSON case names matched the original baseline. The
temporary fixture included malformed generated JSON, malformed authored JSON
and authored directories with matching basenames. It preserved the exact
authored inventory and verified that its malformed input still fails parsing.

The production client build and all 29 Chromium checks passed. They include
existing keyboard, focus, status and form behavior checks. The W3C web manifest
working draft informed the distinction between authored application metadata
and test output. [Manifest working draft](https://www.w3.org/TR/appmanifest/)

Fresh client coverage passed 7,592 tests across 489 files.
