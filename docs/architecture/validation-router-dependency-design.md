# Validation and navigation dependency design

Research date: 2026-10-12. Scope: the recommended Zod patch and a separate,
randomly selected open PR; not a release or production deployment.

## Evidence and recommendation

The server imports Zod in seven contracts: AI response parsing, candidate
adjudication, migration diagnostics, constraint admission, initial intent,
policy intent requests and web-search providers. Keep these modular contracts;
do not introduce a new validation service or change their authorization boundaries.

[Zod 4.6.6](https://github.com/colinhacks/zod/releases/tag/v4.6.6)
adds early upper-size rejection for arrays, maps and sets and corrects record
type declarations. Its release history also includes the upstream
[cleanup of bad commits](https://github.com/colinhacks/zod/pull/6620).
Those removed commits contained a download-and-execute loader. A release's
commit list is not the same as its final published contents: review both the
net source diff and exact npm artifact before executing the candidate.

The scripts-disabled npm package diff from 4.6.5 to 4.6.6 contains size gates,
record declarations, upstream tests and version changes, with no new package
files. The full candidate manifest has no install hooks or top-level preinstall
entry. This is bounded inspection, not a claim that every dependency is safe or
that the removed upstream versions were published or installed here.

Use exact `zod: 4.6.6` and its integrity-locked artifact. Preserve strict objects,
input/body limits, structured errors and existing coercion/default semantics.
Oversized collections may now return one size issue instead of per-item issues;
valid requests and normal invalid-field paths must remain compatible. This is
not a fix for refresh-cycle memory retention, and memory safeguards stay unchanged.

The fresh open-PR inventory contained only
[PR #559](https://github.com/cloudbyday90/Classifarr/pull/559).
A cryptographic random draw over `[559]` selected index 0. Review and apply its
immutable head `3045aaf124525e1db6611d64950740bc8177c693` locally, without merging:
Vue Router 5.3.1 to 5.4.0 and its lockfile changes.

[Vue Router 5.4.0 release notes](https://github.com/vuejs/router/releases/tag/v5.4.0)
include experimental query normalization, scrolling/history changes and build
plugin fixes. Classifarr uses ordinary `createRouter` with manual routes, not
the experimental resolver or generated-route plugin. Retain that API. Test
scalar/repeated/bare queries, encoded paths, setup/restore/authentication guards
and legacy redirects. Server authorization remains authoritative.

The PR updates ast-walker-scope to 0.10.0 (including nested Babel 8/ast-kit 3),
nostics to 1.3.0 and unplugin to 3.4.0, plus nested confbox/magic-string entries.
Its Node requirements include 24.11+; the pinned Node 24.21.0 satisfies them.
Existing Vue 3.5.43, Vite 8.3.4 and Pinia 4.0.3 satisfy Router's peers. Review
these transitives and run the full client build/test path; do not relax peers or
lifecycle-script policy.

## Alternatives and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Retain Zod 4.6.5 | No validation behavior change | Misses early size rejection; baseline only |
| Pin reviewed Zod 4.6.6 | Reproducible patch with bounded oversized-input handling | Future updates require explicit review; recommended |
| Broad dependency refresh / new compiler API | More upstream features | Unrelated behavior and supply-chain surface; deferred |
| Apply Router PR with existing API | Maintains navigation contracts while refreshing supported package | Additional build transitives need verification; recommended |
| Adopt experimental router | New query/scroll APIs | Application migration not justified by this patch; deferred |

Final stack: existing Node 24/npm 12, Express and modular ESM contracts; exact
Zod 4.6.6; existing Vue 3/Vite/Pinia with Router 5.4.0; reviewed lockfiles and
strict install policy; contract, coverage, browser and isolated image checks.

## Verification and rollout

First demonstrate oversized-input regression tests on 4.6.5, then pass them on
4.6.6. Run all backend unit coverage and affected HTTP route contracts, frontend
coverage, lint/types/knip, dependency trees, full-scope audits, registry signature
checks and existing browser/tooling checks. Signature/provenance verification
does not prove the absence of malicious code.

Commit the tested implementation on main, back up local test data, perform a
no-cache provenance-aware Compose build, and verify that exact image. Dump the
schema using the existing disposable, network-isolated fixture; compare it with
the tracked snapshot. Recreate only local Classifarr and use read-only aggregate
checks. Leave Unraid, shared Plex/Ollama and unresolved identity approvals alone.
Record observed results separately in the outcome document before final push.

## Official references

- [Zod parsing contracts](https://zod.dev/basics)
- [Zod error formatting](https://zod.dev/error-formatting)
- [Router navigation guards](https://router.vuejs.org/guide/advanced/navigation-guards.html)
- [Router redirects and aliases](https://router.vuejs.org/guide/essentials/redirect-and-alias)
- [npm registry signature verification](https://docs.npmjs.com/verifying-registry-signatures/)
- [npm provenance limitations](https://docs.npmjs.com/generating-provenance-statements/)

URLs were discovered/retrieved through GitHub and web MCP services, with exact
artifact metadata independently read from the official npm registry.

## Validation-driven source-read correction

The unchanged CSRF source contract timed out both alongside other checks and in
a serial full-suite rerun. The serial diagnostic measured 7,013.8 ms in 584
synchronous reads, 9.8 ms in rule matching, and only 141 ms total CPU. This
localizes the delay to file I/O; it does not identify the OS/antivirus cause or
implicate Router. Serial scheduling alone did not remove the failure.

[Node's filesystem documentation](https://nodejs.org/download/release/v26.5.1/docs/api/fs.html)
distinguishes blocking synchronous APIs from promise APIs using the thread pool;
both APIs also exist in this project's Node 24 runtime. Keep source discovery,
allowlist, matching rules, assertions and five-second deadline unchanged. Read
in batches of at most 16 files through a small ESM test helper. Preserve input
order, retain only a batch of source text, await all admitted reads and fail on
any read error before advancing. Do not preload the entire source tree or tune
the global thread pool. Read diagnostics now measure batch waits, not single
files, so their phase sums do not double-count overlapping reads.

Tradeoff: bounded concurrent I/O and a small helper/test surface replace repeated
blocking waits. Test batch limits, laziness, complete ordering, real UTF-8 reads
and failure propagation; run the actual source contract and complete client
coverage again. This changes test execution only, not CSRF protection or runtime
application behavior.
