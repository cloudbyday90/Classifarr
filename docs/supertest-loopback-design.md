# Supertest loopback refresh: design

Reviewed: 2026-10-03. Scope: backend development/test tooling only.

## Decision

Update Supertest from 7.3.0 to 7.3.1, retaining the existing caret-range
convention and locking the reviewed version. Add a dedicated ESM HTTP lifecycle
contract suite; do not change application listeners, Docker templates or APIs.

## Evidence and tradeoffs

The official [upstream comparison](https://github.com/forwardemail/supertest/compare/a3f5cb85b9aacc16c95987660ffe12f7d2cb2415...3634bddc2471b9cfda66ed4f5701187cee7b7f21),
retrieved through GitHub MCP, changes automatically started servers from a
wildcard bind to `127.0.0.1`. URL construction is deferred until listening.
The [upstream fix](https://github.com/forwardemail/supertest/pull/907) describes
macOS wildcard/loopback port sharing that could send a test to another process.
That macOS-specific failure is not claimed reproduced on Windows.

Node's [network API documentation](https://github.com/nodejs/node/blob/main/doc/api/net.md)
explains that an omitted host binds an unspecified address, and the assigned
ephemeral port is available after the listening event. Our recommendation is
explicit loopback binding and event-based readiness for local HTTP fixtures.

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Adopt upstream 7.3.1 | Confines generated listeners to localhost; avoids reported port-sharing misrouting | Changed asynchronous startup needs lifecycle regression coverage |
| Retain 7.3.0 | No dependency change | Retains wildcard listeners and reported misrouting behavior |
| Wrap every HTTP test server | Direct binding control | Duplicates upstream behavior across many tests and creates maintenance work |

Recommend the upstream patch, not a local fork or broad test rewrite. Registry
metadata confirms unchanged dependencies and Node requirement (`>=14.18.0`), no
install lifecycle script, and compatibility with our pinned Node 24.21.0.
Existing strict installer approvals and security overrides remain unchanged.
This is test isolation, not a claim of a production vulnerability fix.

## Verification plan

- Demonstrate the new loopback/startup checks against 7.3.0 before updating.
- Exercise real HTTP requests through public APIs: Promise and callback usage,
  query encoding, cookie agents, concurrent requests, assertion failure and
  timeout cleanup; preserve caller-owned IPv4/IPv6 listeners.
- Inject an asynchronous startup failure without opening a socket, verifying
  original-error delivery and listener cleanup.
- Review every lockfile difference, clean-install with the existing approval
  policy, check the dependency tree and scan development dependencies too.
- Run all backend suites that import Supertest, plus tooling, lint, scoped
  typechecking and both dependency checks. Do not infer whole-suite, browser or
  live-container results from targeted tests.

No real provider calls, production credentials, database migrations, runtime
deployment or release are required. Existing UI/W3C behavior is unchanged.

## PR selection and next stack

GitHub MCP and the saved GitHub CLI login both returned no open Classifarr PRs
on 2026-10-03. There is no candidate to randomly select; no PR will be merged.
The Supertest fix is an already-merged upstream change, not a substitute open PR.

1. Supertest 7.3.1 and HTTP lifecycle contracts in this batch.
2. Knip 6.38.0 to 6.39.0 separately, checking configuration and detection changes.
3. Keep Node typings on the deployed Node 24 line; review frontend TypeScript 7
   only against Vue tooling support, not simply its newer version number.

Record executed checks and any limits in [the outcome](supertest-loopback-outcome.md).
