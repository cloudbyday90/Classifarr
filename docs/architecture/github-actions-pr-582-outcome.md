# GitHub Actions PR 582 local adoption outcome

Date: 2026-11-09 Eastern. Status: locally adopted and verified under the
[agreed design](github-actions-pr-582-design.md). No PR merge, release or deployment.

Uniform selection chose PR 582 from five open PRs. The exact MCP patch contains
eight action-reference updates in four workflows. Official tag/source checks
confirm the two proposed upstream revisions and the authentication/scanner
compatibility considerations recorded in the design.

The four workflows now use Docker Login 4.8.0 at
8aa5831fb8d48d8f76594c7ddde61ae58019f550 and CodeQL 4.39.3 at
33d7b85da1a04171e211befe2c739303b9a4c066, with exact release comments. Only the
two assessed expectation revisions move with them: promotion's exact login step
and the scanner pin-consistency test. Existing assertions and failure mutations
remain intact.

The release-provenance and release-candidate-publication contract commands pass.
The combined focused batch passes eleven suites / 309 tests, including scanner,
promotion, publication, provenance and pull-auth contracts. Full lint/typecheck,
ownership, dependency declaration and other normal gates also pass. Fresh full
backend coverage passes 1,930 suites / 62,648 tests with one existing skip against
the frozen final sources, and the unchanged coverage ratchet passes. The runtime batch's
[separate outcome](native-purpose-positive-operators-outcome.md) records shared
quality and audit results.

All existing triggers, credentials, permissions, scanner severity/failure settings,
publication dependencies, protected environment and exact digest acceptance remain.
No npm manifest, lockfile, installed tree or installation policy is changed, so a
new npm install is unnecessary. The existing five low server audit nodes remain
documented; no package or image remediation is claimed by these action updates.

Main-push CI will exercise the updated scanner actions, but intentionally will
not run the four publication logins. Local mutation/contract checks do not prove
GitHub analysis accuracy, a registry login/logout or a publication rehearsal.
Record the exact pushed source's own remote checks separately; never substitute
the parent's green run or publish a tag to manufacture that missing evidence.

No PR has been merged, rebased or closed. The delivery recheck confirms all five
remain open and mergeable at their original heads, including selected head
69f898ef61193ebe90a2f25d47977d34e80b257c. UNSTABLE checks do not establish a branch
conflict; no genuinely stale applicable branch needs rebasing. Artifact maintenance
preserves current evidence and recovery assets without file/image removals.
Commit/push stays on main; exact-source remote checks are reported separately.

The next independent CI security recommendation is to assess machine-generated
workflow dependency lockfiles against existing exact workflow validators. That
requires separate onboarding and transitive-dependency checks; this batch retains
the reviewed direct SHA pins and makes no transitive-lockfile claim.
