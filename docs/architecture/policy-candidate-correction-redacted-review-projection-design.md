# Policy Candidate Correction Redacted Review Projection Design

## Status

Implemented on the unreleased branch. This design adds a bounded offline
evaluation artifact, not a historical media browser and not a new AI, RAG,
policy, or routing authority.

## Problem

The correction analytics screen can identify a sustained aggregate signal, but
an aggregate cannot show whether the pattern is concentrated in close score
margins, a particular operator outcome, or one of the fixed evidence states.
Giving a browser direct access to `classification_history` to answer that
question would expose media identity and much more sensitive context than an
offline policy review needs.

## Selected Design

```text
administrator action
  -> existing safeguard acknowledgement and retention limit
  -> transaction + server-owned sample seed
  -> SQL allow-list projection at the history boundary
  -> persistent redacted snapshot (maximum 160 rows)
  -> no-store, administrator-only read with append-only access audit
  -> native table in Security Settings
  -> scheduled expiry deletion and append-only expiry audit
```

The endpoint never accepts a history-row, media, library, candidate,
destination, provider, prompt, response, or RAG identifier. It has no
client-selectable date, stratum, sample size, or export parameter. The server
selects up to five rows in every available combination of the two completed
28-day periods, four score-margin bands, and four validated operator outcomes.

The snapshot is its own reproducible manifest: each retained row has only its
ordinal, period, score-margin band, selection outcome, and exactly five fixed
evidence-source states. The sample seed and the source row ID are used only
inside the database statement to choose records. Neither is persisted or sent
to the browser.

## Redaction Contract

The projection tables and read DTO may contain only:

| Field | Purpose |
| --- | --- |
| Snapshot timestamps and expiry | Bounded retention and operator context. |
| Fixed period ID | Compares the existing adjacent completed 28-day windows. |
| Score-margin band | Locates calibration uncertainty without raw scores. |
| Validated selection outcome | Distinguishes confirmed and changed candidate outcomes. |
| Five evidence source/state pairs | Shows deterministic evidence coverage, not evidence content. |

They must not contain source history IDs, titles, TMDB IDs, years, library or
destination names/IDs, policies, actor names, methods, raw metadata,
descriptions, provider/model data, prompts, model responses, RAG text, or
routing controls.

The browser normalizer reconstructs only this fixed DTO and drops unknown
fields. That is display containment; the parameterized server-side selection
and allow-listed database projection are the actual egress controls.

## Authorization, Audit, and Retention

The existing parent policies route remains authenticated. The projection route
also checks for an administrator role and a positive authenticated actor ID at
every read and create operation. It exposes no source object identifier, so no
caller can substitute a history-row ID. The server checks that the active
snapshot belongs to the current acknowledged control revision before it reads
any projection items.

Every successful snapshot read adds a minimal append-only audit event. The
event holds only the administrator numeric ID, action, snapshot creation time,
configuration revision, item count, and timestamp. Creation gets the same
minimal audit treatment. Expiry deletion is performed by a daily transaction
with a database advisory lock, cascades the projection rows, and writes an
expiry event without an actor. The snapshot's expiry is calculated from the
acknowledged 7–90 day retention limit at creation time.

The APIs return `Cache-Control: no-store`, and distinct administrator read and
create rate limits constrain audit amplification. The UI loads current state
automatically; only snapshot creation is explicit because it starts a durable
evaluation artifact. There is deliberately no automatic policy tuning or
automatic re-creation after expiry.

## Accessibility and Hands-Off Behavior

The status region is concise and polite, so routine load and action state is
announced without making the full table a live region. The static snapshot is a
native HTML table with a caption and scoped headers inside a native disclosure.
That keeps up to 160 rows out of the way until wanted while preserving keyboard
and screen-reader semantics. No color is the only state indicator.

## Options Considered

### Server-redacted persisted snapshot — selected

Pros:

- Gives a stable, reviewable sample and a bounded retention clock.
- Keeps raw media/history data inside the server/database boundary.
- Makes operator outcomes and evidence coverage inspectable without granting
  source-record access.

Cons:

- It cannot answer content-specific questions such as whether a given title's
  synopsis supports a policy.
- Snapshot creation is an explicit administrative action, and the sample can
  become stale before expiry.

### Direct, live classification-history query

Pros:

- Would expose more contextual detail for a reviewer.

Cons:

- Is a moving target, defeats reproducibility, creates object-level
  authorization risk, and would expose more data than the aggregate review
  question requires. Rejected.

### Client-side redaction of a history response

Pros:

- Small apparent implementation.

Cons:

- Sensitive fields already cross the HTTP boundary before the browser removes
  them. Rejected.

### Automatic policy/AI/RAG tuning from corrected rows

Pros:

- Lower operator effort.

Cons:

- Confuses advisory evidence with authority and risks propagating a small or
  shifted cohort into routing behavior. Rejected.

## Research Basis

- OWASP API1 requires server-side object authorization for every endpoint that
  accepts an object identifier. This component avoids accepting source object
  identifiers and independently enforces administrator authorization:
  [API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).
- OWASP API3 recommends allowing only the response properties a client needs.
  The fixed projection schema and browser normalization follow that model:
  [API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/).
- OWASP API5 supports explicit, deny-by-default function authorization for
  administrative capabilities:
  [API5:2023 Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/).
- The NIST Privacy Framework supports context-specific profiles and managing
  privacy risk across the data lifecycle. The fixed field set, retention
  window, and deletion workflow implement a narrow profile for this use:
  [NIST Privacy Framework](https://www.nist.gov/privacy-framework).
- W3C recommends conveying dynamic state programmatically and preferring
  native table semantics for static tabular information:
  [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages),
  [W3C Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/), and
  [ARIA APG Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/).

The NIST Data Governance and Management Profile had public working sessions in
2026 but remained a developing resource at the time of this implementation; it
is informative context, not claimed as a finalized control baseline:
[NIST DGM Profile](https://www.nist.gov/privacy-framework/new-projects/data-governance-and-management-profile).

## Recommendation Stack

1. Use this redacted snapshot for aggregate policy-evidence evaluation only.
2. Compare the returned rows with the existing aggregate uncertainty and
   long-horizon trend before editing any declared policy.
3. Make policy changes through the existing reviewed authoring workflow, then
   observe a new complete period; do not use this sample to auto-tune.
4. If content-level review is ever needed, design a separate purpose-bound
   workflow with a new threat model, data minimization review, per-record
   authorization, and deletion guarantees. Do not expand this DTO.
