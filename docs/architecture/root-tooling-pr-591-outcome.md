# Root tooling PR 591 assessment outcome

November 21, 2026 Eastern. Results of the approved
[root tooling assessment](root-tooling-pr-591-design.md).

- Adopted the selected PR's root Axios **1.21.1** and kept the
  follow-redirects **1.16.2** override. That transport dependency was already
  present in the baseline tree.
- Compared Markdownlint **0.42.1** and **0.42.2** with its declared RE2JS
  **2.9.1**. Both detected the expected ordinary MD042, MD052 and MD054
  cases. Only 0.42.2 preserved the requested MD054 diagnostic and warning
  severity when the rule options had a null prototype. Adopted 0.42.2 and
  retired the narrow RE2JS 2.8.7 override. The runner configuration and lint
  decision policy remain in force.
- Reviewed all changed lockfile entries. Aside from the root entry, the three
  version changes are Axios, Markdownlint and RE2JS. Strict installs resolved
  a single Markdownlint-owned RE2JS copy. The client and server dependency
  graphs were outside this batch's changes.
- The full tooling suite passed 120 tests with one existing Linux WASI case
  skipped on Windows. It exercised actual Axios transport, Markdownlint and
  RE2JS. The root candidate audits and final root, server and client audits
  reported zero findings, including development dependencies. Markdown lint
  checked all 2,573 documents without errors.

The selected PR was assessed locally without merging its branch. Using the
newer Markdownlint patch diverged from its proposal and preserved the intended
rule behavior. This required reviewing the replacement lock and testing the rule
configuration directly. [Dependabot PR #591](https://github.com/cloudbyday90/Classifarr/pull/591)
