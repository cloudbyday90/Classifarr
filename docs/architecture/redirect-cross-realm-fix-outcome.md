# Cross-realm redirect dependency fix outcome

Date: 2026-11-02 (America/New_York). Status: implemented and locally verified.
Design: [scope, tradeoffs and official research](redirect-cross-realm-fix-design.md).
Implementation base: f12c0301a862c56bf7c9127f9cc4297e87faa0e5 on main.

## Reproduced boundary and result

Both independently installed follow-redirects 1.16.1 copies discarded a genuine
foreign-realm sensitiveHeaders array. The expanded existing Node suite first
ran with the old exact-version assertions intact: 21 passed, four failed.
Every failure was the intended cross-origin custom-header assertion: root and
client, each with object and raw-array request headers. The initial origin had
received the synthetic credentials, the response completed with HTTP 200, and
the redirected origin received a custom credential that should have been removed.
Same-origin, same-realm, redirect-limit and actual Axios controls passed.

The fixed VM code produces an array for which Array.isArray is true and local
instanceof Array is false; the array is passed unchanged to the installed library.
No JSON round trip or local clone erases the boundary. Values are synthetic,
origins are ephemeral loopback listeners, and connections are closed afterward.

Exact 1.16.2 overrides, independent locks and clean installs now agree in both
trees. All 25 checks pass, including the four previously failing cases, foreign
same-origin preservation, standard/custom header filtering, ordinary headers,
redirect limits and actual Axios GET/JSON POST controls. Existing dependency CI
still installs both trees before running the suite. No new runner is introduced.

This verifies the installed Node-library boundary; it does not establish an
application credential leak. Axios controls retain their distinct meaning, and
browser checks do not substitute for the direct-library reproduction. Existing
raw-array duplicate-header limitations remain unchanged.

## Installation and package review

Pinned Node 24.22.1 and npm 12.2.1 were used. Scripts-disabled lock generation
changed only the follow-redirects artifact in client, and the root direct Axios
pin plus Axios/follow-redirects artifact entries in root. No package was added or
removed. Root Axios has its [separate outcome](root-axios-1-21-outcome.md).

The patched redirect artifact's integrity matches registry metadata; its engine
is Node >=4, with no dependencies or peers declared. Both Axios parents accept
follow-redirects ^1.16.0. Neither updated artifact has a published install-script
flag; Axios's development prepare script does not become a new install allowance.
Both strict-policy npm ci installs and complete npm ls --all checks passed.
All other overrides, lifecycle decisions and scanner policies are unchanged.

## Measured verification

| Check | Observed result |
| --- | --- |
| Old-version redirect/HTTP reproduction | 21 passed; four expected cross-origin failures |
| Patched redirect/HTTP matrix | 25/25 passed; no skips |
| Dependency/tooling suite | 69/69 passed; no skips |
| Root/server/client lint and typecheck | Passed |
| Fresh client coverage | 483 files; 7,505 tests passed in 212.80 seconds |
| Client coverage S/B/F/L | 87.90 / 82.04 / 87.69 / 89.58 percent |
| Production build and browser asset/navigation suite | Passed; eight Chromium tests, 10.5 seconds |
| Coverage ratchet | Passed with the unchanged backend report |
| Static-import and ESM mock-shape checks | Passed |
| Copyright, policy language/naming/delivery/maintenance gates | Passed |
| Inventory writer ownership compatibility | Passed |

Backend coverage is reused, not rerun: server source has no diff, manifest/lock
and installed lock hashes match, the complete installed-tree JSON is identical,
and the coverage-summary hash is unchanged. Its statements/lines are 89.23%,
branches 86.65% and functions 90.79%. The earlier full backend run is recorded in
the [reservation outcome](capture-reservation-fence-outcome.md). No database or
container-image rehearsal is claimed for this dependency-only batch.

## Full audits and remaining work

Full November 2 audits include development dependencies. The target
[GHSA-mrwp-f3q8-3g9p](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-mrwp-f3q8-3g9p)
is absent from both updated results; neither Axios nor follow-redirects remains
an affected audit node. These are local npm results, not remote scanner receipts.

| Independent tree | Before | After |
| --- | --- | --- |
| Root | Four high | Two high: Markdownlint and RE2JS |
| Client | Two high, eleven moderate | Eleven moderate; zero high |

All remaining affected package nodes are dev-only in the respective locks.
Root's two entries represent one RE2JS advisory propagated through Markdownlint;
they are not two independent vulnerabilities. Client's remaining entries include
glob/minimatch tooling chains. No low or critical findings were reported.
Audit feeds can change independently of locks, so historical count changes are
not treated as proof of a fix. These nonzero audits remain explicit limitations.

Next priority: assess the separate
[RE2JS lookbehind advisory](https://github.com/advisories/GHSA-gg6h-894w-4m9c)
through Markdownlint, verify compatible patched resolution and actual consumer
usage, then choose a bounded dependency batch. Do not apply npm's suggested
Markdownlint downgrade or audit fix --force automatically. After that, resume
checkpoint/advance/publication ownership fencing with manual cache authority
kept separate.

The final recommendation remains the small upstream patch with exact independent
pins, strict installs and real boundary controls. This costs ongoing override
maintenance; it avoids introducing a production transport wrapper or fork.
The [design](redirect-cross-realm-fix-design.md) records alternatives and the
limited application of W3C data minimization to synthetic credential tests.

## Delivery and maintenance

Design and observed outcomes are separate, relevant historical follow-ups point
here, and CHANGELOG has Unreleased notes. PR state and local adoption are recorded
in the [root Axios outcome](root-axios-1-21-outcome.md).

Scoped artifact maintenance reused the recent verified filesystem inventory and
the six changed-directory / 3,541 unreviewed-root-file exclusions. Fresh pinned
desktop-linux daemon, all-container and image inventories retain three
containers and 425 image-tag rows. Classifarr's identity, image, start time and
healthy state are unchanged. No files/images were removed; current evidence,
recovery assets, shared cache/volumes, worktrees and other projects stay protected.
Detailed validation and maintenance receipts remain private under .tmp.

No server transport, schema, UI, operator CLI trigger, job, routing/learning,
version bump, release, deployment or service restart is included.
