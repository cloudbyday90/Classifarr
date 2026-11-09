# Client Undici PR 587 subset outcome

Date: November 9, 2026 Eastern. Baseline main 8879fcf7c. Scope agreed and locally
implemented; local and exact-code CI qualification pass. No release or deployment.
See the [design](client-undici-pr-587-design.md).

## Exact local subset

Uniform crypto selection chooses open PR 587 from [587,585] at
18:45:36.315 UTC, immutable head 625aaca6430b6fdeeb0d386acdd2bd77b402ef22.
Only its compatible Undici security subtree is adopted through an exact client
override scoped beneath JSDOM. JSDOM 30.1.3, Tailwind 4.3.3, vue-tsc/language-core
3.3.13, TypeScript 6.0.3 and application dependencies/transports are preserved.

Script-disabled lock generation changes exactly node_modules/undici from 8.12.2
to 8.12.4. There are no added/removed packages or lifecycle hooks; the registry
integrity matches. Its supported range remains inside JSDOM's ^8.12.1. Strict clean
installation succeeds with 296 packages; complete root/server/client trees pass.
Full development-inclusive audits report root/client zero and the same five
existing server low entries. No install, peer, TLS or scanner policy is relaxed.

## Actual transport and consumer controls

The shared six-mode server fixture gains only a validated optional local package
URL. It rejects non-file/query/hash targets, resolves the real node_modules/undici
entry and checks the package identity before importing it. Default server import
and output contracts remain intact. All six security cases fail against the
archived old client copy and pass against the patched JSDOM-owned copy.

Cases cover whitespace SRI, header forms/cross-origin stripping, cache hops,
credential aliases, foreign revalidation and cache-replay error containment, with
legitimate ordinary responses and bounded loopback-only resources. No direct-
library case is described as proof of an exploitable JSDOM/application path.

Real JSDOM controls pass under both Node-first and JSDOM-first initialization:
fromURL redirects/404, same-origin headers/cookies, redirected authorization/cookie
stripping, explicit mismatched-origin credential refusal, actual XHR abort,
window.close cancellation of an admitted subresource, and a usable later request.
The consumer controls pass on the old copy too; they establish compatibility.
The focused five-file run passes 78 controls, including retained exact negative
compiler diagnostics. Existing server defaults pass eleven controls. An initial
concurrent run's unrelated Discord child failure does not reproduce directly or
in the final unchanged eleven-case run; no timeout/assertion is changed.

## Existing JSDOM CORS fidelity gap

Before installing the patch, a credential-bearing XHR accepted a response with
wildcard Access-Control-Allow-Origin and Allow-Credentials true. The retained
JSDOM dispatcher explicitly accepts wildcard origin before checking credentials.
The old reproduction and source are preserved privately. This is a separate
consumer limitation, not one of the six Undici fixes.

The permanent compatibility refusal case uses an explicitly mismatched origin,
with the same error/status/body assertions; it does not claim wildcard rejection.
Existing browser-native security checks remain necessary. No application browser
transport changes, exploitability claim, DOM major migration or vendor patch is
introduced to hide that gap.

## Qualification and delivery

Fresh full client coverage passes 486 files / 7,557 tests: 87.93% statements,
82.17% branches, 87.72% functions and 89.60% lines. The production build, eight
production-asset browser cases and fourteen shared-form browser cases pass.
The broader startup-browser suite is not rerun; its five previously established
failures and two previously unreproduced initial failures remain explicit debt.

Lint/type checks, 107 dependency/tooling cases, complete package trees, full audits,
ownership, both Knip modes, policy/ESM/copyright gates and 93 affected workflow
controls pass. Root/client audits report zero entries; the same five server
low-severity entries remain. Fresh backend coverage passes 1,933 suites / 62,791
tests with one existing skip (89.28% statements/lines, 86.72% branches, 90.81%
functions); the current two-report ratchet passes. Exact-code [main CI](https://github.com/cloudbyday90/Classifarr/actions/runs/42689376043)
also passes its fresh coverage/ratchet/browser, database, ordinary installation,
native compression and full container recovery checks. All six other security/
quality workflows succeed; the OS outcome links their exact runs. No assertions,
timeouts, install decisions or scanner policies are weakened.

The independent [OS outcome](runtime-zlib-security-outcome.md) records the exact
source/image, successful native/PG17/PG18/curl/bcrypt controls, twelve installation
checks, eight routing phases and unchanged residual findings. Its local ordinary
mode is not represented as a repeated budgeted acceptance run.

Delivery recheck finds only open Dependabot PRs 587 and 585, both updated today
and mergeable. Dependabot refreshed PR 587's head to
1e96827673b4e51b1f8fc540f2c64f28ca6a9244; the selected original immutable head and
reviewed subset remain recorded above. An unstable check state is not a merge
conflict. No agent PR merge, closure or rebase is needed or performed.
Maintenance verifies protected services/worktrees and exact rehearsal cleanup;
no newly verified stale files/images qualify for removal. Recovery assets and
shared cache remain protected.

Recommendation remains this compatible one-package subset, followed by a genuinely
corrected published Node 24 artifact and separately scoped npm-bundle, JSDOM CORS/
browser-contract, DOM/native/compiler and category-neutral prompt work. No provider
write, live configuration change, release or deployment occurs.
