# Client Axios 1.21 adoption outcome

Date: 2026-11-02 (America/New_York). Status: locally implemented and verified.
Design: [random selection, alternatives and research](client-axios-1-21-design.md).

## Applied boundary

Randomly selected open [PR 575](https://github.com/cloudbyday90/Classifarr/pull/575)
was reviewed at c36124db7519241f66218d560198e0736a081b02. Its client-only Axios
1.20.0 to 1.21.0 update was adopted locally on main with an exact direct pin.
Root Axios, server dependencies, application transport policy and all existing
overrides remain unchanged. The PR was not merged.

Scripts-disabled lock generation changed only the direct version and Axios
artifact version/URL/integrity. No transitive version changed and no package was
added or removed. The published lock entry has no install-script flag. npm ci
passed under the existing strict script policy; npm ls --all and tooling
dependency checks passed. Pinned Node 24.22.1 / npm 12.2.1 were used.

## Behavioral evidence

An unmocked Axios test first reproduced 1.20.0 dropping a literal Link default
alongside method-specific headers. The same case passes on 1.21.0. Other real
Axios core/central-transport checks prove explicit CSRF, credentials, JSON
transformation, pre-dispatch cancellation and no automatic replay or auth refresh
for protected commands after 401, 503 or network rejection.

Focused compatibility and existing interceptor tests passed two files / 24
tests. Client lint/typecheck and the production build passed. The existing
production policy-route asset suite passed all eight Chromium tests in ten
seconds, serving newly built dist assets without reusing an existing server.
No new UI or operator action is involved. Full client/backend coverage and the
ratchet are recorded in the [reservation outcome](capture-reservation-fence-outcome.md).

## Audit result and unresolved redirect advisory

Full client npm audit, including development dependencies, ran on November 2.
The baseline main lock reported thirteen findings: two high and eleven moderate.
The updated client lock reports twelve: one high and eleven moderate, no low or
critical. All eleven moderate findings are dev-only in the lockfile. No affected
package was added; the parent Axios entry disappeared.
That entry referred to follow-redirects, whose finding remains. This count change
does not prove that the underlying redirect vulnerability is fixed.

Both root and client intentionally pin follow-redirects 1.16.1 under earlier
security overrides and test those exact pins. The newer
[GHSA-mrwp-f3q8-3g9p advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)
affects versions 1.16.0 through 1.16.1 and lists 1.16.2 patched. Its condition is
a cross-realm sensitiveHeaders array being discarded, allowing custom credential
headers to follow a cross-origin redirect. This concerns the Node redirect path;
passing browser checks does not clear the installed dependency finding or prove
an application exploit. The remaining high node is not dev-only in the lockfile.

The approved batch preserves overrides and separates root updates, so this
coupled change was not silently added. The exact 1.16.2 artifact and Node engine
metadata have been verified in the npm registry. Next priority: update both
overrides/locks and their exact-pin tests together, add Node vm cross-realm
object/array-header regressions against two loopback origins, and retain standard
credential stripping plus same-origin controls. Assess moderate tooling findings
separately; do not use audit fix --force or weaken install/scanner policy.

The prior [redirect fix outcome](redirect-dependency-fix-outcome.md) remains
evidence for its earlier two assessed bugs, not this subsequently published case.

Subsequent November 2 batch: the [cross-realm fix outcome](redirect-cross-realm-fix-outcome.md)
records the completed coupled 1.16.2 patch, fresh audit and expanded regression
matrix. The counts and retained 1.16.1 pins above describe this earlier batch's
boundary. Root Axios adoption has its [own outcome](root-axios-1-21-outcome.md).

## Delivery

At intake all four open Dependabot PRs were fresh and mergeable. GitHub MCP
delivery recheck still found the same four open PRs and PR 575 mergeable at the
reviewed head. Remote main matched the implementation base before commit.
A fresh independent branch being behind this implementation does not alone
justify a rebase; none was rewritten. No bot message, PR merge, release or
deployment was performed. Design, measured outcomes and Unreleased notes are
separate from the reservation implementation.
