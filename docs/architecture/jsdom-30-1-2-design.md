# Frontend DOM test environment refresh: design

Reviewed 2026-10-04. Starting revision: `85c7bcb8`. Development tooling only.

## Decision

Pin client jsdom to **30.1.2**, replacing locked 30.1.1. Remove the jsdom-specific
Undici 7.29.1 override so its declared `^8.11.2` dependency can resolve normally.
Review the resulting exact lockfile before installing. Keep all other overrides,
strict lifecycle-script decisions, test isolation and worker limits unchanged.
No application service, API, database migration, image or release change is needed.

The registry and official GitHub API both identify the new release on October 4.
Search results still showed 30.1.1; the exact release page and API are the evidence
for this candidate. This same-day release needs regression checks, not automatic
acceptance based on its patch version.

The old override was introduced for an Undici advisory. Upstream documents its
fix in 7.29.1 **and 8.10.2**. jsdom now requires at least 8.11.2, and Node 24.21.0
satisfies both packages' engines. Removing this override is compatibility cleanup,
not a claim that the currently installed patched version was vulnerable.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Exact jsdom patch + upstream transport range | Better DOM fidelity; removes stale major-version override | Same-day release and transitive changes need testing | Adopt if checks pass |
| Keep 30.1.1 indefinitely | No immediate churn | Misses upstream focus, style and cleanup fixes | Do not retain without a regression |
| Keep forcing Undici 7 | Preserves the old graph | Outside jsdom's declared dependency range | Retire after transport checks |
| Replace the test framework | Could avoid DOM emulation | Unnecessary migration; browsers still need separate checks | Reject for this batch |

First verify the bounded jsdom update. Next review remaining transitive overrides,
especially server Discord transport pins, separately from this client change.
Keep Node 24 typings rather than adopting the latest Node 26 major. Keep client
TypeScript 6.0.3 under the existing [Vue compatibility decision](../vue-typescript-compatibility-design.md).
Neither intentional pin is a reason to disable `npm outdated` or audit checks.

## Verification and security

Add small ESM contract tests through the existing Vitest discovery path. Exercise
hidden focus targets, retained selection collections and stylesheet mutation;
run the same assertions before and after the update. Test the actual jsdom HTTP
path against an ephemeral loopback server, including after Node's built-in fetch
has run. Close owned windows and sockets in cleanup. Never enable untrusted script
execution, use external URLs in these tests, or count a mocked dispatcher as proof
of transport compatibility. No timing/RSS assertion will claim upstream memory
fixes as a measured application performance improvement.

1. Generate the lockfile with scripts disabled; review additions, removals,
   engines, optional peers, installer flags, source URLs and integrity changes.
2. Clean install under the existing strict policy; check `npm ls --all`, npm audit
   including development packages, and independent OSV results.
3. Run focused contracts, full client coverage, lint, typechecks and build.
   Run existing real-browser modal/preset checks and production-route smoke.
4. Run repository dependency-policy tests and documentation/diff/secret checks.
   Do not combine an old backend report with new frontend coverage to claim a
   fresh whole-repository coverage result.

No runtime behavior changes are planned. jsdom does not implement browser layout
or native modal behavior fully; preserve explicit test doubles and real-browser
checks. Automated checks do not establish WCAG conformance. Rollback is a reviewed
revert of manifest, lockfile and version-specific contracts together.

## Official sources

URLs discovered through web search, registry metadata, existing documented
advisory references and the official GitHub release API, then retrieved on
2026-10-04:

- [jsdom 30.1.2 release](https://github.com/jsdom/jsdom/releases/tag/v30.1.2):
  fixes focus/style invalidation, selected-options freshness and DOM performance;
  describes reduced CSS/window and MutationObserver retention.
- [jsdom documentation](https://github.com/jsdom/jsdom): documents DOM emulation,
  resource configuration and the absence of full navigation/layout support.
- [Undici support matrix](https://github.com/nodejs/undici): Undici 8 supports
  Node 24; installed-package fetch objects should not be mixed with global ones.
- [Original Undici advisory](https://github.com/nodejs/undici/security/advisories/GHSA-8436-99hf-9mmv):
  patched versions include 7.29.1 and 8.10.2.
- [npm clean install](https://docs.npmjs.com/cli/commands/npm-ci/) and
  [outdated semantics](https://docs.npmjs.com/cli/v11/commands/npm-outdated/):
  frozen installation and the distinction between wanted and latest tags.
- [W3C evaluation-tool guidance](https://www.w3.org/WAI/test-evaluate/tools/selecting/):
  automated checks assist evaluation but cannot replace human judgment.

Outcome and measured limits belong in a separate document after validation.
