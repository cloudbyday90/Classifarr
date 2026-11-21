# Server ESLint PR 594 assessment outcome

November 21, 2026 Eastern. Local assessment of [PR #594](https://github.com/cloudbyday90/Classifarr/pull/594)
and the [approved design](server-eslint-pr-594-design.md).

The server uses ESLint 10.15.0, config-array 0.23.6 and exact minimatch 11.0.9.
The lock also updates minimatch's nonrecursive matcher from 1.0.3 to 1.1.0.
These were the four changed development packages. The resolved integrity
values match registry metadata. The strict npm 12.2.2 install and full
server package-tree check passed. Root, server and client full npm audits
reported zero findings in their checked graphs on November 21.
The reviewed OSV Scanner 2.7.1 image also scanned all three lockfiles with the
existing configuration and reported no issues. It reported the known
deprecated `ignoreUntil` field and unused withdrawn-advisory entry.

Minimatch 11.0.9 raises a `RangeError` when level-two `**/..` optimization
would exceed the caller's expansion budget. The original server test
expected the earlier partial result. It now requires the exact documented
refusal in both module formats. Separate tests require exact successful
matches at the same admitted and higher budgets. The client still uses
11.0.4 and retains its original bounded-match expectation. Both trees keep
their legitimate glob and cancellation controls. [Pinned minimatch source](https://github.com/isaacs/minimatch/blob/e89926755f3f79cf79f1087bd5730ed4d7eba60e/src/index.ts)

Real ESLint checks covered config selection, a coverage-directory ignore,
production security severity, the focused-test prohibition and the revised
`default-case` location. The full ownership inventories on identical source
matched except for the reported ESLint version. The comparison included 3,545
scanned files, all candidates, evidence bindings and the source fingerprint.
Only the parser version field changed in the ownership review manifest.
The ownership gate and 124 dependency tooling checks passed. One existing
WASI control was skipped on Windows.

The root and client manifests, installed trees and prior client coverage
report hashes matched intake. The replay refactor and tooling changes are
server-side. Both open Dependabot heads passed the merge-tree check on `main`.
The maintenance change was adopted locally with the PR branch untouched.

## Next recommended item

Qualify the client minimatch update separately against its installed
editorconfig, ESLint and glob consumers, then run the full client gates. Keep
the observed server exhaustion behavior explicit when testing that tree.
