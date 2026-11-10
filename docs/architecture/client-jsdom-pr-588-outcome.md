# JSDOM PR 588 assessment outcome

November 9, 2026 Eastern. Baseline main ff7859e3f. The complete conditional
[design](client-jsdom-pr-588-design.md) was confirmed before assessment.
Local qualification passes; adopt the JSDOM-only subset. Exact-source CI is
pending push.
No PR merge, release or deployment.

## Selected subset and exact graph

PR 588 was the sole open candidate at intake. Its immutable reviewed head is
04c1658cb6964b73f2fbc8fa8f00ab0429f7a74e. Adopt only exact JSDOM 31.0.0; preserve
vue-tsc/language-core 3.3.13, TypeScript 6.0.3, Vue and all runtime dependencies,
overrides, installer decisions and peer policy. The identical compiler candidate
remains deferred; existing real Vue and exact compiler controls pass (19 tests).

The regenerated local lock changes five records including the root, adds six and
removes thirteen. Its coupled parser/stream resolve to 8.1.1, with Entities 9 and
whatwg-url 17.3.0. The scoped Undici 8.12.4 remains. The reviewed graph has no new
install hook or platform/native package; optional native canvas remains absent.
Upstream development prepare scripts are not registry installation hooks.

Strict clean install and complete package-tree checks pass. Development-inclusive
audits report zero root/client findings and the same five low server findings;
existing scanner policies and server-local triage/expiry remain unchanged.

## Actual library and consumer controls

- The same six JSDOM controls fail on 30.1.3 and pass on 31.0.0: cascade layers,
  inherited custom-property substitution, retained live computed declarations,
  focus state/fixup, blocking-script parse suspension with standard readiness,
  and descendant-XHR cancellation through window.stop followed by a usable request.
  All five existing DOM/environment controls pass on both libraries.
- The first focus fixture used a zero-delay timer before the rendering update.
  Correct it to a bounded animation-frame wait with the same expected focus and
  deadline; rerun the corrected controls on exact 30.1.3 and 31.0.0. This is a
  fixture-timing correction, not evidence of a candidate defect or relaxed result.
- Keep readiness waits inside owned asynchronous fixtures. Check readyState,
  then DOMContentLoaded or window load as required; inert documents remain
  synchronous. The readiness and load-event counts are explicit.
- All six existing real Undici security controls and both initialization-order
  loopback transport probes pass. Preserve redirects, credentials, explicit
  mismatch-origin refusal, XHR abort, window.close cancellation and later requests.
  Credentialed wildcard-CORS fidelity remains unassessed; these tests do not
  establish browser equivalence or WCAG conformance.
- The coupled parser's published 8.1.0 and 8.1.1 are tested through identical
  bounded child probes. The old copy fails malformed-surrogate, formatting-work,
  deep-serialization and template-output controls; the new copy passes all four
  with exact semantic output and small-depth positives. Inputs stay bounded,
  child heap is 128 MiB, output 32 KiB and execution ten seconds. An adapter-call
  bound measures one fixture's work; it is not a universal complexity guarantee.

The [official parser release](https://github.com/inikulin/parse5/releases/tag/v8.1.1)
describes security-related fixes without a published CVE/GHSA. A clean advisory
scan would miss that distinction. The complete published-package diffs were
reviewed; public parser/stream/adapter entry points remain compatible with the
actual JSDOM bridge. These controls do not demonstrate an exploitable Classifarr
path, cover every upstream issue or remediate every parser/transport.

## Qualification and delivery

Client lint, typecheck and configuration controls pass. Root dependency tooling
passes 117 controls with its existing Windows WASI skip; the unchanged Tailwind
graph retains its separately qualified Linux evidence. Fresh full client
coverage passes 488 files and 7,569 tests: statements 87.93%, branches 82.17%,
functions 87.71% and lines 89.61%. The production build, eight production browser
checks and fourteen form browser checks pass with unchanged assertions/deadlines.
The independent prompt batch's fresh backend coverage also passes: 1,938 suites,
62,964 tests and one existing skip. All 7,423 frozen code inputs and both current
coverage reports qualify the successful coverage ratchet. Exact-source CI is
pending push; interrupted reports are not substituted for these results.

The first full coverage attempt caught the repository's closing-wrapper rule in
the new parser test file. Correct the new wrapper without changing assertions,
stop both preliminary coverage runs and restart from a fresh code-input freeze.
Existing code-health assertions remain and pass with the new parser controls.
Do not use interrupted reports as delivery evidence.

The first browser launch used the default cache, where Chromium was absent;
all eight checks refused to launch before testing the application. Reuse the
preserved private Playwright 1.65.0 toolchain and rerun successfully. The original
production build already passed; do not describe that cache refusal as an
application regression or conceal it by loosening browser checks.

No application syntax, expected diagnostic, existing timeout, global DOM shim or
scanner exception changes. Keep the production application independent of this
test-environment major. Document final source/report hashes and maintenance
receipts at delivery; rebase only genuinely stale applicable PRs and merge none.

## Recommendation stack

The [design](client-jsdom-pr-588-design.md#pros-cons-and-final-recommendation-stack)
records the alternatives and tradeoffs. Local gates support adopting the
JSDOM-only subset with the reviewed parser resolution. Keep compiler updates, native canvas,
broader browser fidelity and published Node/npm security updates separate.
