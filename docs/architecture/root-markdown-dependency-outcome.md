# Root Markdown dependency remediation outcome

Date: September 29, 2026. Scope: GHSA-253c-mchw-3w2r / Dependabot alert 113.
See the separate [design, research and tradeoffs](root-markdown-dependency-design.md).

Outcome: **fixed** for the reported linkification work paths and the associated
ESM dependency compatibility failure.

## Delivered change

Implemented [PR #554](https://github.com/cloudbyday90/Classifarr/pull/554)'s
`markdown-it` 14.3.2 upgrade locally without merging the PR. The only open PR at
selection time was #554, so the selection pool contained one candidate.

Also removed the incompatible root `linkify-it` 6.1.0 override. Markdown 14.x
declares `^5.0.2`; the lockfile now resolves compatible, security-patched 5.0.2.
The old override prevented the ESM parser from importing and lacked its required
`pretest` API. An import shim or only applying the PR would leave that contract
broken. The July remediation document now corrects its inaccurate 5.x guidance.

The lockfile changes only the parser, its linkifier and the no-longer-needed
linkifier-specific `uc.micro` 3.x copy. The shared 2.1.0 copy remains unchanged.
New native-ESM tests and a test-only observer run through the existing root
dependency CI command. Unreleased records the high-level change.

No application services, client/server dependencies, schemas, routing, ownership,
library data or provider settings changed. No version bump, release or container
deployment is included.

## Local verification

Environment: Node 24.18.1, npm 12.0.2, Windows PowerShell.

| Gate | Command / evidence | Result |
| --- | --- | --- |
| Original dependency graph | `node --test scripts/__tests__/markdown-linkify-security.test.mjs` | Fails to import: linkifier 6.1.0 has no expected default export |
| Isolated algorithmic reproduction | Same command with only the linkifier pairing corrected; parser still 14.3.0 | Eight CPU-work assertions fail; six import/rendering controls pass |
| Syntax / patch | `node --check` on both new `.mjs` files; `git diff --check` | Passed |
| Reproducible install | `npm install --package-lock-only --ignore-scripts`; `npm ci` | Passed |
| Patched security and controls | `npm run test:tooling:dependencies` | 32 passed: 14 Markdown tests and 18 existing YAML tests |
| Installed graph | `npm ls markdown-it linkify-it --all`; semantic lockfile comparison | One parser at 14.3.2, its linkifier at 5.0.2; no unrelated lock changes |
| Documentation lint | `npm run lint:docs` | Passed across 1,660 Markdown files, including both new documents |
| Root static checks | `npm run check-copyright`; `npm run lint:npm-cli-flags` | Passed; 1,395 copyright-covered files checked |
| Dependency audits | `npm audit --json`; `npm --prefix server audit --package-lock-only --json`; equivalent client command | All three report zero known vulnerabilities |

The original CPU-work mechanisms no longer reproduce under the same bounded
inputs. For 32 email lines, repeated array reconstruction falls from 32 writes
and 3,072 copied tokens to one write and 127 tokens. Prose-plus-email variants
also pass. Repeated unregistered schemes no longer submit a growing prefix to
the regex; both alternate scheme forms retain their original rendered text.
These counters exercise the reported algorithms, not a universal complexity
proof or a wall-clock performance benchmark.

Legitimate behavior remains intact: descriptive links, HTTPS and email autolinks,
code spans, existing HTML links, disabled linkification, dangerous-destination
rejection, default HTML escaping and ordinary smart quotes all pass. A real
markdownlint custom rule asserts that its factory creates and consumes the ESM
parser; default documentation rules alone would not exercise the lazy parser.

Independent read-only investigation and candidate review found no concrete
surviving bypass or compatibility regression. The reviewer independently ran
the 14 Markdown tests and checked CRLF, hard breaks, emphasis, multiple
paragraphs, escaped/entity colons, explicit links and angle autolinks. The review
also confirmed the bounded upstream algorithms and existing CI invocation.

The separate before/import, before/algorithm and after test outputs are retained
in the local Codex Security artifact store, outside the repository. The committed
regressions are the reproducible evidence for future installs.

## Limits and next step

This is root development tooling, not a demonstrated production HTTP exploit.
The affected optional linkification mode is off by default. Client/server suites,
runtime builds and Docker rebuilds are not repeated because their dependency
trees and source are unchanged, and the Dockerfile does not install root tooling.
Audit results describe known advisories at verification time, not a comprehensive
security guarantee. Hosted CI is separate from the local checks recorded here.

Next application component: an actionable retry-readiness summary showing ready,
waiting, disabled/rejected and future-due counts, the next check time and one
relevant action. Use bounded aggregate reads and existing polling. Do not spend
provider credits, bypass ingestion ownership safeguards or enable disabled
providers to produce a reassuring dashboard.
