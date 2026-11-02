# Cross-realm redirect dependency fix design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and locally verified.
Outcome: [measured results and remaining findings](redirect-cross-realm-fix-outcome.md).
Predecessor: [client audit and remaining redirect finding](client-axios-1-21-outcome.md).

## Evidence and first boundary

Both independent root/client dependency trees install follow-redirects 1.16.1
under exact overrides. Its sensitiveHeaders check uses a local instanceof Array
helper. A genuine array from another JavaScript realm fails that check and is
replaced by an empty list. Caller-designated custom credential headers can then
reach a different-origin redirect target. The raw header-array conversion already
uses Array.isArray, so ordinary same-realm tests miss this separate boundary.

The maintainer identifies 1.16.2 as patched. Its source change replaces the
sensitiveHeaders check with Array.isArray and removes the obsolete helper.
Both installed Axios versions accept follow-redirects ^1.16.0. The pinned Node
24.22.1/npm 12.2.1 toolchain satisfies the patched package's Node >=4 engine.

This is dependency remediation, not evidence of an application credential leak.
No production sensitiveHeaders caller was found. Server dependencies do not
include Axios/follow-redirects, and the backend HTTP path uses native fetch.
Client browser transport and root Node tooling have different execution paths;
passing browser tests alone cannot discharge this Node-library finding.

## Proposed implementation

Change only the root and client follow-redirects overrides to exact 1.16.2,
regenerate/review their independent locks and strictly reinstall both trees.
Keep the server tree and all other overrides, install-script decisions, scanner
thresholds and application transport policies unchanged. Do not vendor a custom
fork, normalize foreign arrays at a call site, or add a production wrapper that
would hide the defective dependency boundary.

The separately selected root Axios PR is described in its
[own design](root-axios-1-21-design.md). Review its package-node delta independently
even though the same root lock and clean install contain both approved updates.

Extend the existing deterministic regression suite at
scripts/__tests__/redirect-dependency-security.test.mjs. Reuse its independent
installed-tree imports, two ephemeral loopback origins, three-second request
bound and server cleanup. No new runner, service file or test framework is needed.

For root and client, with both object and raw-array request headers:

1. Construct a real foreign sensitiveHeaders array using node:vm with fixed
   synthetic names. Assert Array.isArray is true and instanceof Array is false.
   Pass it unchanged; cloning it back would erase the tested realm boundary.
2. First reproduce the failure on installed 1.16.1 while leaving its baseline
   version assertions intact. Require HTTP 200 and proof the initial origin
   received every synthetic secret, rather than treating an earlier rejection
   as proof of safe filtering.
3. On 1.16.2, require the redirected origin to omit built-in and custom sensitive
   headers while retaining the ordinary header. Preserve the foreign-array
   same-origin control, including every legitimate credential value.
4. Retain existing same-realm object/array, redirect-limit and real Axios controls.
   Add bounded JSON POST compatibility alongside the existing GET behavior.

Update exact manifest/lock/installed-package expectations only after baseline
reproduction. Both copies must agree on 1.16.2; no mixed-version acceptance,
conditional skip or scanner suppression is allowed. Existing CI already installs
both trees before invoking the dependency suite; keep that enforcement.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Compatible exact 1.16.2 override in both roots | Small upstream security patch with reproducible installs | Override must remain maintained and tested | Recommend |
| Change only the repository-root override | Smaller edit | Client's independent install remains affected | Reject |
| Clone arrays or filter custom callers | May cover a known caller | Masks the library defect and misses other consumers | Reject |
| Fork the dependency or replace the transport | Greater local control | Unnecessary maintenance and wider compatibility risk | Defer |
| Suppress the advisory or weaken tests | Fewer failing checks | Retains the faulty boundary | Reject |

Final recommendation stack: genuine failing reproduction, exact coupled patch,
reviewed locks, strict clean installs, matching installed-package evidence,
loopback boundary/legitimate controls, full audits and existing client/quality
gates. Keep the root Axios adoption attributable as a separate reviewed change.

## Security, standards and limits

Use only synthetic values and trusted fixed VM code; node:vm supplies a separate
realm here, not a security sandbox. Bind test servers to loopback and close their
connections. Do not contact providers, simulate against the live application,
record real credentials or change production redirect/retry policy.

Preserve the earlier raw-array duplicate-header limitation: conversion to objects
can retain only the last identically cased duplicate. Do not extend this fix into
a promise about arbitrary raw Node header representations.

The November 2 baseline full audits report four high package findings in root
and two high plus eleven moderate in client. Counts include parent-package
propagation. The separate RE2JS/Markdownlint developer-chain finding is outside
this redirect batch and must remain visible; do not apply the suggested unrelated
downgrade automatically. Compare advisory identities as well as counts after the
update, since audit feeds can change independently of a lockfile.

## Validation and delivery

Use existing dependency/tooling tests, npm ls --all, npm explain and full npm
audits for both roots, including developer dependencies. Check every lock change,
engine, peer and published lifecycle flag. Run client lint/typecheck, fresh
coverage/build and the existing production-browser asset suite. Reuse the current
backend report only if backend source and its installed tree remain unchanged;
otherwise obtain fresh relevant backend coverage before the ratchet. Do not
broaden database or image testing for this dependency-only change.

Write a separate observed outcome, refresh relevant historical follow-ups,
update Unreleased, perform scoped artifact maintenance, and commit/push on main.
No new branch, schema, API, UI, operator CLI trigger, job, provider permission,
routing/learning change, PR merge, version bump, release or deployment is included.

Next after this batch: assess the remaining RE2JS/Markdownlint developer-tool
advisory, then resume checkpoint/advance/publication ownership fencing.

## Official sources

Discovered through search/GitHub MCP and read on 2026-11-02:

- [Maintainer advisory GHSA-mrwp-f3q8-3g9p](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-mrwp-f3q8-3g9p):
  affected versions, cross-realm condition and patched 1.16.2 boundary. Its
  moderate label and npm's high package labels are distinct source assessments.
- [Maintainer 1.16.2 release](https://github.com/follow-redirects/follow-redirects/releases/tag/v1.16.2)
  and [exact source fix](https://github.com/follow-redirects/follow-redirects/commit/b0a7751e9cd64cd8eeb6ec67d2f206a9cc88d3f8):
  verify the maintained release and array check rather than guessing a tag.
- [npm package.json overrides](https://docs.npmjs.com/cli/configuring-npm/package-json/):
  overrides apply to a project's root manifest; these prefix-installed trees
  have separate roots and need separate locks/install evidence.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/):
  apply data minimization by retaining only required cross-origin headers and
  testing with synthetic secrets. This is an application of the principle,
  not a claim that W3C specifies this package patch.

Exact-version registry, installed-parent explanations and baseline audit receipts
remain private under .tmp.
