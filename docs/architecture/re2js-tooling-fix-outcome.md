# RE2JS tooling dependency fix outcome

Date: 2026-11-02 (America/New_York). Status: implemented and locally verified.
Design: [scope, alternatives and official research](re2js-tooling-fix-design.md).
Implementation base: e30310479f98a984bd446269d6f5ba01226bca23 on main.

## Applied boundary

Root Markdownlint remains exactly 0.42.0. An exact 2.8.7 RE2JS override is scoped
under that parent, intentionally superseding its exact 2.8.6 request. npm explain
reports the overridden 2.8.7 spec and original rawSpec 2.8.6. The actual consumer
and root resolve the same installed artifact; no second affected copy remains
in the complete root tree.

This is dependency remediation. The inspected Markdownlint expressions and
front-matter compilation do not enable LOOKBEHINDS, and Classifarr enables only
MD012/MD047 without custom rules. No exploitable Classifarr path or application
accuracy/security certification is inferred from the package advisory.

Scripts-disabled lock review changed only RE2JS version/URL/integrity and its
Node engine floor from >=18 to >=20. The exact artifact integrity matches registry
metadata. Pinned Node 24.22.1/npm 12.2.1 satisfy that floor. No package was added
or removed, and strict npm ci plus complete npm ls --all passed. Every other
override, lifecycle decision, lint configuration and scanner policy is unchanged.

## Failing-before and passing-after evidence

The existing Markdownlint runner suite now observes actual RE2JS through the
public UTF-16 character-sequence adapter. A boxed string's own charCodeAt counts
reads while delegating to the captured native function. Vendor code and global
prototypes remain untouched. A nonzero-count assertion prevents a bypassed
observer from looking like a fix. Native children have a ten-second deadline,
128-MiB V8 old-space limit and 64-KiB captured-output cap, with no shell.

The frozen 2.8.6 run retained old-version assertions: 14 tests passed and the
intended work-bound test failed. All exact match positions/counts/text and
ordinary-string equivalence checks passed before the work assertion. The patched
run passes the same 64-reads-per-character bound for fixed 256/512-character
inputs and preserves all results.

| Fixed alternating input | RE2JS 2.8.6 reads | RE2JS 2.8.7 reads | Matches |
| --- | --- | --- | --- |
| 256 characters | 98,304 | 2,416 | 128 |

The patched 512-character case records 4,848 reads and 256 correct matches.
The old run's first assertion stopped reporting at 256 characters; no second
old count is inferred for this table.

These are input-read counts for one repeated lookbehind pattern, not elapsed-time
thresholds, total CPU bounds or a universal linearity proof. A separate control
uses the documented resetMatcherInput API for new text. Default lookbehind
rejection, enabled positive/negative matches, repeated find/matchAll/split/replace,
reset, ordinary expressions and Unicode all pass.

All 72 dependency/tooling checks pass, including actual Markdownlint diagnostics,
read-only behavior, and the existing math/MD011 rule compatibility tests. The
independent [server-tooling adoption](server-tooling-pr-578-outcome.md) retains its
own real plugin/CLI verification and changed installation boundary.

## Audit result and recommendation

The full root audit, including development dependencies, changed from two high
affected package nodes to zero findings on November 2. The two earlier nodes
represented one advisory through RE2JS/Markdownlint. The target advisory is absent
from the updated audit; this is a local npm result, not a remote scanner receipt.

Other full audits remain nonzero: server has 29 moderate / three low affected
nodes, client eleven moderate. Their affected nodes are development-only in the
respective locks; no high or critical findings were reported by these audits.
Do not sum propagated nodes as unique vulnerabilities or treat an empty root
audit as a clean-platform claim. The separate existing next-release tooling hold
is not lifted by this batch.

The implementation push at c71f3a7a2 reported four GitHub repository alerts: one
high, two moderate and one low. The subsequent documentation push at 9adeccaec
reported three: two moderate and one low, with no high. These observations are
separate from the three local npm audit scopes above. The connected GitHub MCP
tools expose no alert-details operation; the read-only GitHub API fallback
returned HTTP 401. Individual package/manifest identities remain unverified.
Do not attribute the summary change to a particular finding, a known hold or an
assumed scanner delay. Reconcile remaining repository alerts through an
authenticated source in a separate security batch; the existing release hold
is not lifted by a push summary.

Final recommendation: keep the small scoped upstream patch, exact installs and
real-library controls. The tradeoff is deliberately superseding the parent's
exact pin and maintaining compatibility evidence until an assessed Markdownlint
release permits retiring the override. Waiting leaves the installed finding;
downgrading Markdownlint would discard newer parser/lint behavior. The
[design](re2js-tooling-fix-design.md) records the complete alternatives and limited
application of W3C security/privacy review guidance.

Next application item: fence automatic capture checkpoint writes with the
existing acknowledged revision/UUID claim, then separately scope advance and
publication while preserving manual cache authority and retention. Assess the
remaining moderate/low tooling chains in a separate dependency batch without
relaxing overrides or accepting an unsupported automatic downgrade.

## Coverage and delivery

| Check | Observed result |
| --- | --- |
| Dependency/tooling suite | 72/72 passed; no skips |
| Focused actual server plugin/Knip contracts | Three suites / 21 tests passed |
| Fresh full backend unit coverage | 1,920 suites; 62,201 passed, one existing skip; 815.87 seconds |
| Backend coverage S/B/F/L | 89.23 / 86.65 / 90.79 / 89.23 percent |
| Fresh client coverage | 483 files / 7,505 passed; 228.57 seconds |
| Client coverage S/B/F/L | 87.90 / 82.04 / 87.69 / 89.58 percent |
| Coverage ratchet | Passed; baseline unchanged |
| Lint/types, both Knip gates and existing source/ownership quality gates | Passed |

Neither coverage result is reused. Client manifests, installed lock/tree and
tracked source remain unchanged. Its actual ratchet artifact is
client/coverage/index.html; an initial check for an unconfigured JSON summary did
not establish missing coverage. The fresh report and backend summary have private
hash receipts. No client bundler or application transport change is part of this
batch, and no database/image rehearsal is claimed.

Artifact maintenance reused the recent verified filesystem inventory and six
changed-directory / 3,541 unreviewed-root-file exclusions. Fresh desktop-linux
daemon/all-container/image reads show the same three containers and 425 image-tag
rows. Classifarr's identity, image, start time and healthy state are unchanged.
Only Docker's displayed relative CreatedSince ages changed; stable IDs, tags,
creation times and other image metadata agree. No files/images were removed.
Current evidence, recovery assets, worktrees, shared cache/volumes and other
projects stay protected.

Separate design/outcomes, relevant historical follow-ups and Unreleased notes
are updated. The PRs remain unmerged; fresh mergeable branches require no rebase.
Work stays on main with no release, deployment, service restart, schema, new UI,
job, operator CLI trigger, provider call, routing or learning change. Private
baseline, install, audit, counter and maintenance receipts remain under .tmp.

The subsequent [client tooling outcome](client-tooling-pr-579-outcome.md) records
partial adoption of PR 579 and a separate compiler deferral. The
[checkpoint fence outcome](capture-checkpoint-fence-outcome.md) completes the
three existing automatic checkpoint transactions; same-revision advance remains
the next application ownership item. Existing audit and npm release holds remain
visible in their respective outcomes.
