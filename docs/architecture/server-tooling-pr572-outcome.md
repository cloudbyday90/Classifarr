# Server tooling PR 572 outcome

Date: 2026-10-27. The [design](server-tooling-pr572-design.md) records selection,
exact candidate versions, official research, alternatives and safeguards.
Local validation is complete; no PR has been merged and no release is included.

## Applied dependency graph

The local manifest pins `eslint-plugin-n` 18.5.0 and `knip` 6.42.1. The reviewed
provider lock changes 24 package records plus root metadata, with no package
additions/removals or `hasInstallScript` changes. Changes include `oxc-parser`
0.154.0, its matching types and 19 optional platform bindings, and `unbash`
6.0.1. Candidate engines and peers fit Node 24.22.1 and ESLint 10.13.0.

The only local deviation from the immutable provider lock is the deliberate
exact root pin for `eslint-plugin-n`, replacing the PR's caret range. Lockfile
generation used npm 12.2.1 with scripts disabled. The subsequent clean install
under the existing strict script policy succeeded with 630 installed packages.
`npm ls --all --json` also succeeded. Overrides and script decisions were kept.

The existing portable Node 24.22.1/npm 12.2.1 tools were used without modifying
the global installation. The Node executable hash matches the release checksum
discovered through the [official archive](https://nodejs.org/en/download/archive/v24.22.1).
Initial baseline Knip 6.41.0 full and production dependency scans both passed.
The updated 6.42.1 full and production dependency scans also passed. Backend
source/test ESLint, typechecking, complete package-tree validation and 59
dependency-tooling tests passed. Full backend coverage passed all 1,880 suites
and 60,444 tests, with one existing skip. Six relevant PostgreSQL integration
suites passed all 60 tests. Frontend coverage passed 477 files and 7,374 tests;
client typechecking and production build also passed. Fresh backend/frontend
coverage passed the unchanged ratchet. The
[purpose outcome](purpose-authority-consistency-outcome.md) records coverage and
the environmental corrections made before the successful complete runs.

## Security findings retained

The full-scope audits before and after the update are identical: two high and
one moderate package findings, representing two underlying advisories. Express
is reported through body-parser, rather than being a third independent issue.
This update does not establish an advisory-free dependency tree.

- [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828):
  the existing 2.3.0 override is affected; 2.4.0 is patched. Static inspection
  found normal and restore bootstrap parsers permit decompression before route
  authentication. A size limit does not establish mitigation for the reported
  trailing-byte stream error. No exploit or live request was run.
- [qs advisory](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw): installed
  6.16.0 is affected; 6.16.1 is patched. The reported sink requires comma-format
  serialization. Application sources have no direct matching use; inspected
  Express/body-parser calls parse, and development Superagent serializes with
  repeat-style arrays. Reachability of the vulnerable sink was not established.

The next bounded security batch should patch those two existing overrides,
review the transitive graph, and test malformed compressed bodies in an isolated
process alongside valid JSON, urlencoded and restore controls. No Express major
upgrade is required by the inspected dependency ranges. The separate existing
npm CLI bundled-parser release hold also remains in force.

## Pull-request housekeeping

PR 568 was stale and conflicted. Its only requested change, ESLint 10.13.0,
already existed on main with an exact pin. Its immutable diff was inspected and
the superseded PR was closed without merging or recreating its branch.
PRs 569, 570 and 571 were based on current main and mergeable at initial review.
The selected PR 572 was implemented and tested locally without merging its
provider branch. The
[code commit](https://github.com/cloudbyday90/Classifarr/commit/b996046021f5070cf78a3f2eb7b5a89b36c98727)
was pushed to main and its remote SHA verified. PR 572 was then closed as
implemented locally, without a provider merge. The documented `@dependabot
rebase` command was submitted to PRs 569, 570 and 571 to refresh the remaining
updates against the new main. These are confirmed requests, not a claim that
the asynchronous bot rebases have completed. No ignore command was used.
