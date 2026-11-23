# Retire legacy HTTP clarification submissions outcome

November 23, 2026 Eastern. See the [design](legacy-http-clarification-retirement-design.md)
for the caller audit, alternatives, and standards.

## Delivered behavior

`POST /api/clarifications/:id/respond` returns `410 Gone` after the existing
middleware admits the request. It uses the application JSON error envelope,
`clarification_response_retired`, `Cache-Control: no-store`, and directions
to the Classifarr Command Center. All accepted request shapes receive the same
retirement response. The handler neither loads the item nor runs a domain
operation. The exclusive response writer and its service delegate were
removed.

Question and settings routes, historical response reads, schema, and the
current pending-decision workflow are preserved. External clients using the
old POST must stop submitting there. The current workflow requires fetching
its pending-answer contract and sending that contract's own payload. See the
[API guide](../api/classification.md#retired-legacy-clarification-submissions).

## Verification

The router tests assert a fixed status, error, cache header, and absence of a
redirect or domain lookup. Isolated PostgreSQL tests assert authentication
runs first and repeated requests leave a stored response and the complete
History row intact. They also exercise the actual pending-resolution route
and active Discord paths. All 521 focused tests and 63 integration tests
passed. Root, server, and client npm audits reported zero findings.

The full backend run passed 64,419 tests across 1,957 suites. Statement and
line coverage reached 89.36%, and branch coverage reached 86.87%. The coverage
ratchet passed with the prior client report after verification of its inputs
and checksums. Lint, type checks, CI preflight, import and mock checks, policy
gates, and Markdown passed. Local checks skipped one Linux-only filesystem case
and two symlink cases on Windows. GitHub listed no open PRs for local adoption
or Dependabot rebasing.

## Next recommended item

Audit `POST /api/prompts/:id/respond` separately. Identify external and
bundled callers, qualify exact item admission, and review whether the legacy
pattern and feedback writes still have a supported owner. Its existing
transaction, receipt, and policy checks warrant an independent compatibility
decision. The Command Center's pending-answer route uses a different contract.
