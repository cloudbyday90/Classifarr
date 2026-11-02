# Client tooling PR 579 partial local adoption outcome

Date: 2026-11-02 (America/New_York). Status: assessed subset implemented and verified.
Design: [assessed client subset](client-tooling-pr-579-design.md).

## Applied subset and preserved compiler authority

Random selection from the two open PRs chose
[PR 579](https://github.com/cloudbyday90/Classifarr/pull/579), reviewed at head
5ac143c539229f51ef0fe4f15de2d2519e796620. Locally adopt exact client ESLint
10.14.0, eslint-plugin-vue 10.12.0 and PostCSS 8.5.32. Keep vue-tsc 3.3.13,
TypeScript 6.0.3 and their entire compiler graph unchanged. This is partial
adoption; the provider PR stays unmerged. Server PR 580 is independent.

The lock was generated with scripts disabled and reviewed before the strict
clean install. Exactly four package records changed: root development
declarations and the three approved package artifacts. No package was added or
removed, no compiler record changed and no install-script permission changed.
Published engine/peer metadata is compatible with Node 24.22.1 and the installed
tree. ESLint's jiti peer and the Vue plugin's stylistic/TypeScript-parser peers
are optional; the installed Vue parser satisfies the required peer. Root/server
manifests, locks and installed trees remain unchanged.

The existing npm ci policy passed with 295 packages installed. All three full
package trees are valid. Overrides, lint rules/severities, both typecheck scopes,
application transport/auth/retry behavior and strict install policy are unchanged.

## Real-tooling regression and audit

Before updating, actual installed tools failed three added controls: PostCSS
finally did not preserve the successful result or original plugin rejection,
and the Vue lint rule missed a defineModel/prop collision. Those same controls
now pass with legitimate distinct-model and existing CSS/lint/type controls.
The focused five-file real-tooling run passes all 67 tests. Both application
typecheck scopes and root lint pass. The dependency/tooling suite passes 72/72
tests without skips; both server Knip gates and the existing source/policy
checks also pass.

Full audits include development dependencies. Root has zero findings; server
has 29 moderate / three low affected nodes; client has eleven moderate nodes.
Neither has high or critical findings. Both runtime-only audits are clear.
Client advisory identities/details and counts are unchanged from intake: the
glob/minimatch tooling chains remain, rather than being hidden by this update.
These are affected npm nodes, not counts of unique platform alerts or proof of
an exploitable application path. No scanner suppression was added.

## npm bundled parser and next dependency batches

The requested [npm/ip-address recheck](dependency-readiness-2026-10-outcome.md#november-2-npm-bundled-parser-recheck)
found standalone ip-address 10.7.5 published and a pending npm 12.2.2 release
containing it. Installed npm 12.2.1 still bundles 10.7.2; the exact 12.2.2 registry
lookup returned E404. Classifarr's server override/installed parser remains
10.7.4, the advisory fix. No npm upgrade, source-branch install or bundled-file
patch was made; the existing release hold remains until a published archive,
integrity, bundled parser and local/CI/container install checks are verified.

The subsequent [compiler assessment](client-compiler-pr-581-outcome.md) adds the
bounded actual-CLI template and unrelated semantic-error controls. It reproduces
five candidate compiler regressions on synthetic fixtures and retains 3.3.13;
the ordinary project typechecks pass on both versions. This does not establish
a failure in shipped application source. Preserve the semantic guards, exact
negative diagnostics and existing scopes for a later coherent compiler update.

Final recommendation: retain the verified exact three-package subset, preserve
compiler authority, address existing advisory/toolchain follow-ups separately,
and upgrade npm only after publication and verification. This adopts assessed
lint/CSS fixes at the cost of leaving the selected provider PR partly unapplied.
The subsequent [advance outcome](capture-advance-fence-outcome.md) completes that
ownership follow-up and identifies the separate retention-maintenance investigation.

## Final coverage and delivery

Fresh client coverage passes 483 files / 7,508 tests in 277.51 seconds. Coverage
is 87.90% statements, 82.04% branches, 87.69% functions and 89.58% lines. The
production Vite build and all eight Chromium asset/navigation checks pass. Both
client coverage and build were regenerated with the installed candidate tree;
no earlier client receipt is reused. Fresh backend coverage passes 1,922 suites /
62,274 tests with one existing skip in 782.118 seconds; its coverage S/B/F/L is
89.24 / 86.64 / 90.79 / 89.24 percent. The joint coverage ratchet passes with both
fresh reports and no baseline changes. Final lint/types, source/policy/ownership,
Markdown, staged secret and whitespace checks pass.

GitHub MCP rechecks find PRs 579 and 580 open, unmerged and mergeable at their
reviewed heads. Both were created on November 2; no genuinely stale applicable
branch needs rebasing. No provider branch was rewritten or PR merged.

Scoped artifact maintenance retains the recent verified filesystem inventory
and six changed-directory / 3,541 unreviewed-root-file exclusions. The same
desktop-linux daemon has three unchanged containers and 425 image-tag rows,
with stable image metadata and unchanged healthy Classifarr identity/image/
start time. An initial after-read added --all/--digests and was incomparable;
repeating the baseline command confirms no growth. Relative displayed ages are
excluded from comparison. No files/images were removed, and current evidence,
backups, rollback/reference assets, worktrees, shared cache/volumes and other
projects remain protected.

Separate design/outcomes and Unreleased notes record the assessed subset. Work
remains on main with no release, deployment, PR merge, new UI or operator CLI
trigger. Private lock, install, regression, audit and maintenance receipts stay
under .tmp.
