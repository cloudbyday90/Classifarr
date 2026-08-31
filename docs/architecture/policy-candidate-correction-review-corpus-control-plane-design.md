# Policy Candidate Correction Review-Corpus Control Plane Design

## Status

Implemented on the unreleased branch. This component configures safeguards
only. It does not select, query, persist, export, or expose historical review
records.

## Problem

The historical review-corpus preflight correctly distinguishes a sustained
aggregate correction signal from permission to inspect historical decisions.
The next missing boundary was an administrator-owned, durable place to record
the future corpus purpose, its safeguards, a prospective review-record
retention limit, and the operator action that accepted them.

Making that state a client setting or expanding the aggregate Statistics
response would make the browser responsible for security policy and could
accidentally turn an aggregate signal into data-access authority.

## Selected Design

```text
administrator-only /api/policies route
  -> strict acknowledgement request and revision check
  -> transaction + advisory lock
  -> singleton purpose-limited configuration
  -> append-only minimal audit event
  -> allow-listed response DTO
  -> Security Settings status card and native audit disclosure
```

The server owns the only configurable value: a future review-record retention
limit from 7 through 90 days. The purpose, two-period sampling frame, and four
required safeguards are fixed server vocabulary:

- `authorization`
- `redaction`
- `retention`
- `operator_audit`

The endpoints are parented by the already administrator-only `/api/policies`
mount and independently verify an authenticated administrator actor:

| Endpoint | Function | Response boundary |
| --- | --- | --- |
| `GET /candidate-correction/review-corpus/configuration` | Read the current control state. | No-store, content-free DTO. |
| `PUT /candidate-correction/review-corpus/configuration` | Acknowledge the fixed safeguards with an expected revision. | Rate-limited, transactional, no-store. |
| `GET /candidate-correction/review-corpus/audit-events` | Read a small, bounded list of recent configuration acknowledgements. | No-store, minimal audit metadata. |

The `PUT` accepts exactly three fields: `expected_revision`, the exact ordered
safeguard list, and `review_record_retention_days`. It rejects mass-assigned
or reordered fields. A server-derived SHA-256 revision protects against stale
writes. A transaction-scoped advisory lock serializes the singleton update.
An identical current configuration produces no new audit event.

## Data Model and Security Invariants

`policy_candidate_correction_review_corpus_controls` contains a single,
purpose-fixed acknowledgement configuration. The value is mutable because a
later administrator may choose a different prospective retention limit.

`policy_candidate_correction_review_corpus_audit_events` contains only the
configuration revision transition, administrator numeric actor ID, action ID,
retention limit, fixed safeguard identifiers, and timestamp. A database trigger
rejects updates and deletes.

The control plane must always preserve these invariants:

1. `historicalRecordAccess` is always `false`.
2. No endpoint accepts a record ID, title, library, policy, candidate,
   destination, provider, prompt, response, or RAG text.
3. No endpoint invokes AI, RAG, policy learning, retry, classification, or
   routing work.
4. The browser uses strict normalization for display containment, while the
   server's allow-listed DTO is the actual egress control.
5. A configuration acknowledgement is not a corpus, selection permit, or
   record-level authorization decision.

The separate redacted evaluation projection, retention/deletion job, and
minimal access-audit policy are implemented by the successor design:
[Redacted Review Projection Design](policy-candidate-correction-redacted-review-projection-design.md).
The control plane remains distinct from that projection and cannot grant raw
source-record access.

## Accessibility and Hands-Off Behavior

The Security Settings card loads configuration and its short audit history on
entry; it has no refresh control or modal. An administrator only needs to act
when deliberately acknowledging the future safeguard contract. The visible
text and polite status region communicate loading, success, and failure
without color alone. The bounded audit history uses native `details` and
`summary`, keeping routine settings uncluttered while preserving keyboard
operation.

## Options Considered

### Administrator control plane with immutable acknowledgement audit — selected

Pros:

- Establishes a durable, server-enforced security contract before data access.
- Provides stale-write protection and a minimal audit trail without retaining
  media or model content.
- Keeps the routine UI self-updating and low-interruption.

Cons:

- Does not yet provide a review corpus or offline evaluation data.
- Requires a later record-level design to implement the retention setting.

### Client-only acknowledgement

Pros:

- Smaller implementation.

Cons:

- No server enforcement, audit durability, or concurrent-write protection.
  Rejected.

### Enable a historical query after acknowledgement

Pros:

- Faster apparent path to sample review.

Cons:

- Would create a record-level access surface before authorization, redaction,
  and deletion controls exist. Rejected.

## Research Basis

- NIST's Privacy Framework describes using a target profile to verify privacy
  capabilities before deployment and reassessing data-lifecycle outcomes:
  [Using Privacy Framework 1.1](https://www.nist.gov/privacy-framework/using-privacy-framework-11).
- NIST SP 800-53 Rev. 5.2 identifies access enforcement and limiting PII in
  audit records as distinct controls; this component keeps the event to an
  administrator ID and fixed configuration metadata:
  [SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final).
- OWASP recommends property-level authorization, explicit response properties,
  and schema-based response validation. The route and browser normalizer both
  use an allow list, with the server as the enforcement point:
  [API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/).
- W3C guidance calls for programmatically determinable status feedback and
  semantic, keyboard-operable disclosure behavior. The card uses a status
  region and native disclosure rather than a custom modal:
  [WCAG Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages),
  [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).

## Recommendation Stack

1. Keep aggregate correction evidence deterministic and advisory.
2. Require this administrator-owned configuration acknowledgement before any
   corpus work proceeds.
3. Add a separately authorized, redacted record projection and retention job.
4. Run an offline, documented sample evaluation with uncertainty and
   independent review.
5. Keep AI and RAG advisory; neither may select corpus records, change policy,
   or route media automatically.
