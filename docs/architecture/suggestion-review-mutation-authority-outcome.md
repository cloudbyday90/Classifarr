# Suggestion rejection and manual analysis authority outcome

November 23, 2026 Eastern. See the
[design](suggestion-review-mutation-authority-design.md) for the caller audit,
tradeoffs, and official sources.

## Delivered behavior

The two Reject routes and the two manual analysis routes require an
administrator session with an exact actor ID. Rejection and per-policy
analysis also validate the exact target ID before handing work to the
service. Ordinary authenticated users retain their suggestion reads.

Rejection records the authenticated reviewer and the reason in the same
pending-state transaction. The primary route retains its nested string
suggestion ID, and the feedback alias retains its flat numeric suggestion
ID and default reason. Apply shares the same ID and actor validator.

Each accepted manual analysis request submits an `info` event to the
configured logger with the actor ID, scope, and policy ID when applicable.
The event attributes the request. Supersession retains its lifecycle timestamp and
leaves the human reviewer fields empty. The analysis options, per-policy
results, and existing writer transactions are preserved.

The dashboard keeps the existing Reject controls. If the server refuses
the administrator role or actor identity, the dashboard directs the user
to an administrator and keeps the reason dialog open. The client also
checks the exact ID before sending the request.

## Verification

The lifecycle suite used genuine bearer authentication and both production
routers. It verified member reads, refused writes, the stored reviewer, both
rejection formats, cross-alias conflicts, and authorized per-policy and
all-policy analysis. The 94 focused server unit tests checked that log
fields come from the authenticated actor and route, that invalid input
does not start analysis, and that a downstream failure retains the request
event. The 108 isolated PostgreSQL and 63 focused client tests passed.
The root, server, and client npm audits reported zero findings.

The fresh client coverage run passed 7,645 tests in 490 files at 88.00%
statement coverage. The production build, 28 Chromium tests, and 13 client
configuration checks passed. GitHub listed no open pull requests during
verification.

The backend coverage run passed 64,446 tests with one skip and one failure.
The failing ownership test scanned the Git index before the validator rename
was staged. The test and the full preflight passed after staging, with the
ownership manifest and gate preserved. Backend statement coverage was 89.36%.
The coverage ratchet, lint, type checks, Markdown, ESM, and policy gates passed.

## Next recommended item

Assess resource admission for manual analysis. The existing cohort limit is
5,000 rows and 2 MiB per policy. Measure concurrent per-policy and all-policy
requests and assess whether the existing background admission coordinator can
protect shared capacity. Use the observed partial results to decide whether
an operator needs a durable per-policy outcome record.
