# Manual suggestion analysis admission outcome

November 23, 2026 Eastern. See the
[design](manual-suggestion-analysis-admission-design.md) for the baseline
measurement, tradeoffs, and verified sources.

## Delivered behavior

The per-policy and all-policy manual analysis routes share one slot in each
API process. The route checks the administrator and validates inputs before
attempting admission. A valid overlapping request receives a non-cacheable
`503` with code `SUGGESTION_ANALYSIS_BUSY`. The refused request starts no
analysis and emits no accepted-request log. An operator can submit a new
request after the current analysis finishes.

The slot stays held through the service call and preparation of the HTTP
response. It releases on success or error. A browser or API client that
disconnects can leave work in progress, and the slot stays occupied until that
work settles. Separate API processes each maintain their own slot. Unfinished
analysis can keep its process's slot occupied for its entire lifetime.

The existing per-policy transactions and all-policy response are preserved.
A committed policy still appears alongside another policy's ordinary error.

## Verification

The bounded baseline loopback measurement observed two simultaneous service
invocations for three request orderings. The new HTTP regressions admitted
only one in each of four pairings, tested refusal before recording acceptance,
and verified release after success, error, and a disconnected client's
completed work. They also checked authorization and input precedence.

The isolated PostgreSQL suite held a real policy write on a fixture lock,
refused overlapping analysis, and verified the existing committed writes
and all-policy partial results. The focused server and PostgreSQL tests ran
through the production router registration. Root, server, and client npm
audits reported zero findings.

The focused runs passed 99 server tests and 110 isolated PostgreSQL tests.
Fresh backend coverage passed 64,462 tests in 1,957 suites with one skip and
89.36% statement coverage. The client source tree and coverage report hashes
matched, allowing reuse of the previous 88.00% client statement coverage.
The coverage ratchet, lint, type checks, Markdown, ownership, CI preflight,
ESM, and policy gates passed. GitHub listed no open PRs to adopt or rebase.

## Next recommended item

Measure all-policy response growth and memory use across realistic policy
counts, including concurrent queue and ingestion work. Use that evidence to
choose between a dedicated shared memory reservation and a bounded batch
contract for requests that retain many results.
