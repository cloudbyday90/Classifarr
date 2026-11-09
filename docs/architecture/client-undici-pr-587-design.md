# Client Undici PR 587 subset design

Research: November 9, 2026 Eastern. Baseline main 8879fcf7c. Status: agreed and
implemented; see the separate [qualification outcome](client-undici-pr-587-outcome.md).
No PR merge, release or deployment.

## Random selection and bounded subset

Uniform Node crypto.randomInt selection from current open PRs 587/585 at
2026-11-09T18:45:36.315Z selects [PR 587](https://github.com/cloudbyday90/Classifarr/pull/587),
immutable head 625aaca6430b6fdeeb0d386acdd2bd77b402ef22 against 44cf88e51.
The broad client-tooling PR includes JSDOM 31, Tailwind 4.3.4 and the previously
demonstrated incompatible vue-tsc 3.3.14 artifact. Selection does not make every
grouped change suitable for this batch.

Its lock contains one independently applicable patch: client Undici 8.12.2 to
exact **8.12.4**. Current JSDOM 30.1.3 consumes the single installed client copy
through ^8.12.1, so the patch is inside its supported range. Recommend a client
override scoped to jsdom -> undici 8.12.4, rather than an unbounded lock refresh
or a DOM major migration. Keep every other override and installer decision.

Retain JSDOM 30.1.3, Tailwind core/PostCSS 4.3.3, vue-tsc/language-core 3.3.13,
TypeScript 6.0.3 and all application runtime dependencies. Keep the existing
compiler deferral; assess the later Tailwind 4.3.5 native/WASM fixes and JSDOM's
major graph separately. No root/server dependency version change is proposed.

## Actual security and consumer boundary

All six official November 5 Undici advisories include 8.12.2 and identify 8.12.4
as patched. The [release](https://github.com/nodejs/undici/releases/tag/v8.12.4),
[whitespace-SRI advisory](https://github.com/nodejs/undici/security/advisories/GHSA-r4pc-4jcp-7pqc)
and [cache-hop advisory](https://github.com/nodejs/undici/security/advisories/GHSA-mqg3-3v4r-cm32)
were retrieved through MCP. The exact registry SRI matches the immutable PR lock.
The patch has no package dependencies/install hooks and retains Node >=22.19.0.

JSDOM uses this transport for fromURL, enabled subresources and XHR. Its public
resources object accepts a dispatcher/interceptors; the installed version has no
exported ResourceLoader class. Its ordinary fetchCollected API does not forward
an integrity option, and default resources do not compose the implicated cache/
redirect interceptors. Do not describe a direct-library SRI/cache reproduction as
a demonstrated JSDOM or Classifarr exploit. This updates development/test transport,
not browser Axios, server fetch, Discord transports or Node's embedded Undici.

Node fetch and npm dispatchers remain distinct implementations even where they
share dispatcher symbols. Preserve real import-order compatibility checks;
matching symbol names or version strings are insufficient.

## Verification and implementation

1. Freeze bounded old-client failures and positive controls through the actual
   JSDOM-resolved Undici copy. Reuse the existing six-mode server fixture with a
   narrowly validated optional file URL; preserve its default server import and
   output contract. Avoid a second copy of the security-control implementation.
2. Verify wrong/valid SHA256/384/512 with ASCII whitespace, redirect/header forms,
   cache hops/credentials/revalidation and replay-error survival. Use only
   synthetic loopback servers, bounded stores/children and owned cleanup.
3. Preserve real JSDOM.fromURL redirect/404 controls after Node fetch initializes,
   plus the opposite import order. Test real same-origin XHR headers/cookies,
   cross-origin credential refusal/stripping, XHR abort and window.close cancelling
   an active subresource. Close all windows, sockets and owned dispatchers.
4. Generate/review the client lock with scripts disabled. Admit only the exact
   override and resulting compatible Undici entry, with no new hooks, packages or
   unrelated resolutions. Verify exactly one actual client copy and its consumer.
5. Strict clean install, complete tree and all-workspace development-inclusive
   audits; preserve TLS, peer, script and scanner policy. A clean registry audit
   does not supersede newer maintainer advisories or unknown application reachability.
6. Run fresh client coverage, retained compiler/runner/config controls, lint/type,
   build and production/shared-form browser gates. Preserve assertions, timeouts,
   application syntax and the five known startup-browser contract failures as
   explicit baseline debt. The shared fixture change requires fresh backend
   verification/coverage; run normal ownership/ESM/policy/copyright/Markdown gates
   and the ratchet only with current reports.

Integrate tests into existing automated test paths; introduce no operator CLI
trigger, page, endpoint, setting or job. The independent OS batch owns its image
checks. Apply scoped artifact maintenance, update Unreleased and the separate
outcome, then commit/push on main. Keep PRs unmerged; rebase only genuinely stale
applicable branches rather than treat an unstable check state as a merge conflict.

## Alternatives and recommendation stack

| Option | Benefits | Costs/limits | Recommendation |
| --- | --- | --- | --- |
| Scoped Undici 8.12.4 under retained JSDOM | Repairs actual dev-copy boundary with a compatible one-package patch | Needs real dispatcher/JSDOM and full client verification | First subset |
| Whole PR including JSDOM 31 | Broader DOM/selector/parser improvements | Major graph changes and known compiler/native-WASM decisions | Separate assessment |
| Floating lock refresh | May find the patch | Can move unrelated caret dependencies and later versions | Reject for this batch |
| Override every Undici copy to 8.x | Superficial version uniformity | Crosses SDK/dispatcher major contracts and does not patch built-in Node fetch | Reject |

Assess this patch and the published OS repair separately; then qualify an actual
corrected Node 24 artifact when available. Preserve the queued npm residual,
startup-browser and category-neutral prompt work. No publication acceptance follows
from these dependency checks.

The [JSDOM 31 release](https://github.com/jsdom/jsdom/releases/tag/v31.0.0)
documents the deferred DOM migration. [OWASP dependency guidance](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html)
supports checking the actual transitive usage and functional compatibility rather
than treating a version bump or clean scanner result as complete proof.
[W3C writing guidance](https://www.w3.org/WAI/tips/writing/)
supports precise scope/outcome language; retained real-browser form checks protect
existing semantics without creating a new UI or claiming full WCAG conformance.
