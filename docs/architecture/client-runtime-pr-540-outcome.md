# Client runtime PR 540: design and outcome

Date: 2026-09-22. No release or application version change.

## Selection and implementation

GitHub MCP listed five open PRs: #539, #540, #541, #542 and #544. A uniform random
array-index draw selected [PR #540](https://github.com/cloudbyday90/Classifarr/pull/540).
Its changes were inspected and implemented in the local client manifest and lock
file, without merging the PR: Vue 3.5.42 → 3.5.43 and VueUse 14.4.0 → 15.0.0.
Matching Vue and VueUse subpackages were updated; unrelated dependency PRs were
not applied. Installation disabled lifecycle scripts.

The [official Vue changelog](https://github.com/vuejs/core/blob/main/CHANGELOG.md)
documents compiler, reactivity, runtime and Suspense fixes in 3.5.43. The
[official VueUse 15 release](https://github.com/vueuse/vueuse/releases/tag/v15.0.0)
documents breaking removals of Node 20, templateRef and deprecated timer options,
along with changed event-source, IndexedDB and throttle behavior. These sources
were fetched through GitHub MCP before implementation.

## Compatibility decision

Production VueUse imports are limited to `useOnline` in `useSWR.js` and the
sidebar. None of the listed changed APIs is used. The repository requires Node
24, not the dropped Node 20. Therefore no application API rewrite is required.

Existing SWR unit tests mock VueUse. Add a separate test with the actual installed
`useOnline`: offline suppresses refresh, reconnect triggers one refresh, and
unmount stops further work. Keep the existing coalescing, private/no-store and
bounded-retry behavior; a browser network signal is not proof of server or AI
provider health.

| Choice | Benefit | Cost / recommendation |
| --- | --- | --- |
| Apply both updates with full regressions | Maintains supported runtime and takes upstream fixes | VueUse is a major update; selected after API audit |
| Update Vue only | Smaller dependency change | Leaves the requested PR incomplete; not selected |
| Rewrite SWR using a new client library | Broader caching APIs | Unrelated behavior risk; retain existing Vue composable |

## Verification

- Full client suite passed: 370 files / 5,171 tests.
- The subsequently added real-VueUse test and existing SWR suite passed together:
  two files / 38 tests (one new test beyond the full-run count).
- Client typecheck, ESLint and production build passed.
- All 25 development-browser regressions and all seven production route-asset
  browser checks passed, including keyboard recovery, mobile layouts and SWR.
- Production dependency audit reported zero known vulnerabilities. This is an
  audit snapshot, not a guarantee that dependencies have no vulnerabilities.

Use the built-in Playwright wrapper directly for flags, for example
`node scripts/run-playwright.mjs test --workers=2`; npm 12 rejected the same flag
when passed through the attempted npm script invocation. No package workaround
or npm configuration change was needed.

Final recommendation: retain the updated Vue/VueUse versions, named client API
functions and existing SWR composable; keep the real online-event contract test
alongside mocked fast tests. Keep backend dependency recovery independent from
browser connectivity. No new UI control or acknowledgement was introduced.
