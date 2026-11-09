# Client Undici PR 587 subset outcome

Date: November 9, 2026 Eastern. Baseline main 8879fcf7c. Scope agreed and locally
implemented; final coverage/image/CI receipts are in progress.
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

## Qualification and delivery pending

Lint/type checks, 107 dependency/tooling cases and the focused controls pass.
Fresh full backend/client coverage, normal browser/build/quality gates, independent
OS-image results, final maintenance and exact-source CI remain to be recorded.
Retain the five known startup-browser contract failures as baseline debt.

Both current PRs are recently updated and mergeable; an unstable check state is
not a merge conflict. No PR merge, closure or rebase is performed at this point.
Recheck at delivery and rebase only genuinely stale applicable branches.

No provider write, live configuration change, release or deployment occurs.
Recommendation remains this compatible one-package subset, followed by a genuinely
corrected published Node 24 artifact and separately scoped DOM/native/compiler,
npm-bundle and browser-contract work.
