# Live routing guard diagnostics: design

Date: 2026-09-20. Continues the
[soft-review admission outcome](soft-review-adjudication-outcome.md).

## Finding and scope

The six content-agreeing cases were exercised through the existing live resolver,
using current library rows, current policy evaluation, cached query embeddings and
real local model proposals. Five passed familiarity and both freshness reads; the
administrator's require-all-confirmations setting correctly retained review. One
had an unusual familiarity result. This did not reproduce a stuck retry or justify
lowering a threshold. Content agreement alone is not permission to route.

The implementation gap is that different failures collapse into
`live_guard_blocked`. Keep the existing predicates and aggregate counter, but add
fixed, content-free first-stopping-reason counts. Do not create a second resolver,
extra model requests, a retry loop, a routing setting or a new dashboard panel.

## Contract and architecture

- The existing ESM assessment returns a structured result; its boolean exports
  remain compatible wrappers. Scope, identity, familiarity and prompt/current
  evidence equality retain their existing order and acceptance rules.
- Distinguish unsupported content comparison, unclear competing identity,
  unusual familiarity, unavailable/invalid familiarity and changed prompt evidence.
  Only a structurally valid unusual baseline receives the unusual diagnosis.
- The existing bounded evaluation controller records a reason only alongside an
  already-counted `live_guard_blocked` outcome. One completed attempt records at
  most one reason. Successful neighbor fallback and freshness failures do not
  accumulate an earlier, superseded reason.
- An optional `guardReasons` map travels through the existing administrator-only
  queue live-stats projection. The original counter schema and endpoint remain
  unchanged. Unknown source fields are dropped; malformed optional maps are
  omitted without hiding the main summary. Old responses remain readable.
- Client normalization independently validates the fixed keys and bounded counts.
  Display only nonzero reasons inside the existing closed details element. Keep
  pause/resume, authorization clearing and quiet status announcements unchanged.
- No titles, library IDs, raw evidence, model text or exception messages enter the
  diagnostic map. It is process-local and resets on restart. It is not routing
  authority, accuracy, unique-item counts or an outstanding-work queue.

## Research and tradeoffs

Official sources were discovered through search tools and read on 2026-09-20.

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| Structured reasons in the existing assessment | Explanations cannot drift into a separate scoring implementation | Small additive API field; coordinated client validation |
| Content-free bounded counters | Useful diagnostics without retaining private prompts or media | Cannot identify an individual item; resets on restart |
| Preserve live revalidation | Detects evidence or policy changes after model comparison | Additional existing reads and latency remain |
| Reuse the closed details element | No extra setup or default screen density | Details require deliberate expansion |
| Lower familiarity thresholds or disable confirmation automatically | Would increase apparent automation | Rejected: no accuracy evidence or authorization for that change |

[OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
supports output policy enforcement, cache integrity, monitoring and fail-closed
behavior. Applied here: diagnostics describe a decision; they cannot authorize it.

[PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
documents transaction-scoped repeatable snapshots. Our inference is that a model
comparison spanning separate reads still needs final freshness checks; a stable
earlier transaction is not a promise that later evidence is unchanged.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
supports programmatically identifiable, non-disruptive status updates. Preserve the
existing polite status region and native disclosure; do not announce every count
change or move focus during polling. This is scoped accessibility work, not a claim
of complete WCAG conformance.

## Recommendation stack

Policy eligibility → bounded local advisory comparison → content agreement →
identity and familiarity checks → final evidence/configuration revalidation →
existing one-use routing authority and confirmation gate. Diagnostics observe this
stack; they never replace it. No dependency, migration, release or version change.

## Acceptance

Regression tests must preserve qualification, one-use context, confirmation,
neighbor-shadow and fail-closed behavior while covering each reason, saturation,
unknown values, API authorization and client clearing. Repeat the live read-only
smoke against the new image and compare source digests. Keep private artifacts out
of Git. Record actual test results separately in the outcome document.
