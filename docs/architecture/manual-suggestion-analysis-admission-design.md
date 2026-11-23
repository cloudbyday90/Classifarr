# Manual suggestion analysis admission

November 23, 2026 Eastern. This follows the
[suggestion rejection and analysis authority change](suggestion-review-mutation-authority-outcome.md).

## Evidence

The manual per-policy and all-policy POSTs start work independently. The
existing policy lock serializes suggestion writes, while cohort reads,
analysis, and all-policy enumeration occur outside that lock. A per-policy
cohort is limited to 5,000 rows and a 2 MiB canonical manifest. The all-policy
service visits enabled policies sequentially and retains successful results
alongside per-policy errors. Each policy has its own write transaction.

A controlled loopback measurement used the production route registration,
a fixed administrator fixture, and two service latches per scenario. In
per-policy then all-policy, all-policy then per-policy, and all-policy then
all-policy order, the follower returned `200` while the first service call
was still active. Peak concurrent service invocations were two in all three
scenarios. This measures route overlap. PostgreSQL timing and peak memory
were outside that measurement.

## Recommendation and tradeoffs

1. Give the two manual routes one shared, process-local admission slot in a
   small service. Check it after authentication, role and input validation,
   before logging an accepted request or entering the analysis service.
   Fail immediately when occupied, without queueing the request. The bundled
   container launches one API process. A deployment with multiple processes
   gets one slot in each. This reduces overlapping work and deliberately
   serializes work for different policies within one process.
   [OWASP resource-consumption guidance](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
2. Return `503` with code `SUGGESTION_ANALYSIS_BUSY`, a fixed message to
   try again after the running analysis finishes, and `Cache-Control:
   no-store`. Omit `Retry-After` because the first request's completion time
   is unknown. The response distinguishes refusal before dispatch from
   a failure after admission. Preserve the existing admin checks and JSON
   success responses. The error text follows W3C's actionable error guidance
   by analogy. The product has no bundled analysis caller.
   [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
   · [W3C WCAG error suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
3. Hold admission through service settlement and response preparation and
   release it in `finally`. An HTTP disconnect can leave authorized work
   running and the slot occupied until it settles. Keep per-policy commits,
   errors, and partial results governed by the existing service.
   A refused request is neither queued nor replayed. A slow or unfinished
   analysis may keep subsequent requests busy for its lifetime.
4. Leave the shared memory coordinator's ingestion, queue, and discovery
   classes unchanged. Reusing discovery would also impose its memory and
   unrelated-work exclusivity rules. Adding an analysis class calls for an
   evidence-based memory budget and coordinated changes to diagnostics.
   Astra found that a database advisory lock would coordinate multiple API
   processes, but taking it on a separate connection can starve an accepted
   pool size of one while analysis waits for its own connection. Connection
   ownership, session loss, and per-policy commit behavior warrant an
   independent design before using that option.
   [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)

## Verification

Use deterministic overlap fixtures on the production HTTP route registration.
Cover both route orderings, single/single and all/all, immediate refusal
before work or logging, release on success or failure, and disconnect while
work is still active. Verify validation and authorization precedence. Run
the production service and both routers in isolated PostgreSQL, including
all-policy partial success and unchanged durable suggestion lifecycle. Run
fresh backend coverage and normal gates, and check the exact pushed commit.

After delivery, measure workload and response growth across real policy counts
and evaluate dedicated memory admission or a bounded batch contract.
