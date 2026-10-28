# Client tooling PR 570 design

Date: 2026-10-28. Status: candidate researched and locally applied following the
batch's grill-me agreement. No release, PR merge or deployment is included.

## Selection and immutable candidate

The GitHub MCP open-PR query returned one candidate:
[PR #570](https://github.com/cloudbyday90/Classifarr/pull/570). Node's
`crypto.randomInt(1)` selected index zero from `[570]`. The ignored local receipt
records the draw. This is a new selection for this task; PR #569 was implemented
in the preceding batch and remains closed without merging.

Review pins the provider candidate to
[06001f5a0953e9cc30ba5c2ee8793dfab567b983](https://github.com/cloudbyday90/Classifarr/commit/06001f5a0953e9cc30ba5c2ee8793dfab567b983).
Its two changed files are `client/package.json` and `client/package-lock.json`:

- PostCSS `8.5.30` to `8.5.31`.
- Vite `8.3.4` to `8.3.5`.
- The reviewed lock also updates Rolldown/native bindings `1.2.13` to `1.2.15`
  and `@oxc-project/types` `0.153.0` to `0.155.0`.

Nineteen locked package records change. No package path is added or removed,
and no `hasInstallScript` flag changes. Published metadata declares no new
installation lifecycle hook for the selected packages. The pinned Node 24.22.1
satisfies Vite/Rolldown's `^20.19.0 || >=22.12.0` engine requirement.

## Official research and options

URLs were discovered through the connected search/GitHub MCP services on
2026-10-28. Exact version, engine, peer, dependency, script and integrity metadata
was separately retrieved from the official npm registry with pinned npm 12.2.1.

- The [Vite release index](https://github.com/vitejs/vite/releases) records
  8.3.5 fixes for production import maps and hashing, development origin/charset
  handling, CSS URL parsing and socket handling. Production build/browser
  behavior therefore needs actual validation, beyond manifest checks.
- The [PostCSS release index](https://github.com/postcss/postcss/releases) and
  [official changelog](https://github.com/postcss/postcss/blob/main/CHANGELOG.md)
  describe the 8.5.31 source-map correction for escaped style endings. The release
  index and registry already list 8.5.32; this exact-PR batch does not claim 8.5.31
  is the latest patch or establish a security-advisory remediation.

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Apply the immutable PR exactly | Reviewable provider change; clear before/after attribution | PostCSS remains one patch behind registry latest | Selected bounded batch |
| Refresh all available client packages | Broader version freshness | Unrelated changes obscure failures and expand review | Separate follow-up |
| Leave the PR untouched | No build-tool change | Retains the reviewed bundler/source-map bugs | Do not select |

Recommended stack: exact existing manifest pins, reviewed lock, strict existing
lifecycle policy, clean installation, full client coverage and actual production
policy-route browser checks. Preserve overrides and optional-platform decisions.
No new updater, generic singleton, package manager or global tool upgrade is needed.

## Safeguards and verification

Use main as requested. Review the provider diff before local application; install
with scripts disabled for initial review, then run `npm ci` using the existing
reviewed policy. Run `npm ls --all`, full-scope `npm audit --json`, client lint,
both type checks, configuration tests, full coverage, production build and
`test:browser:production-policy`. Run the root dependency-tooling tests and
coverage ratchet with current backend/frontend reports. Preserve failures and
audit scope; zero advisories do not establish security.

After verified local implementation is pushed, close the represented PR without
merging. Refresh the open-PR list and mechanically rebase any other stale bot
branches with explicit old-head leases; do not merge unrelated work. Update
Unreleased and the separate outcome with actual results. No version bump or tag.
