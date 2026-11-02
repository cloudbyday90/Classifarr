# v0.49.4 CI and security follow-up outcome

Date: 2026-11-02. Design: [CI/security follow-up](release-0494-ci-security-design.md).
Release tracking: [qualification outcome](release-0.49.4-beta-outcome.md).

## Failures and repair

Recent main CI/CD runs 41495563845, 41506747322, 41514072878 and 41518869745
failed database integration setup. Candidate run 41527137906 reproduced it:
Build and Test and Fresh Install and Published Upgrade passed, but ten legacy
fixtures reached the immutable capture TRUNCATE guard. The resulting release
readout failure and skipped publication jobs were correct gate behavior.

The shared test-only helper now deletes restrictive dependants and the History
parent through its supported cascade lifecycle; catalog fixtures clear their
references before parents. All ten repaired suites plus the existing capture
guard/lifecycle suite pass: 11 suites, 125 checks. Production guards, schema,
runtime SQL, acceptance requirements and test assertions are unchanged. No live
database was used. Complete integration and final exact-SHA CI remain release
gates; this focused result alone does not establish release readiness.

## Dependency evidence

Both independent installed trees now use exact glob 14.0.3/minimatch 11.0.4.
Reviewed lock changes are restricted to the coherent development graph described
in the design: four records in client and five in server, no new installers or
runtime dependencies. Strict clean installs and complete npm tree checks pass.
The root dependency graph, other overrides and installer decisions are unchanged.

Before upgrading, the permanent real-library cancellation tests admitted twelve
directory reads instead of one in each CJS/ESM promise/stream case. The bounded
pattern fixture generated 256 internal rows despite an explicit limit of four.
After upgrading, cancellation admits only its first read and expansion retains
at most four rows. Ordinary sync/async/stream files, exact matching options,
cache isolation and real coverage/archive/readdir/EditorConfig/beautifier
consumers pass. An intentionally insufficient expansion budget need not preserve
every complex match; positive controls use sufficient budgets. No application
exploitability or universal pattern-equivalence claim is made.

The complete dependency suite passes 97 checks. Copyright Compliance now installs
the independently tested server tree before invoking it. Full lint passes. The
rebuilt production UI passes all eight Chromium navigation/chunk checks.

Fresh full audits including development dependencies report root/client zero and
server five low wrapper records, all deriving from the single rejected deepmerge
advisory. There are zero moderate/high/critical workspace findings after these
patches. The full report is intentionally not described as zero. The separately
bundled npm finding is outside those workspace reports.

## Real scanner scope and expiry

The actual OSV action image v2.7.0 resolves to
sha256:d54770fe0b09493894e76a02aaed9f51a0513fa57c5186452a755d257b0068a6.
Its binary identifies 2.7.0_GHAction, commit
bfe2f84abd2f09fe0b83ba7f6dad40d296762f40. Scanning copies of the three actual
locks and directory-local configs returns zero unfiltered findings and exactly
one filtered advisory, citing the immutable CNA rejection.

The current-main documentation's effectiveUntil field was rejected by this
pinned binary; the official v2.7.0 documentation and real scan validate ignoreUntil.
With the same server lock outside that configured directory, the advisory returns
and the scanner exits 1. With only a disposable copy's date changed to an expired
date, it likewise returns and exits 1. The repository config remains November 9;
no global override, other ID, package or severity is suppressed. The upstream
database lag and the temporary triage are not package remediation.

## Remaining release work

Full integration, fresh combined coverage and all exact-source image/frozen/remote
gates are recorded in the release tracking document and raw private receipts.
The maintainer explicitly accepts npm 12.2.1's moderate bundled ip-address 10.7.2
finding for v0.49.4-beta only, conditional on every other gate passing. A fresh
final image must retain that disclosure; later releases require verified repair.
There is no deployment, production cleanup or PR merge in this batch.
