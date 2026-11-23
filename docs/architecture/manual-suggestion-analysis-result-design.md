# Bounded manual suggestion analysis results

November 23, 2026 Eastern. This follows the
[manual analysis capacity study](manual-suggestion-analysis-capacity-outcome.md).

## Existing behavior

The administrator-only `POST /api/feedback/analyze-all` loads every enabled
policy, processes each one in order of enumeration, and retains the detailed
results until the HTTP response is serialized. Each policy keeps its own
transaction. A later failure can coexist with earlier committed suggestions.
The shared slot limits overlapping requests in one API process. Metadata
diversity increased the measured response 4.86 times at the same policy and
feedback-row counts.

Astra found no bundled caller of the all-policy route. External administrator
integrations can still use its existing response. The database stores a
cohort when a new suggestion is inserted. Insufficient-feedback and failed
outcomes do not have a saved run record. Analysis that produces only duplicates
can return detector output without inserting a cohort. The current evidence
reads describe saved suggestions, with their own lifecycle and access rules.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Explicit bounded summary | Cap the work per new request and give every selected policy a compact status | Clients adopt a new request mode. The legacy full response remains available during migration. |
| Persist a paginated run | Keep the original outcome and detail available after disconnect, including partial completion | Requires durable membership, atomic per-policy outcome writes, retention, deletion and access rules. |
| Replace the default response | Move current callers to the bound immediately | Changes the existing wire contract for external clients that rely on full evidence. |

## Recommended sequence

1. Add an explicit bounded summary mode for the existing administrator POST.
   Choose a deterministic bounded policy batch and keep one fixed-size outcome
   per selected policy. Return counts and fixed failure categories, with an
   unconfirmed outcome when the service throws after a write could have
   started. Avoid raw evidence and unbounded message strings in the new
   representation. Preserve the existing per-policy work and the shared
   admission slot. Existing requests keep their detailed response during the
   compatibility period.
   [OWASP resource limits](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
   · [OWASP authorized response fields](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/)
2. Define a separate read for saved evidence. A policy result and a saved
   suggestion represent different things. If clients need the full detector
   output from the same execution, capture it during the admitted work and
   bind it to durable per-policy outcomes. Use a uniquely ordered bounded
   page and authorize every detail read. A read never invokes analysis.
   Document what remains recoverable when a caller loses a POST response;
   automatic replay requires a separate command receipt contract.
   [PostgreSQL pagination](https://www.postgresql.org/docs/18/queries-limit.html)
   · [HTTP method and retry semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
3. Compare legacy and bounded execution on matching disposable Linux fixtures.
   Track response bytes, cgroup peak and events, per-policy write parity, and
   queue and ingestion progress. This distinguishes the response benefit
   from a deployment memory budget. Future operator views should identify
   partial or unavailable results in text, with accessible progress and
   completion messages.
   [Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/)
   · [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)

## First implementation contract

- `POST /api/feedback/analyze-all?format=summary-v1` selects the bounded
  representation. With no `format`, the existing detailed behavior stays
  available. Refuse unknown or repeated format values and malformed summary
  parameters before admission. The existing administrator and actor checks
  still precede all analysis work.
- Select enabled policies by ascending exact PostgreSQL `INTEGER` ID. The
  optional `afterPolicyId` filter accepts canonical positive decimal text.
  Read at most 25 IDs and attempt at most 24, with the extra ID used only to
  determine `nextAfterPolicyId`. A continuation is a new manual mutation of
  the live enabled set. Disabling or enabling a policy between requests can
  change what appears. Each request returns every attempted outcome, with no
  snapshot membership or automatic replay. The 24-policy scope covers the
  largest measured fixture. Deployment memory and latency still need their
  own characterization.
- Return `policiesAttempted`, fixed `counts`, `nextAfterPolicyId` and one row
  per attempted policy. Rows use `completed`, `insufficient_feedback`, or
  `unconfirmed` and carry the exact `policyId`, `feedbackCount`, and
  `suggestionsCreated` when known. Use `unconfirmed` for errors that
  reach the batch, including possible lost commit acknowledgements. Existing
  locks and per-policy transactions determine what was saved. Retain only
  compact results between policies. The maximum response is 4 KiB of compact
  UTF-8 JSON, with fixed keys, codes and bounded integer fields. Use
  `Cache-Control: no-store` for the summary.
- Expose the opt-in in the client API adapter using the existing transport
  option to suppress automatic retry and authentication replay. Keep the
  detailed path, single-policy analysis and existing evidence reads in use.
  Durable run membership, paginated evidence from that run, and container
  admission sizing follow separately.

Verify real PostgreSQL selection and continuation, the untouched default
response, HTTP refusal, partial completion, and the fixed byte limit with
maximal valid fields. Compare both modes against the same existing isolated
capacity fixtures and check per-policy suggestion-write parity. Retain the
paired Linux capacity study as the next step before setting a shared budget.
