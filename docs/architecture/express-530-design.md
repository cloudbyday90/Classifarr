# Express 5.3 runtime compatibility — design

## Scope and baseline

Reviewed on 2026-10-11. Upgrade only server Express 5.2.1 to 5.3.0, retaining
the existing manifest range style and an exact lockfile resolution. Node 24.21.0,
npm 12.2.0, application versions, security overrides and lifecycle-script policy
stay unchanged. This is not a release, production deployment or catalog approval.

Express is the next separately deferred runtime update in the
[candidate-lookup outcome](source-candidate-lookup-outcome.md). The existing
body-parser, proxy-addr and qs overrides already enforce updated versions; an
outdated Express parent alone does not establish a currently vulnerable install.

## Research and contract

Official sources discovered and retrieved through connected search/GitHub tools:

- [Express 5.3.0 release](https://github.com/expressjs/express/releases/tag/v5.3.0):
  response framing, MIME parameters, download headers and error logging change.
- [Express security guidance](https://github.com/expressjs/expressjs.com/blob/main/src/content/pages/en/advanced/best-practice-security.mdx):
  preserve input validation, secure headers/cookies and dependency maintenance.
- [Express reliability guidance](https://expressjs.com/en/advanced/best-practice-performance/):
  propagate asynchronous errors through the application error middleware.

The registry package requires Node >=18 and has no install lifecycle hook.
Review exact new transitive packages and their integrity/engine/script metadata
before a policy-controlled install. Do not broaden allowed scripts or remove
security overrides to make the install succeed.

The resolved transitive batch is content-disposition 2.0.1 and content-type
2.1.0; the latter replaces the older root copy and deduplicates two nested 2.0.0
copies. [content-type 2.1.0](https://github.com/jshttp/content-type/releases/tag/v2.1.0)
adds optional comma parsing; its
[2.0 rewrite](https://github.com/jshttp/content-type/releases/tag/v2.0.0) makes
parsing lenient, so parser success alone is not input validation.
[content-disposition's releases](https://github.com/jshttp/content-disposition/releases)
document new named exports, filename handling and extended-parameter fixes.
Classifarr's backup download already validates a basename and passes it explicitly
to Express. Keep that boundary; do not override the parent to content-disposition 3.
Both packages have development `prepare` scripts, but no registry-dependency
install hooks; no new installer permission is needed.

Add real HTTP regression tests before updating. A chunked `res.send()` must not
also emit Content-Length, and must retain its validator. Confirm HEAD and
conditional/bodyless responses, parameterized content types and ASCII/Unicode
download names. Use semantic download assertions, not one permitted quoting style.
Run existing application middleware, parser, CSRF/CORS, API 404, static delivery,
rate-limit, backup and production-error checks. No new HTTP wrapper or singleton
is necessary. New test code is ESM.

## Separate randomly selected PR

Random selection from the current two open PRs chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Trial its exact client manifest/lock
changes independently: Node declarations 24.19.2 to 26.6.4 and Undici declarations
7.24.6 to 8.9.0. Do not substitute the newer 26.6.5 registry version. Run install,
tree, audit, client typecheck and Node-major alignment checks. Restore the exact
baseline if incompatible; no PR merge, runtime-major change or weakened guard.

## Alternatives and recommendation stack

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| Retain 5.2.1 plus overrides | No new response behavior | Leaves upstream framing fix and maintenance behind |
| Adopt tested 5.3.0 | Correct framing and current supported minor | MIME/download/default-logger behavior needs regression evidence |
| Bundle all available tooling updates | Fewer install sessions | Obscures runtime versus compiler/tooling regressions |

Recommend the bounded Express update after checks, keeping current security
controls; retain Node 24-aligned declarations unless the separate trial proves
compatible. Defer Knip and client toolchain updates to separate batches.

Fresh identity investigation remains independent: complete episode membership
supports a proposed mapping, not automatic approval. Preserve source grouping,
require every season and repeat fresh evidence at explicit approval. Neither
the dependency update nor restart may silently clear unresolved IDs.

## Acceptance and rollback

Focused tests precede full backend checks. Validate lint, typechecks, dependency
analysis, tooling policy and audits without changing baselines. Build local Compose
with no cache from a clean runtime commit, retain a verified local database backup
and old image, replace only the local test service, check health and immutable
image identity, then dump schema from a disposable isolated database. Record
failures, retests, exact source/image and untouched production scope separately in
the outcome. Reverting the dependency commit and reinstalling its lockfile is the
code rollback; no schema migration or data rewrite is planned.
