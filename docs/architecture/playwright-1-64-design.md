# Playwright 1.64 tooling design

Research date: 2026-10-11. Scope: browser-test tooling only, on main. No release,
runtime upgrade, provider mutation or identity approval.

## Evidence and decision

The preceding commit `f7224a2a7cd12ed92f03283925c736f21c7f74d9` passed
[CI](https://github.com/cloudbyday90/Classifarr/actions/runs/38178360755), OSV,
Trivy, CodeQL, Gitleaks, copyright and resource-capacity workflows. This is
baseline evidence, not validation of this update.

Fresh client `npm outdated` reports Playwright 1.63.0 installed and 1.64.0 wanted
and latest. Adopt exact `@playwright/test` 1.64.0 with its exact `playwright` and
`playwright-core` dependencies, subject to the checks below. Registry metadata
requires Node >=20 and declares no new install scripts or peers. Retain Node
24.21.0, npm 12.2.0, Vue 3.5.43, Vite 8.3.4 and client TypeScript 6.0.3.

Official sources discovered and retrieved through MCP:

- [Release notes](https://playwright.dev/docs/release-notes): 1.64 introduces
  optional shuffle and locator APIs; these do not require application changes.
  Relevant compatibility changes include emulated device screen dimensions,
  hidden-iframe visibility, JSX compilation and missing-snapshot modes. Our
  Desktop Chrome profiles warrant real desktop/mobile tests. Do not opt out of
  new screen behavior or regenerate snapshots simply to make failures disappear.
  Chromium is 156.0.8078.4; Firefox and WebKit are not this project's configured
  browser matrix. Do not enable experimental WebMCP or add an agent service.
- [Browser installation](https://playwright.dev/docs/browsers): package versions
  require matching browser binaries. Install Chromium using the project's local
  CLI, with `--no-remove` to preserve other projects' browser installations.
  Existing CI already installs Chromium after the locked client install.
- [Testing guidance](https://playwright.dev/docs/best-practices?trk=article-ssr-frontend-pulse_little-text-block):
  preserve test isolation, user-facing locators and web-first assertions. Exercise
  existing synthetic fixtures rather than production accounts or external media.

## Tradeoffs and recommendation stack

| Choice | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Exact Playwright 1.64 and matched Chromium | Current browser coverage and reproducible dependency set | New browser and visibility behavior require full browser validation | Adopt if checks pass |
| Keep 1.63 | No immediate test-tool regression exposure | Defers current-browser coverage | Fallback for a demonstrated regression |
| Combine router, compiler and Node majors | Fewer install cycles | Obscures failures and may misrepresent deployed APIs | Defer |
| Relax tests, isolation or memory guards | Superficial green result | Hides regressions | Reject |

1. Keep the deployed runtime and its declarations aligned.
2. Pin the three-package Playwright chain and add a regression contract against
   manifest/lock version drift; retain strict npm lifecycle policy.
3. Install matching Chromium, run all configured browser scenarios without retries,
   then production-build browser checks and full client validation.
4. Assess Vue Router 5.4 in a separate tooling batch. The subsequently reported
   description-refresh timeout makes safe failure attribution the next runtime
   priority; see the [incident outcome](description-refresh-timeout-2026-10-11-outcome.md).
   Keep identity verification independent of this tooling update.

## Random open PR

Fresh enumeration found #556 and #557; PowerShell `Get-Random` selected
[#557](https://github.com/cloudbyday90/Classifarr/pull/557), immutable head
`83d8f8ad94b3025fd00655a6a23e746375af0114`. Its two-file diff updates Playwright
1.63.0 to 1.64.0 together with client Node declarations 24.19.2 to 26.6.4 and
undici-types 7.24.6 to 8.9.0. Apply the exact proposal locally and test installation,
typechecking and runtime/declaration policy. If rejected, restore the Node type
changes while retaining a separately tested, exactly pinned Playwright update.
Do not merge, close or edit the remote PR, or upgrade Node to accommodate it.

## Verification and deployment boundaries

Review the initial lock diff with scripts disabled, then perform normal strict
`npm ci`, full dependency-tree and all-dependency audit checks. Run tooling-policy
tests, client lint and both typecheck scopes, full client coverage, the complete
configured Chromium suite, and the production-policy asset suite. Run heavy
suites serially on this shared host. Record failures before changing anything;
keep assertions, timeouts, retries and safeguards intact. Do not claim a current
combined coverage ratchet without a fresh full backend report.

Commit the implementation cleanly before the requested no-cache local image build.
Preserve a verified local database backup and rollback image; check exact image
identity before local-only replacement. Dump schema from that image in a fresh,
isolated database, verify cleanup, then inspect local health and aggregate data
read-only. Unraid, Plex and shared Ollama remain unchanged. Record observed
outcomes separately; no version bump, release, image publication or identity consent.

## Browser failures found during validation

The first complete 1.64 run passed 72/75 cases. Repeat the three failures with
unchanged tests on the former 1.63 package/browser before editing tests. That
baseline passed auth expiry but reproduced two stale browser expectations:
recovery history's label changed, and evaluation diagnostics now start collapsed.
Update only the exact current label and explicitly open the diagnostics disclosure
with the keyboard, asserting its closed/open states. Keep all original recovery,
polling, no-write, mobile-layout and timing assertions. Do not change the runtime
UI to satisfy old tests. Rerun the complete suite on 1.64; the first-load auth
timeout remains a recorded transient unless reproduced with further evidence.
