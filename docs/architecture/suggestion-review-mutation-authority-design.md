# Suggestion rejection and manual analysis authority

November 23, 2026 Eastern. This follows the
[suggestion application authority change](suggestion-application-authority-outcome.md).

## Findings

Astra traced both rejection aliases and the two manual analysis POSTs. Each
currently admits any authenticated account. Rejection locks the policy and
pending suggestion, then records `reviewed_by`, `reviewed_at`, and the reason
in the same transaction. The primary route can substitute reviewer ID `1`,
and the feedback alias accepts a numeric prefix as the suggestion ID. The
dashboard uses the primary route from the card and detail view.

Both manual analysis POSTs can save new suggestions or supersede stale pending
ones. Supersession can occur even when there are no new suggestions to save.
Analysis carries no actor identity through either route today. It does not
apply policy settings or write a human review. The all-policy route processes
enabled policies sequentially and reports per-policy failures. The
repository has no bundled browser or scheduler caller for these two POSTs.

## Recommendation and tradeoffs

1. Require the existing administrator middleware for both rejection aliases
   and both manual analysis POSTs. Check the session actor before command
   dispatch. Regular accounts retain authenticated reads. Keeping the routes
   preserves administrator integrations. Ordinary-account integrations will
   receive `403` for these writes. A delegated reviewer role could preserve
   that workflow, with the cost of new permission and role management.
   [OWASP function-level authorization](https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/)
2. Reuse the Apply boundary for rejection, with canonical positive suggestion
   IDs through `2147483647` and the authenticated reviewer saved by the existing
   transaction. Require the same exact range for the per-policy analysis ID
   and administrator actor. Keep both existing response shapes and suggestion
   ID types, rejection reason behavior, analysis option defaults and ranges
   (`days` from 1 to 365 and `minFeedback` from 1 to 1,000),
   missing-target and lifecycle handling, and the existing lock order.
   External callers using alternate ID spellings will need canonical IDs.
   [PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html)
   · [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
3. Log each accepted manual analysis request with the exact administrator ID,
   action scope, and policy ID when applicable. Use the existing structured
   logger with fixed fields. This provides attribution for the request with no
   change to the analysis transaction or per-policy partial results. A durable
   receipt would provide stronger outcome evidence at the cost of defining
   per-policy commit, partial failure, and retention semantics. Keep automated
   supersession distinct from the human reviewer field.
   [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
4. Validate Reject IDs in the existing client adapter and reuse the Apply
   dashboard's administrator guidance when the rejection is role- or
   actor-denied. Keep current controls, session requests, conflict recovery,
   and transport behavior. This avoids a new role query while providing an
   actionable next step when the request is refused.
   [W3C WCAG error suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)

## Verification

Use both production routers and genuine bearer authentication in isolated
PostgreSQL. Cover refusal before dispatch, exact input and status boundaries,
both wire formats, saved rejection actor, unchanged member reads, cross-alias
conflicts, authorized per-policy and all-policy supersession, and unchanged
evidence and locking behavior. Test the fixed analysis log metadata and the
client's exact URLs and refusal handling. Run fresh affected coverage and
normal quality gates, then inspect the pushed commit's checks.

An independent follow-up should assess dedicated analysis resource admission
and whether operations need a durable per-policy completion record. The
administrator role limits callers, while existing analysis can still process
every enabled policy in one request.
[OWASP unrestricted resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
