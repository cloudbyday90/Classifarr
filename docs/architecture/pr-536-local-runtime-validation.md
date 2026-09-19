# PR 536: local server-runtime update

Date: 2026-09-19.

## Selection and design

GitHub MCP returned open PRs 532 and 536. A single Node `crypto.randomInt(2)` draw
over `[532, 536]` selected [PR 536](https://github.com/cloudbyday90/Classifarr/pull/536),
head `65429683e3e46ff97fe8abd0cd64faed4caf1b48`. Applied its two manifest/lockfile
patches locally; no merge, PR comment or release operation was performed.

| Dependency | Before | Applied |
| --- | --- | --- |
| Morgan | 1.12.0 | 1.12.1 |
| Undici (direct) | 8.10.1 | 8.10.2 |
| Zod | 4.5.4 | 4.6.5 |

Upstream release URLs were discovered with GitHub MCP, not constructed as guessed
documentation links. [Morgan 1.12.1](https://github.com/expressjs/morgan/releases/tag/1.12.1)
includes log-field escaping fixes.
[Undici 8.10.2](https://github.com/nodejs/undici/releases/tag/v8.10.2)
addresses transport, interceptor and WebSocket issues.
[Zod 4.6.5](https://github.com/colinhacks/zod/releases/tag/v4.6.5) and the
[4.6 announcement](https://zod.dev/blog/zod-4-6) describe validation additions and
patch corrections. Existing strict schemas and transport cancellation need regression
tests; a minor version label alone is not evidence of compatibility.

## Reconciliation beyond the PR

The PR leaves two explicit Discord dependency overrides at Undici 6.28.0. Updated
both to [6.28.1](https://github.com/nodejs/undici/releases/tag/v6.28.1), whose upstream
notes include WebSocket and retry fixes. Retain the 6.x compatibility boundary;
do not force Discord onto 8.x. The lockfile changes are limited to the three direct
updates and two nested Undici entries. Installation used `--ignore-scripts`.

Benefit: updates both installed transport branches while preserving ESM application
code and dependency-major compatibility. Cost: runtime libraries affect broad paths;
full regression and a clean Compose installation are required. No claim is made
that every upstream advisory is reachable in Classifarr or that this is a complete
repository security audit. The product version remains unchanged.

## Verification and outcome

See the [component outcome](candidate-local-evidence-outcome.md) for final test,
coverage and Compose results. The request-log regression exercises quote/backslash
and control escaping directly. Existing runtime tests cover strict Zod validation,
default values, HTTP success/error handling and cancellation of stalled responses.
PostgreSQL integration protects recovery and backfill behavior with the updated
transport installed. No permissions or release gates are weakened.

Recommend keeping the updates, with rollback through a new manifest/lockfile commit
if a verified compatibility regression appears; never silently restore a vulnerable
override simply to satisfy a version assertion.
