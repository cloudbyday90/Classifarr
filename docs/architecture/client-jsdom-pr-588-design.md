# JSDOM major assessment from PR 588

Research: November 9, 2026 Eastern. Baseline main ff7859e3f. Status: agreed;
the operator confirmed the conditional assessment before implementation.
Local assessment only; no PR merge, release or deployment.

## Selection and existing decisions

The current MCP inventory contains only open Dependabot PR 588, so uniform random
selection from `[588]` chooses that PR. Its immutable head is
04c1658cb6964b73f2fbc8fa8f00ab0429f7a74e, updated November 9 at 22:44:36 UTC.
The [proposal](https://github.com/cloudbyday90/Classifarr/pull/588) updates JSDOM
30.1.3 to 31.0.0 and vue-tsc 3.3.13 to 3.3.14 in the client manifest/lock.
At intake it is fresh and mergeable with unstable checks, not a merge conflict.
Recheck at delivery; rebase only genuinely stale applicable branches.

The compiler candidate is the identical published artifact already shown to fail
the approved differential controls. Retain exact vue-tsc/language-core 3.3.13,
TypeScript 6.0.3 and application syntax. Do not repeatedly adopt or mix compiler
versions to conceal those results. This proposed batch assesses only JSDOM.

## Genuine major migration

Official sources retrieved through MCP:

- [JSDOM 31.0.0 release](https://github.com/jsdom/jsdom/releases/tag/v31.0.0).
- [Tagged README](https://github.com/jsdom/jsdom/blob/v31.0.0/README.md).

The release replaces CSS/selector internals, changes parser readiness around
blocking resources and switches the optional canvas backend to `@napi-rs/canvas`.
Its Node engines fit the pinned 24.22.1 runtime. Its Undici range accepts the
existing jsdom-scoped exact 8.12.4 override; preserve that tested security boundary.

Construction/fromURL/fromFile can return a partial document when blocking scripts
pause parsing. There is no new proprietary ready() API. Tests requiring a parsed
tree must inspect `document.readyState`, then await standard DOMContentLoaded;
load-delaying resources require the window load event. A document load listener
is not a substitute for a window completion listener. Keep inert fragment tests
synchronous when they do not require asynchronous parsing.

The full PR lock changes eleven records, adds eleven and removes thirteen,
including the deferred compiler graph. Do not apply it wholesale. The JSDOM-only
graph is expected to introduce language-matching/parser-stream packages, update
parse5/its entities and whatwg-url, and remove the old CSS/selector family.
Review the regenerated exact graph, peers, engines, optional dependencies and
lifecycle metadata before installation. No added/changed proposed record declares
a lifecycle installer or OS/CPU restriction. Keep the optional native canvas
package absent; do not add native packages or relax strict script admission.

## Reviewed coupled resolution

The regenerated local lock selects parse5 and parse5-parser-stream 8.1.1 within
the approved JSDOM ranges. The [official parser release](https://github.com/inikulin/parse5/releases/tag/v8.1.1)
describes security-related parser/serializer fixes without a published advisory.
Review the published package diffs, exact metadata and actual consumers rather
than treating a clean advisory scan as proof that these issues do not exist.
The stream package raises its core-parser floor; both remain script-free ESM
packages with no new platform/native dependency. No exploitability claim follows.

Qualify the coupled parser with bounded child-process controls for malformed
Unicode, formatting-list work with exact output, deep serialization and template
EOF output. Compare exact 8.1.0 with 8.1.1, preserve ordinary positive cases and
fixed input/heap/output/deadline limits. This tests selected invariants, not every
upstream fix or a general complexity/security guarantee.

## Proposed complete independent batch

Conditionally adopt exact JSDOM 31.0.0 in the client manifest and generate its lock
with scripts disabled for review. Retain every other explicit dependency,
override, installer decision, peer policy and application transport. Update only
the assessed JSDOM version expectation in `clientUndiciPatch.test.js` if adopted;
retain its six real Undici controls and node-first/jsdom-first transport checks.

Add bounded real-library controls for parser readiness/event order, DOM and form
behavior, selector and CSS results, and actual loopback redirects/credentials,
abort/close and import ordering. Freeze old behavior before changing the installed
tree. Distinguish deliberate new standards behavior from defects; do not invent
a vulnerability or require every old/new positive control to differ.

A bounded owned test-fixture readiness helper is permissible only where complete
parsing is required, using the supported events above. Preserve expected DOM,
event, CSS and transport results and existing deadlines. Do not loosen assertions,
make application syntax changes, add global compatibility shims or silently
disable tests to obtain a pass. If compatibility requires a broader migration,
retain 30.1.3 and record the failing evidence for a separate design.

Run reviewed strict clean install, complete package-tree checks and full
development-inclusive audits. Run real tooling/configuration controls, client
lint/typecheck, fresh full coverage, production build and production/form browser
checks. Coordinate fresh backend coverage and normal quality gates with the
independent prompt batch, with current reports for the coverage ratchet. Keep
existing scanner findings and policies visible and reuse evidence only after
unchanged source/tree/report hashes are verified.

Document the observed outcome separately and update Unreleased. Perform scoped
artifact maintenance, commit/push agreed changes on main and inspect the exact
code commit's CI. Leave PRs unmerged; no branch, release or deployment.

## Pros, cons and final recommendation stack

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Conditional JSDOM-only 31.0.0 assessment | Evaluates the remaining applicable PR change with real consumers | CSS and parsing changes can affect the test environment | First independent batch |
| Apply both PR updates | Smaller manifest edit | Reintroduces the already-demonstrated compiler regression | Reject |
| Retain JSDOM 30.1.3 on incompatibility | Preserves qualified tests and current application graph | Defers the major migration | Required fallback |
| Globally shim or weaken DOM assertions | Can hide migration failures | Invalidates the evidence supplied by tests | Reject |

First assess the supported JSDOM major against actual consumers. Adopt only after
the stated gates pass; otherwise retain the compatible version and its controls.
Keep the compiler deferral, optional canvas migration and published Node/npm
security updates as separately scoped decisions. This tooling change does not
add application routing, learning or provider authority.
