# Policy suggestion application authority outcome

November 23, 2026 Eastern. See the
[design](suggestion-application-authority-design.md) for the caller audit,
research, and tradeoffs.

## Delivered behavior

Both existing Apply endpoints require the administrator role and a valid
actor from the authenticated session. The same input validator admits
positive canonical suggestion IDs through `2147483647`. A missing or
invalid administrator identity returns `403` before the policy writer.
Ordinary authenticated users can still read and reject suggestions.

The primary route retains its nested result and string `suggestionId`.
The feedback alias retains its flat result and numeric `suggestionId`.
Both still use the same transaction for the policy change, suggestion
lifecycle, and audit. The writer still checks policy authority, current
evidence, and pending status under its existing locks.

The client validates IDs before transport. The dashboard identifies when an
administrator needs to act, leaves the suggestion available for review, and
retains the existing handling for CSRF and lifecycle errors. It uses the
existing action controls and session requests.

## Verification

The isolated PostgreSQL lifecycle suite ran both production routers with real
bearer authentication. Tests checked anonymous, ordinary, scoped, and invalid-actor
refusals, input boundaries, response compatibility, and real policy and audit
writes. Repeat application through either alias returned the existing
lifecycle conflict with the saved outcome preserved. The existing writer
suites also cover concurrent reviewers, stale evidence, native policy
authority, and transaction rollback.

The 91 focused server unit tests, 83 isolated PostgreSQL tests, and 41
focused client tests passed. The root, server, and client npm audits
reported zero findings.

The fresh client coverage run passed 7,635 tests in 490 files with 88.00%
statement coverage. The production build, eight production and twenty
standard Chromium tests, and thirteen client configuration checks passed.
The full backend run passed 64,434 tests in 1,957 suites with 89.36%
statement coverage and one skipped test. The coverage ratchet, lint, type
checks, Markdown, ownership, CI preflight, ESM, and policy gates passed.
GitHub listed zero open PRs at intake and during verification.

## Next recommended item

Audit both rejection endpoints and the policy analysis commands. Trace which
ones can dismiss or replace pending suggestions, verify the intended roles
and actor attribution, and preserve the existing authenticated reads.
