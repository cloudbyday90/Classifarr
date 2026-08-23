# Production Policy-Route Asset Smoke

Status: implemented in source. This check neither creates a tag nor publishes
a GitHub release, package, container, or artifact to an external service.

## Outcome

Classifarr now has an opt-in production browser check:

```text
npm --prefix client run test:browser:production-policy
          |
          +--> vite build
          +--> vite preview at 127.0.0.1:4174 (strict port)
          +--> one isolated Chromium context per policy route
          +--> verify local JavaScript assets and budget
```

The runner is ESM and builds before it starts Playwright. Its dedicated config
refuses to reuse any server already listening on the preview port, so it cannot
silently test the Vite development server or a stale `dist/` directory.

The initial verified run covers seven cold navigations:

| Workflow | Routes |
| --- | --- |
| Authoring | `/policies`, `/presets` |
| Maintenance | `/policies/native-intent-reconciliation`, `/policies/historic-route-safety-refresh` |
| Insights | `/tuning-suggestions`, `/evidence`, `/policy-stats` |

Each navigation must render its visible heading, complete every local script
asset with HTTP 200, load its expected route-page chunk, avoid every other
route-page chunk, remain free of unhandled page errors, and stay at or below a
512 KiB (524,288-byte) uncompressed JavaScript budget. All seven current
scenarios passed this check. The protected `Build and Test` CI job now installs
only Playwright Chromium with its Linux dependencies and runs the same named
command. On failure it retains the synthetic Playwright report for 14 days;
successful runs do not upload it.

The budget counts response-body bytes for local `.js` files under `/assets/`.
It intentionally does not use elapsed-time thresholds, compression heuristics,
or remote-network metrics, which makes the result repeatable across local and
hosted runners. The test records only route metadata, asset file names, HTTP
statuses, and byte counts in its Playwright attachment; it never stores asset
content, credentials, browser storage, API bodies, or operator data.

Some small shared implementation chunks can have a policy-group prefix because
the entry module imports shared helpers. The assertion therefore rejects other
**route-page** chunks, rather than incorrectly treating every prefixed shared
chunk as an unrelated page load. This preserves the meaningful delivery
contract without constraining safe common-code extraction.

## Security Boundary

The smoke server binds only to `127.0.0.1` and `--strictPort` prevents a port
fallback. Each browser test intercepts every `/api/` request before navigation:

- setup and current-user reads receive fixed synthetic responses needed for
  route admission;
- unknown reads receive a synthetic `503` response; and
- non-read requests receive synthetic `405` responses and fail the test.

This prevents accidental use of a developer's local backend, provider, media
server, queue, credentials, session, or installation data. The test does not
click mutation controls and has no deployment or release authority.

## Research Basis — August 2026

- Vite documents [`vite build`](https://vite.dev/guide/build) as the command
  that produces the production bundle. Its
  [`vite preview` documentation](https://vite.dev/guide/cli) describes preview
  as the local way to serve that built output and explicitly says it is not a
  production server.
- Playwright documents
  [`webServer`](https://playwright.dev/docs/test-webserver) and `baseURL` as
  the supported configuration for starting and targeting a local application
  during tests. The separate configuration uses both rather than starting an
  unmanaged background process.
- Playwright's [Request API](https://playwright.dev/docs/api/class-request)
  specifies that `requestfinished` fires only after a response body has been
  downloaded and identifies `script` as a resource type. That makes it a
  suitable source for the bounded local asset measurement.
- Playwright's [best practices](https://playwright.dev/docs/best-practices)
  recommend isolated tests and web-first assertions. Each scenario receives a
  fresh browser context and verifies a user-visible heading with
  `toBeVisible()`.
- Playwright's [CI guidance](https://playwright.dev/docs/ci) recommends a
  single worker for reproducibility and its
  [browser guidance](https://playwright.dev/docs/browsers) supports installing
  only Chromium with required Linux dependencies. The protected workflow uses
  that narrow command rather than caching browser binaries or installing
  browsers the suite does not use.

## Options Considered

### Build-size warning only

Pros:

- No browser-test maintenance.
- Fast and already available from Vite.

Cons:

- Cannot prove a browser can resolve and execute a lazy route.
- Reports individual generated assets, not a route's cold script set.
- Does not distinguish the intended page chunk from another page's chunk.

Decision: rejected.

### Existing development-server browser tests

Pros:

- Uses the established Playwright setup.
- Fast feedback while developing components.

Cons:

- Exercises source transforms and the Vite dev server, not immutable
  production assets.
- Cannot expose a failed production dynamic import, stale output, or emitted
  chunk-budget regression.

Decision: rejected for this delivery contract.

### Selected: loopback production preview plus route-page budget

Pros:

- Exercises the generated production files in Chromium.
- Verifies the exact lazy page chunk for every policy workflow.
- Uses deterministic byte limits rather than flaky timing thresholds.
- Fails closed on failed scripts, other route-page chunks, unhandled errors,
  or blocked mutation attempts.
- Cannot contact the application's API or external services.

Cons:

- Adds a Chromium dependency and about eight seconds to the opt-in local run.
- The 512 KiB ceiling needs deliberate adjustment if a justified feature
  changes a route's delivery cost.
- It is a delivery smoke, not a full API or policy-decision integration test.

Decision: selected.

## Final Recommendation Stack

1. Run `test:browser:production-policy` whenever client route splitting or a
   policy page changes.
2. Keep the preview server loopback-only, strict-port, and non-reusable so the
   suite always tests a fresh production build.
3. Keep API interception fail-closed and retain no application response data in
   reports or artifacts.
4. Treat the 512 KiB uncompressed script total as a regression budget; change
   it only with a measured, documented rationale.
5. Retain ordinary development-browser and unit tests for behavior; this smoke
   complements rather than replaces them.

## Next Recommended Item

Extend the same production-preview smoke methodology to the high-transfer
Settings route, whose generated JavaScript is now the largest client route
asset. Establish its own documented budget before the later `v0.48.2-beta`
release-readiness work.
