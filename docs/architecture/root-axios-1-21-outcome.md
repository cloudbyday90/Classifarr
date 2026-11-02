# Root Axios 1.21 local adoption outcome

Date: 2026-11-02 (America/New_York). Status: implemented and locally verified.
Design: [random selection, alternatives and official research](root-axios-1-21-design.md).

## Applied change

The uniform random selection from the three open PRs chose
[PR 574](https://github.com/cloudbyday90/Classifarr/pull/574), reviewed at immutable
head 83da9e8766c19c3d310870c530563a45ee49e99f. Its root Axios 1.20.0 to 1.21.0
update is adopted locally on main with an exact 1.21.0 direct pin. Client already
pins that version. This implementation does not merge the provider PR.

Lock review separates the Axios artifact version/URL/integrity and direct pin
from the approved [coupled redirect security patch](redirect-cross-realm-fix-outcome.md).
No other transitive package changed, and no package was added or removed.
Registry integrity matches the lock. Published Axios dependencies are unchanged;
no new peer/engine constraint or install-script flag is introduced. Strict install
decisions, other overrides, application credentials/authentication refresh and
no-replay behavior remain unchanged.

## Verification and limits

The existing suite now executes actual independently installed Axios Node HTTP
adapters for root/client. GET requests complete across loopback redirects while
preserving ordinary headers and stripping built-in credentials. A separate JSON
POST verifies method, content type, encoded body and parsed response. Redirect
limits and direct-library foreign-array tests retain distinct assertions; the
Axios controls are not a reproduction of an application credential leak.

Root consumers use ordinary configuration maps in developer inspection/simulation
scripts. Those scripts were not executed against the user's network. No optional
Basic-auth encoding or response-timing feature is enabled. Fresh client tests
cover the existing centralized transport, explicit CSRF/credentials, auth refresh,
cancellation and protected-command no-replay semantics without application edits.

Pinned clean installs, complete dependency trees, 69 dependency/tooling checks,
root/server/client lint/typecheck, fresh client coverage (7,505 tests), production
build/eight browser checks and the coverage ratchet passed. Backend source and
installed-tree equality justify reusing its existing report. Exact counts,
coverage, remaining audits and artifact maintenance are recorded in the separate
[redirect outcome](redirect-cross-realm-fix-outcome.md).

Both complete audits retain findings: root has two high developer-chain nodes
through RE2JS/Markdownlint, client eleven moderate tooling nodes. Neither updated
Axios nor follow-redirects is an affected node. No clean-platform or remote-CI
security claim is made.

## PR maintenance and recommendation

The GitHub MCP pre-commit delivery recheck returned the same open PRs 574, 576
and 578, all created November 2 and mergeable at their original reviewed heads.
None is genuinely stale at this checkpoint. Being behind independent main
commits is insufficient reason to rewrite a branch; none was rebased or merged.
The selected Axios change has been incorporated locally; retaining a floating
range from the provider PR would contradict the repository's exact-pin policy.

The final recommendation is exact upstream adoption with reviewed locks and
real HTTP controls. It aligns root/client versions at the cost of maintaining
separate install evidence. A new transport abstraction or a mixed update of the
two unrelated tooling PRs would add scope without improving this verification.
Keep RE2JS/Markdownlint assessment next, then resume the separately documented
capture checkpoint/advance/publication fence.

Unreleased notes and separate design/outcome records are updated. Work remains
on main, without release, deployment, service restart or new operator workflow.
