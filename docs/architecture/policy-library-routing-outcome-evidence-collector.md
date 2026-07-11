# Policy Library Routing-Outcome Evidence Collector

## Status

Implemented as the read-only Arr routing-outcome collector for the policy
evidence envelope.

The collector reads a bounded, destination-library-scoped routing snapshot from
persisted classification rows. It normalizes only three fixed outcome states:
`succeeded`, `blocked`, and `skipped`. It excludes route request data, Arr
responses, paths, tokens, API errors, media titles, metadata JSON, and unknown
reason values.

## Problem

Routing readiness is useful destination evidence, but the envelope must not
call Radarr or Sonarr, inspect logs, or expose request/response payloads. The
current routing path persists its final success as `classification_history`
status `routed`; automatic routing also persists a compact routing reason under
`metadata.classification_details.routing` for skipped and blocked outcomes.

There is no dedicated routing-event ledger yet. This collector therefore
normalizes only the bounded state already persisted on the classification row.
It intentionally does not derive evidence from log records, raw
`routing_error`, or arbitrary metadata values.

## Official Guidance Reviewed

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  recommends parameterized queries. The collector uses fixed SQL with bound
  library ID, server-owned reason allow-lists, and row limit.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allow-list validation. The collector accepts only a
  positive integer library ID and only fixed application-owned routing reasons.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends data minimization and sanitization. The collector does not select
  route-error text, titles, Arr data, tokens, or full metadata.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports secure, verifiable interfaces. Stable source keys, bounded records,
  generic failures, and a side-effect audit make the read model inspectable.

## Recommendations

1. Treat `routed` and `already_in_arr` as successful reconciliation states.
2. Normalize fixed configuration, identifier, lookup, and add-failure reasons
   as blocked outcomes.
3. Normalize fixed auto-route decision deferrals as skipped outcomes.
4. Ignore unknown reasons and raw errors until a dedicated routing-event model
   can represent them safely.
5. Read at most 51 rows and emit at most 50 evidence records.
6. Keep the collector read-only. It must not retry a route, refresh settings,
   call Arr, read provider quotas, or mutate policy state.

## Pros And Cons

Pros:

- Uses current persisted state without any live Arr dependency.
- Separates success, blocked, and skipped outcomes with stable semantics.
- Prevents request, response, path, and error payload leakage.
- Gives the existing evidence envelope bounded routing evidence immediately.

Cons:

- Captures only reasons current routing writers persist.
- Unknown and legacy free-form reason values are intentionally ignored.
- A dedicated routing-event ledger would provide richer chronology later, but
  should be designed separately rather than inferred from logs here.

## Final Recommendation Stack

1. `policyLibraryRoutingOutcomeEvidenceCollector.mjs` reads and normalizes
   persisted classification routing state.
2. `policyEvidenceEnvelope.mjs` accepts bounded `arrRoutingOutcomes`.
3. `policyEvidenceBoundary.mjs` projects the source as routing evidence.
4. Readiness and learning components consume the bounded result; neither the
   collector nor the envelope attempts or retries routing.

## Implementation Outcome

The collector returns:

```text
arrRoutingOutcomes[]
summary
sideEffects
```

Each record has a stable classification-based key, one normalized outcome state,
a fixed label and reason ID, and a timestamp. The audit validates bounded
counts, truncation, allowed normalized states, and the no-side-effect contract.

## Security Outcome

- All variable SQL values are parameterized.
- Only a positive library ID and server-owned reason allow-lists reach the
  query.
- Raw metadata is used only for a fixed JSON path comparison and is never
  returned.
- Route errors, Arr request/response payloads, paths, tokens, and titles are
  excluded.
- No live Arr/provider/media-server call, quota read, storage write, or route
  attempt is possible through the collector.
- The audit rejects summary drift, unknown states, and unsafe side-effect
  claims.

## Next Step

Implement a source-specific collector for already persisted metadata evidence.
It should emit only normalized, provider-independent facts already stored for a
destination, exclude raw provider payloads, and continue to prohibit
metadata-owned identity.
