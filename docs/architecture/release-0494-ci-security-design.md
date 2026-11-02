# v0.49.4 CI and security follow-up design

Date: 2026-11-02. Baseline: f9d7532672ca13ef0640eb107e4440565624f9c2.
The maintainer approved the coupled dependency assessment, narrow CNA triage and
v0.49.4-beta-only npm acceptance, and requested repair of recent CI/CD failures.
Publication still requires the complete [release workflow](../../.agent/workflows/release.md).

## Database integration fixtures

Four recent completed main runs fail in Tests with Database; the current run
41527137906 repeats that failure. Ten suites still use parent TRUNCATE CASCADE.
The immutable policy-capture migration deliberately rejects truncation, even
when empty, so those fixture commands now fail before their assertions run.
Release Acceptance Readout consequently blocks downstream publication correctly.

Use a small integration-only helper in the existing disposable per-suite
database. Delete restrictive History dependants before the History parent, then
let its foreign keys cascade protected child evidence. Catalog fixtures also
delete sync references/items before libraries and their server. Keep unrelated
fixture truncations and their identity resets where they remain supported.
Parent identity sequences need no reset: generated IDs are read from INSERT
results and deliberate fixed IDs are inserted explicitly.

Do not disable triggers, alter production SQL/schema, change acceptance policy,
skip failing suites or turn assertions into mocks. Verify all ten suites and the
existing capture deletion/truncation controls, then run the complete integration
suite against isolated PostgreSQL. This repairs test setup, not classification.

## Coherent glob and minimatch upgrade

Assess exact server/client overrides glob 14.0.3 and minimatch 11.0.4 together.
glob 14 adapts to minimatch 11's Matcher/API changes; forcing only minimatch 11
under glob 13 is incompatible. Retain every other override and the pinned
Node 24.22.1/npm 12.2.1 strict installer policy.

The reviewed locks add nonrecursive-glob-match 1.0.3 and advance path-scurry to
3.0.0; the server's nested LRU cache resolves to 11.5.3. All changed records are
development-only, fit the pinned engine and add no installer. The client already
uses that LRU release. Root dependency artifacts remain unchanged.

Bounded old-library probes reproduce new readdir admissions after abort and
256 pattern rows from eight repetitions despite a four-row expansion limit.
Freeze those checks against both independent CJS/ESM copies, with ordinary
sync/async/stream results, matching options and cache isolation. Verify real
coverage, archive, readdir, EditorConfig and beautifier consumers. Extend the
existing dependency suite and install its server tree in Copyright Compliance;
retain the existing root/client ordering checks and strict installations.

Official sources retrieved on November 2:

- [glob advisory](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4)
  and [14.0.3 changelog](https://github.com/isaacs/node-glob/blob/v14.0.3/changelog.md).
- [minimatch advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
  and [11.0.4 changelog](https://github.com/isaacs/minimatch/blob/v11.0.4/changelog.md).

## Rejected advisory and separate accepted residual risk

CNA VulnCheck rejected CVE-2026-93753 at 2026-11-02T16:33:19.357Z because it
does not describe a security vulnerability. GitHub/OSV/npm still report its
deepmerge advisory and no patched package is published. Add only the exact
GHSA-gcqx-w48m-w2h4 ID in server/osv-scanner.toml, expiring November 9. The
immutable [official CVE record](https://github.com/CVEProject/cvelistV5/blob/3c07b72fc0c95e4db36a9ada8761f28c89541eba/cves/2026/93xxx/CVE-2026-93753.json)
supports data-quality triage, not a remediation claim. Full audit lag remains
visible. No other finding, severity or scanner policy is excluded.

The [pinned OSV 2.7 configuration](https://github.com/google/osv-scanner/blob/v2.7.0/docs/configuration.md)
uses ignoreUntil and directory-local configuration. Current main documentation
uses a newer field that the pinned binary rejects. Verify the real scanner's
scope and expiry; do not use a global config override or package-wide exclusion.

The maintainer separately accepts npm 12.2.1's moderate bundled ip-address 10.7.2
finding for v0.49.4-beta only, conditional on every other gate passing. Keep this
actual production-image exposure disclosed and require verified remediation
before later releases. Workspace ip-address 10.7.4 does not patch the npm copy.
No alternate npm distribution or downstream vendor patch is included.

## Recommendation and verification

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep old glob/minimatch | Avoids major compatibility review | Leaves two valid advisories in both tooling trees |
| Upgrade both with real consumer controls | Removes affected versions coherently | Requires fresh full dependency and release qualification |
| Wait for advisory database convergence | Needs no temporary triage | Blocks on a rejected record's downstream lag |
| Exact short-lived CNA triage | Preserves other scanner checks | Requires expiry review; npm audit may still report lag |

Use the coupled patches, supported fixture lifecycle and short-lived exact-ID
CNA triage. Retain the explicitly accepted one-release npm risk as a separate
mandatory follow-up. Run strict clean installs, tree checks, full audits,
dependency tests, full lint/test:ci with fresh joint coverage, all integrations,
browser/provider and fresh exact-source image/frozen checks. Require exact-SHA
remote checks and all tag-workflow evidence before a publication claim. No live
deployment or production cleanup is included.
