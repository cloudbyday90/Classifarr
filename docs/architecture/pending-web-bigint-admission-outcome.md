# Exact BIGINT admission for web pending answers outcome

November 23, 2026 Eastern. See the
[design](pending-web-bigint-admission-design.md) for sources and tradeoffs.

## Implementation

The authenticated admin pending list can emit a question contract for any
canonical positive BIGINT History ID. The existing resolve endpoint passes
an explicit typed-answer admission option to the shared resolver. The
option comes from the route and cannot be supplied in the answer payload.
Discord and default service callers still use safe-integer admission, as
does cleanup through its own path. Destination IDs and authority retain
their existing rules.

Single answers and Confirm All use the same request and keep exact decimal
path segments. Responses retain safe IDs as numbers and carry larger IDs
as decimal strings. The existing row lock, fingerprint, receipt and
learning checks still govern execution and replay.

## Verification

- The 34 scoped PostgreSQL tests passed. The real pending list returned
  the safe maximum, adjacent large IDs and the BIGINT maximum with exact
  bindings. Fingerprints copied from neighboring rows failed before any
  mutation. Concurrent submissions produced one routing call and one
  learning receipt per target. Larger unbound or foreign receipts were
  refused. An unbound safe-ID receipt retained its existing replay.
- The native question test used the saved contract from the list, recorded
  the native routing event and exact answer together, and replayed without
  a second route call. Astra identified this case during the diff review.
- All 208 focused backend tests and 11 Chromium tests passed. Chromium
  covered the BIGINT maximum in a single answer and distinct adjacent IDs
  in Confirm All. Routing tests use a local stand-in for the provider.
- The 92 authentication and API key permission tests passed. The root,
  server, and client npm audits reported zero vulnerabilities at check time.
- Fresh coverage passed 64,307 backend tests across 1,957 suites with one
  skip, and 7,613 client tests across 490 suites. The coverage ratchet,
  production build, lint, type checks, preflight, and policy gates passed.
- Dependabot closed the superseded Undici PR without merging it after
  8.13.1 reached `main`. There were no eligible PRs to adopt or rebase.
  [PR 596](https://github.com/cloudbyday90/Classifarr/pull/596),
  [Dependabot run](https://github.com/cloudbyday90/Classifarr/actions/runs/45165230012)

## Next recommended item

Qualify exact History IDs in both Discord pending-answer formats and test
generated component IDs against Discord's 100-character limit. Keep cleanup's
sort order and its separate apply/replay boundary as a later change.
[Discord component reference](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx#custom-id)
