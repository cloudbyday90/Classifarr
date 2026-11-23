# Server Undici PR 596 assessment outcome

November 23, 2026 Eastern. See the
[design](server-undici-pr-596-design.md) for candidate releases and tradeoffs.

## Dependency graph

Adopted exact 8.13.1 for standalone server Undici and its shared Testcontainers
resolution. The server lock changes only the root declaration and
the matching Undici entry. The registry integrity matched the generated lock.
Both Discord-owned copies remain on 6.29.1, and the client JSDOM copy remains
on 8.12.4. Node's bundled transport and application dispatcher configuration
keep their existing versions and behavior.

## Verification

- The pinned Node 24.22.3 and npm 12.2.2 completed a strict clean server
  install. The full dependency tree resolved and the development-inclusive
  npm audits for the root, server and client reported zero vulnerabilities
  at evaluation time.
- The 111 focused backend tests covered the supported redirect/cache order,
  refusal of the reverse order on the new version, normal redirect headers,
  request cancellation, and existing TLS and transport behavior. The shared
  fixture keeps both existing composition controls on the client version.
  All 7,613 client tests passed, including the installed JSDOM transport.
- Fresh backend coverage and the coverage ratchet passed. The full preflight
  and dependency tooling checks passed, with the Linux-only WASI control
  skipped on Windows.
  [Combined test results](pending-web-bigint-readiness-outcome.md)
- PR 596 was the sole open PR. The same head was zero commits behind main
  at intake and before publication of the local work. It proposes 8.13.0;
  the approved local assessment used the publisher's 8.13.1 follow-up.
  [Selected PR](https://github.com/cloudbyday90/Classifarr/pull/596)
