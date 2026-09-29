# Root Markdown dependency remediation design

Research and decision date: September 29, 2026.

## Scope and root cause

Dependabot alert 113 / GHSA-253c-mchw-3w2r affects the root development dependency
`markdown-it` 14.3.0. With automatic link conversion enabled, repeated email text
tokens cause repeated reconstruction of the paragraph's token array. Repeated
unregistered URL schemes separately cause scans of an ever-growing text prefix.
Both paths can consume quadratic CPU work.

The only open PR returned by GitHub MCP at selection time was
[PR #554](https://github.com/cloudbyday90/Classifarr/pull/554), head
`00870fd9ef03893f9dc14265b5f135aa4ea4a627`. A selection from that one-item pool
necessarily selects #554. Implement its root override/lockfile upgrade to 14.3.2
locally, add verification, and do not merge the PR.

Investigation also reproduced an existing ESM import failure: the root override
forces `linkify-it` 6.1.0, which has named exports and lacks the `pretest` method
expected by Markdown 14.x. The PR alone cannot repair that incompatibility.
Remove this incompatible override and let Markdown's declared `^5.0.2` range
resolve the compatible, security-patched 5.0.2. Do not introduce import shims,
CommonJS fallbacks or modifications to dependency source.

The client and server have no `markdown-it` copies. Docker installs those separate
trees, not root development tooling. The configured Markdown checks use micromark
or no parser; `markdown-it` is created lazily for relevant custom rules. The CLI
factory does not enable linkification by default. Therefore this is a vulnerable
optional dependency path and broken import contract, not established production
HTTP exploitability or evidence that ordinary documentation lint was hanging.

## Official research and applicability

- The [upstream advisory](https://github.com/advisories/GHSA-253c-mchw-3w2r)
  identifies fixes in 14.3.1 and 15.0.1. The
  [14.x backport](https://github.com/markdown-it/markdown-it/commit/ad70f6b7cff64bee10e42a774147112480ca0d49)
  batches token replacements and bounds the inline scheme backscan.
- The [14.3.2 changelog](https://github.com/markdown-it/markdown-it/blob/14.3.2/CHANGELOG.md)
  also includes the subsequent smart-quote security backport. Its
  [source](https://raw.githubusercontent.com/markdown-it/markdown-it/14.3.2/lib/index.mjs)
  still requires the default linkifier export. npm registry metadata confirms
  `linkify-it: ^5.0.2` and the PR's package integrity.
- The official linkifier advisories identify fixed releases:
  [scan-loop issue: 5.0.1](https://github.com/markdown-it/linkify-it/security/advisories/GHSA-22p9-wv53-3rq4)
  and [mailto validator issue: 5.0.2](https://github.com/markdown-it/linkify-it/security/advisories/GHSA-v245-v573-v5vm).
  The July repository note's claim that the entire declared 5.x range was
  unpatched is incorrect. Correct that guidance rather than preserving a broken
  major-version override. Recheck the final installed graph and audit results.
- npm describes [root override behavior](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/)
  and [clean lockfile installs](https://docs.npmjs.com/cli/v12/commands/npm-ci/).
  Validate actual installed imports and consumers, not only a version number.
- [W3C link-purpose guidance](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only)
  informs compatibility checks for preserved descriptive link text. This patch
  changes no web UI and makes no new WCAG conformance claim. Keep existing link
  labels, hrefs, code spans and nesting behavior intact; do not disable links as
  a security workaround.

Sources were discovered through GitHub MCP, official search, upstream references
and registry metadata. No guessed advisory or release URLs were used.

## Options and recommendation stack

| Option | Advantages | Costs / limits | Decision |
| --- | --- | --- | --- |
| PR #554's 14.3.2 plus removal of incompatible linkifier override | Fixes both reported algorithms; restores supported ESM dependency pairing; preserves parser major version | Root parser override still needs periodic compatibility review | Selected |
| Apply only the PR | Smallest version diff | Leaves ESM import and linkifier API broken | Incomplete |
| Move to Markdown 15.x | Aligns with the linter's declared parser major | More dependency and public/internal API changes than necessary for this fix | Separate future compatibility decision |
| Disable link conversion or add a parser wrapper | Can avoid one entry path | Changes legitimate behavior; does not fix the dependency | Reject |

Final stack: native ESM, upstream 14.3.2 backport, declared compatible linkifier,
committed npm lockfile, bounded `node:test` regressions and the existing root
dependency CI gate. No new production service, broker, schema or container change.

## Verification design

1. Retain evidence of the original ESM import failure. After correcting only the
   linkifier pairing, reproduce the two algorithmic defects on Markdown 14.3.0.
   This separates the pre-existing import failure from the CPU-work defect.
2. Use small inputs and local per-instance observers, not global prototype edits
   or multi-second attack payloads. Count token-array reconstruction and characters
   submitted to the old prefix regex. Assert the relevant paths execute and
   output is preserved. These counters cover the reported mechanisms, not a
   universal linear-time guarantee.
3. Apply the parser upgrade, clean-install, then rerun the same cases and controls:
   HTTPS/email links, explicit descriptive links, code spans, HTML links, disabled
   linkification, malformed/dangerous destinations and normal smart quotes.
4. Exercise a real markdownlint custom rule with an asserted factory invocation;
   built-in documentation checks alone do not instantiate this parser.
5. Run both root dependency suites, documentation lint, root static checks and
   dependency audits. Verify no production dependency changes and no unrelated
   lockfile churn. Obtain independent read-only candidate review.
6. Record exact results in the separate [outcome](root-markdown-dependency-outcome.md),
   update Unreleased and commit/push without merging or publishing a release.

## Next application component

After these dependency fixes, return to the visual retry-readiness summary:
ready, waiting, disabled/rejected and future-due counts with a next check time and
one relevant action. Use bounded aggregate reads and existing polling, without
spending provider credits or changing ownership and routing controls.
