# Client tooling PR 584 assessment design

Date: 2026-11-09 Eastern. Status: agreed November 9; implemented and locally verified; delivery receipts in the outcome.
No release, deployment or PR merge is proposed.

## Random selection and immutable subject

Four open PRs, 583 through 586, were mergeable at intake. Uniform selection using
node:crypto.randomInt at 2026-11-09T11:38:31.066Z chose
[PR 584](https://github.com/cloudbyday90/Classifarr/pull/584), head
1d01257e3bc4c8fc1a0e2214826351d5fa3e1b8b. Its exact MCP patch changes the client
manifest and lockfile, grouping nine package updates. Selection does not make
every grouped candidate applicable.

Recommend assessing this five-package subset, with exact pins:

| Package | Baseline | Candidate | Treatment |
| --- | --- | --- | --- |
| @playwright/test | 1.64.1 | 1.65.0 | Conditional adoption after real browser controls |
| @vitest/coverage-v8 | 5.0.5 | 5.1.0 | Keep exactly aligned with Vitest |
| vitest | 5.0.5 | 5.1.0 | Conditional adoption with current runner/config/coverage contracts |
| vite | 8.3.5 | 8.3.6 | Conditional adoption with real build/browser controls |
| globals | 17.13.0 | 17.14.0 | Conditional adoption with real lint diagnostics |

Retain the following independent graphs:

- vue-tsc 3.3.13 and TypeScript 6.0.3: candidate 3.3.14 has the identical published
  integrity as the previously reproduced failing compiler. Its five failures in
  twelve controls are prior executions, not a newly run assessment. Retain the
  [existing deferral](client-compiler-pr-581-outcome.md) and rerun retained controls.
- jsdom 30.1.3: candidate 31 changes CSS/selector/computed-style behavior, optional
  canvas backend and document parsing readiness. Assess that major independently.
- Tailwind core/PostCSS 4.3.3: selected 4.3.4 is followed by published 4.3.5 fixes,
  including a WASM-loading hang. Assess the coherent later native/WASM graph
  separately rather than adopt 4.3.4 or silently resolve a newer caret version.

## Official research and compatibility

Sources were discovered/read through MCP on November 9, 2026; exact registry
metadata, integrity, engines and peers were also retrieved. Pinned validation
toolchain remains Node 24.22.1/npm 12.2.1; do not use the older ambient binaries.

- [Vite 8.3.6](https://github.com/vitejs/vite/releases/tag/v8.3.6), November 5,
  fixes dynamic-import CSS dependencies with queries, overlapping plugin close
  calls and chunk hashing. It uses Rolldown ~1.2.16 and LightningCSS ^1.33.0.
- [Vitest 5.1.0](https://github.com/vitest-dev/vitest/releases/tag/v5.1.0),
  November 2, requires the exact matching coverage provider. Its supported Node
  ranges include pinned Node 24. The graph moves Istanbul coverage/report
  libraries from 1.x to 2.1.0: top-level nonmajor does not mean behavior-free.
- [Playwright 1.65.0](https://github.com/microsoft/playwright/releases/tag/v1.65.0),
  November 5, changes cookie matching, proxy credentials, inert actionability,
  accessible-name extraction and TypeScript class-field handling. Continue using
  Node, not its new Bun mode. Review actual browser effects rather than silently
  changing application syntax, auth policy or assertions to accept the tool.
- [globals 17.14.0](https://github.com/sindresorhus/globals/releases/tag/v17.14.0),
  November 1, refreshes environment names. Preserve lint severities and verify
  deliberate undefined-global sentinels remain errors.
- [jsdom 31](https://github.com/jsdom/jsdom/releases/tag/v31.0.0) documents the
  separate major migration; engine compatibility alone is not behavioral proof.
- [Tailwind 4.3.4](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.4)
  and [4.3.5](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.5)
  establish the deferred native/WASM assessment. Do not claim the older candidate
  contains the later fallback fixes.

The reviewed lock resolves Rolldown 1.2.18 and its matching platform bindings,
within Vite's declared range. Its [official release](https://github.com/rolldown/rolldown/releases/tag/v1.2.18),
discovered through the repository/release MCP API on November 9, includes module
error-stub escaping and sourcemap fixes. Validate the installed Windows binding;
this local batch does not prove every platform's native execution.

## Proposed install and verification boundary

Edit only assessed manifest pins and regenerate the client lock with scripts
disabled for first review. Preserve every override, unselected direct version,
compiler graph and strict script decision. Review all additions/removals and
transitive changes, engines, peers, platform bindings and registry integrity.
Then run a strict clean install, complete tree check and full audit including
development dependencies. Add no script approval or forced audit/peer workaround.

Preserve the existing optional native installer policy. Treat Rolldown/native
binding updates as part of reviewed graph compatibility. No application runtime
dependency or root/server npm manifest is in this tooling batch.

Use existing real-tool controls for Vitest project completeness, phase order,
isolation, workers, hooks, failure exits, filter failures and actual V8 coverage
of both covered and uncovered functions. The runner/provider must match exactly;
do not weaken those checks if 5.1.0 changes their behavior.

Add a bounded real Vite regression for query-bearing dynamic imports and their
CSS dependencies, with ordinary static/lazy import controls. Exercise real ESLint
global-name behavior. Use real Chromium controls for the assessed Playwright
cookie/path and inert behavior, then the fresh production-browser suite against
a newly built application. Preserve test scopes, security assertions and timeouts.
Do not infer current application failure from upstream release notes alone.

Install candidate Chromium into an owned task/tool directory and preserve older
toolchains/browsers. Keep Playwright browser garbage collection disabled for that
isolated install. The agent handles downloads and artifact maintenance; no operator
CLI procedure or Docker/service restart is introduced.

Run fresh client coverage, lint, both typecheck scopes, build, retained compiler
controls and production-browser checks. Run dependency/tooling policy checks and
complete root/server/client audits. The independent runtime batch changes server
source too, so collect fresh full backend coverage and qualify the ratchet using
both current reports. Do not reuse stale client coverage after installing tools.

If a candidate fails a normative or normal gate, preserve its failing evidence
and restore/retain the compatible baseline rather than relax policy. Document
which assessed subset is actually adopted. This is partial PR assessment, not
claiming all nine proposed updates were accepted.

## Alternatives and recommendation stack

| Option | Advantage | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Adopt all nine together | One grouped update | Mixes known compiler failures, DOM major migration and superseded Tailwind candidate | Reject |
| Adopt nothing | No tooling drift | Misses independently assessable build/test fixes | Baseline fallback |
| Assess five exact pins | Useful bounded build/test updates with full controls | Transitive majors and browser semantics still require real verification | First batch |
| Adopt newer Tailwind or jsdom simultaneously | More updates | Independent native/WASM/DOM migration | Separate assessment |

Recommend the conditional five-package subset and explicit deferrals. Then assess
the coherent Tailwind 4.3.5 native/WASM graph, a later fixed compiler, and jsdom 31
separately. Keep existing advisory/scan policy unchanged and make no all-security-
findings-resolved claim.

Record observed outcomes separately, update Unreleased, maintain scoped artifacts,
commit/push on main, and inspect exact-source CI/security receipts. Leave PRs
unmerged and rebase only genuinely stale applicable branches; a failing check or
advancing main alone is not a branch conflict. No release or deployment.
