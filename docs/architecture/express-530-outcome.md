# Express 5.3 runtime compatibility — outcome

## Change and evidence

Work performed on `main` on 2026-10-11, without an application version bump or
release. The [design](express-530-design.md) records official-source research,
tradeoffs and acceptance criteria. Express is locked to 5.3.0, content-disposition
to 2.0.1 and content-type to 2.1.0. Two nested content-type 2.0.0 copies are
deduplicated. No unrelated package, security override or installer policy changed.

Before upgrading, the new six-test real HTTP suite failed one test under Express
5.2.1: chunked `res.send()` also emitted Content-Length, and the client rejected
the ambiguous framing. The other five tests passed. With 5.3.0, all seven focused
suites / 80 tests passed. A separate final application-suite check passed 32
tests, including newly added production async-error sanitization and the default
JSON body-size limit. These are synthetic HTTP checks, not evidence of a reported
production framing incident.

The script-disabled review install and normal policy-controlled server install
passed. `npm ls --all` is clean and the full server npm audit (including development
dependencies) reports zero advisories on 2026-10-11. A zero audit is not a complete
security assessment. The application keeps its existing custom error middleware,
CSRF/CORS controls, generic API 404, backup-name validation and memory/ownership
safeguards. All new application-owned JavaScript is ESM test code; upstream
transitive package module formats are not rewritten.

## Random open PR trial

The fresh random selection from open PRs #555 and #556 chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Its exact client manifest and lockfile
changes were applied locally: `@types/node` 24.19.2 to 26.6.4 and `undici-types`
7.24.6 to 8.9.0. Registry integrity values matched and no install hooks were added.

Both install modes, dependency-tree validation, full audit and client typecheck
passed. The tooling suite passed 39/40 checks: the sole failure correctly rejected
Node 26 declarations against deployed Node 24. The exact trial was restored, not
merged; restored install, tree, audit and client typecheck pass. The client manifest
and lockfile are unchanged. Newer registry declarations are not a reason to widen
runtime support or weaken the alignment guard.

## Identity investigation

The [separate fresh identity audit](source-scope-audit-20261011.md) explains all
eleven local unresolved records: seven complete single-series episode proposals,
two single-episode gaps and two incomplete grouped-source mappings. Catalog
membership is not identity approval. No real mapping or source metadata was
changed by this dependency update, and no fresh Unraid count is claimed.

## Remaining verification

Full checks and exact-image local rebuild/schema evidence are still in progress.
This section will be replaced with observed results, including any failed checks
and retests, before handoff. No production container or shared provider is changed.

## Recommendation stack

Keep the bounded Express upgrade only if the remaining gates pass. For identities,
use explicit approval with fresh complete evidence for the seven eligible proposals,
then investigate the two episode gaps and grouped-season worksets separately.
For tooling, the next small batch is Knip 6.40.0 to 6.41.0; client Playwright,
Vue tooling/router and the TypeScript major belong in separate compatibility
reviews. Do not bundle those updates or a release into this change.
