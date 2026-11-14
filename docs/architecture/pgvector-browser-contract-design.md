# Pgvector browser contract design

November 14, 2026 (America/New_York). Agreed scope at main
`3c88e3ad6e6fb460f4044e7e45b1a077b7da5e89`, with final shared understanding confirmed.

## Problem and evidence

The preceding development-browser sweep passed 100 cases and failed five in
`pgvector-startup.spec.js`. Its retained screenshots/accessibility snapshot show
the fixture mounted correctly, exposing a region named `pgvector` and five facts.
The tests instead require the older `pgvector startup compatibility` region,
compatibility label, report identifiers, timestamps and explanatory paragraphs.

Existing commit `e50019ffb` intentionally removed those details. The
[System Information design](system-information-simplification-design.md) requires
concise facts, one actionable CPU-mismatch warning and Unknown for stale evidence.
Restoring the old UI would reverse that accepted design. The component, presenter,
fixture and SystemView unit tests already express the current behavior.

Ordinary CI selects the shared-form browser spec and the separate production asset
suite, omitting this pgvector spec. Consequently, all seven workflows passed for
the baseline while these five cases failed in the broader local sweep. Refreshing
assertions alone would leave this automatic coverage gap.

## Bounded change

Change only the existing browser spec and its inclusion in the existing CI step,
plus documentation and Unreleased. Keep application code, fixture data, libraries,
providers, API/authentication, health calculations and service counts unchanged.
No new runtime module, helper framework, validator, package script or CI job is
needed. This is not the subsequent automatic-policy context/advisory refactor.

Select the exact accessible region `pgvector`. Within its single description list,
assert all five ordered term/definition pairs and their visibility. Keep expected
values independent of the production presenter:

| Mode | Version | Build | Selected optimization | AVX | AVX2 | Mismatch warning |
| --- | --- | --- | --- | --- | --- | --- |
| match | 0.8.1 | Multi-variant | AVX2 | Yes | Yes | absent |
| mismatch | 0.8.1 | Multi-variant | AVX2 | Yes | No | present |
| unknown | 0.8.1 | Multi-variant | AVX2 | Yes | Unknown | absent |
| stale | 0.8.1 | Unknown | Unknown | Unknown | Unknown | absent |
| generic | 0.8.1 | Multi-variant | Generic | Yes | Yes | absent |

Generic selection does not imply a generic-only build or missing CPU capabilities.
Unknown AVX2 support does not make every other current fact unknown. Stale report
facts are hidden, while the independently supplied extension version remains.

Require the existing short mismatch warning only for explicit mismatch. Preserve
zero API requests across methods and zero page errors. Assert that the panel has
no actions or Healthy/Unhealthy claims, and that the removed labels, report block,
UUID, timestamps and explanatory text remain absent. The real SystemView tests,
rather than this standalone fixture, continue to verify independent service health
and unchanged service counts.

Use one bounded viewport loop per existing case: retain 390/1280 and add 320 CSS
pixels. Verify facts, warning behavior and document overflow at each width; retain
mobile screenshot evidence. Keep existing deadlines, no sleeps, no skips and no
additional retries. If 320 reveals a runtime/layout defect, report it separately
rather than changing the UI under this test-only scope.

## Automatic CI coverage

Append `browser-tests/pgvector-startup.spec.js` to the existing shared-form browser
command and rename that step to describe both suites. Preserve the shared-form
selector, Chromium, one worker, zero retries, job/event gates, permissions,
credentials, dependencies and failure-report upload. No command is required from
an operator. The expected selected set is fourteen existing cases plus these five.

Existing runtime-installation and Docker-pull workflow mutation suites remain
applicable; source inspection finds no contract pinning this browser step's old
name or command. Do not create a parallel workflow validation framework.

## Independent review and official research

At the user's request, GPT-6 Astra independently inspected source/history and
recommended the bounded assertion refresh and existing-step CI inclusion. Its
follow-up supported the 320-pixel check and semantic term/definition locators.
It performed read-only review, not execution or product authorization.

Sources were discovered and opened through MCP on November 14:

- [Playwright best practices](https://playwright.dev/docs/best-practices) recommends
  testing visible behavior with retrying assertions and resilient explicit locators.
- [Playwright locators](https://playwright.dev/docs/locators) supports role-based
  discovery and scoped contracts. Use text assertions for term/definition values;
  do not assume their text is a usable accessible-name filter.
- [W3C landmark guidance](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
  explains the accessible name provided by the section's visible heading.
- [W3C Reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
  motivates the 320-CSS-pixel fixture check. This is not a full WCAG conformance
  assessment or a claim about every application page.
- [Playwright CI guidance](https://playwright.dev/docs/ci) supports bounded CI
  execution. The existing single-worker policy stays intact.
- [GitHub CI guidance](https://docs.github.com/en/actions/get-started/continuous-integration?apiVersion=2022-11-28)
  describes automatic workflow tests and reported results for changes.

## Verification and delivery

Run the five cases and the nineteen-case CI selection with the pinned toolchain,
then the full development-browser sweep and existing production-browser suite.
Run the existing SystemView/presenter checks and affected workflow mutation suites,
normal quality checks and full audits. Preserve assertions, scanner policy and
install decisions. Reuse existing backend/client coverage only after verifying
unchanged relevant source/test/dependency inputs and report hashes; regenerate if
that proof fails. Verify the coverage ratchet with current compatible reports.

Use the maintenance skill before substantial validation and at handoff. Preserve
all recovery assets, current evidence and resources without established ownership.
Record actual outcomes separately, update relevant follow-up links and Unreleased,
then commit/push all intended changes on main and inspect the exact commit's CI.
Recheck PRs at delivery. No release, deployment, live configuration write, provider
call, schema, UI, endpoint, job or operator CLI trigger is included.

## Options and final recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Restore the old UI | Old tests pass | Reverses the concise System Information decision |
| Refresh only the five assertions | Smallest local fix | Ordinary CI can omit future regressions again |
| Refresh and add the spec to the existing CI step | Correct contract and automatic coverage | Modest extra browser time and broader step ownership |
| Run every browser fixture in ordinary CI | Wider automatic coverage | Larger unrelated runtime and failure scope |

Recommend the third option: preserve product intent, independent expected facts,
semantic browser assertions, narrow/wide checks, bounded existing CI execution and
exact-source receipts. Intake found no open PR to select or stale Dependabot PR to
rebase. The next classification item remains automatic context/advisory ownership.
