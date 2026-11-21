# OSV Scanner Action 2.7.1 outcome

November 21, 2026 Eastern. Local adoption of the workflow update from
[PR #590](https://github.com/cloudbyday90/Classifarr/pull/590), following the
[assessment design](osv-action-pr-590-design.md).

The workflow matches the reviewed PR blob. Four action and reusable workflow
references now use `32d3cd482bdadfb38b186c0ad1b031902d55d932`. The existing
contract test expects that revision. The surrounding triggers, permissions,
scanner inputs, failure settings and SARIF paths match the baseline.
The workflow contract and actionlint passed.

The exact Linux amd64 image from the design reported `2.7.1_GHAction` and
scanned read-only copies of the three workspace lockfiles with the existing
configuration. It enumerated 1,139 package entries and returned exit code 0
with no issues found. It warned that `ignoreUntil` is deprecated and listed the
expired `GHSA-gcqx-w48m-w2h4` ignore as unused. The advisory is withdrawn.
The existing scanner policy still applies. [OSV record](https://osv.dev/vulnerability/GHSA-gcqx-w48m-w2h4)

The local run exercised the scanner container. The hosted full push scan
provides separate evidence for the reusable workflow and its SARIF path.
The Dependabot and merge-group paths require their own events. GitHub reported
three open Dependabot PRs and each head applied cleanly to `main` in the local
merge-tree check. The PR branches were left alone.
