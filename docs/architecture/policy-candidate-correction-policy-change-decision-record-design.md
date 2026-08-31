# Policy Change Decision Record Design

## Status

Implemented on the unreleased branch. This component makes the conclusion of
an operator's review of a completed policy-change outcome explicit without
granting that conclusion authority to change policy, routing, AI, RAG,
learning, retry, or classification behavior.

The research sources below were verified on 2026-08-31 against their official
publishers and were current for this August 2026 design decision.

## Problem

The policy-change follow-up provides a bounded, aggregate-only before/after
comparison. An operator still needs a clear way to state what they concluded
from that comparison, and to correct that conclusion later, without turning a
metric into automated policy authority or retaining media, policy, library, or
free-text reasoning.

## Selected Design

```text
completed aggregate outcome observation
  -> automatically loaded review-ready decision status
  -> operator selects a fixed conclusion and fixed rationale
  -> operator confirms that the aggregate comparison was reviewed
  -> server transaction locks the current observation and decision control
  -> one content-free, expiry-bound decision record is saved or revised
  -> separate existing policy-maintenance workflow remains manual
```

The decision record is available only while the current outcome observation is
in its completed, readable period. It is keyed to that observation's opaque
hypothesis identifier and expires at the same server-owned time. It stores no
policy ID, policy text, library, media, candidate, destination, historical
record, provider/model data, prompt, response, RAG text, selector, or free
text. The creator and last-reviser actor IDs are retained internally for
accountability but are not returned to the browser.

The fixed decision choices are:

- `retain_current_policy`
- `investigate_policy_evidence`
- `prepare_manual_policy_change`

The fixed rationale choices are:

- `outcome_improved`
- `outcome_unchanged_or_inconclusive`
- `outcome_degraded`
- `requires_contextual_review`

Those identifiers describe a review conclusion; they cannot select a policy,
send a request to an AI provider, retrieve RAG context, create a routing job,
or modify a configuration. The existing native policy-change workflow remains
the only place where a policy could later be changed, with its own controls.

## Data, Authority, and Concurrency Boundaries

- `GET` is selector-free and exposes only review availability, the opaque
  observation reference, a fixed decision/rationale pair when one exists,
  revision, timestamps, expiry, and explicit no-automation flags.
- `POST` accepts only a known decision ID and rationale ID. It can create one
  record only after the server verifies that the current outcome is complete
  and still readable.
- `PUT` accepts the same fixed IDs plus the current server revision. It lets
  an administrator correct the conclusion, but rejects stale revisions rather
  than silently overwriting a concurrent review.
- Every route requires an authenticated administrator, applies no-store, and
  has separate fixed read and mutation rate limits. It rejects query
  parameters, unknown properties, arrays, and non-object bodies.
- The service performs all writes in a transaction and shares the existing
  outcome-observation advisory lock. It locks both controls before validating
  availability and writing, preventing an outcome replacement or expiry race.
- Retention deletes the decision before deleting its associated expired
  outcome observation. Every backup-restore mode deletes both operational
  records before restoring configuration.

## Accessible, Hands-Off UI

The Security Settings component automatically reads decision status whenever
the parent follow-up becomes ready; it does not require a second refresh
action. Before writing, it shows a plain-language review boundary, the fixed
options, and a required confirmation checkbox. A successful save or stale
revision result is announced through a concise polite status message without
moving focus. A previously saved decision stays editable, which makes the
important submission correctable rather than irreversible.

Native fieldset/legend, radio controls, labels, a real checkbox, and a native
button preserve keyboard and assistive-technology semantics. The component
uses text and structure rather than color alone to communicate status.

## Options Considered

### Fixed, revisable aggregate decision record — selected

Pros:

- Makes the operator's outcome follow-up explicit and correctable.
- Keeps the decision bounded to the existing aggregate observation lifecycle.
- Avoids free-text, media, policy, and AI/RAG retention while preventing a
  metric from becoming automatic authority.

Cons:

- Cannot capture a bespoke explanatory narrative.
- Supports only one current decision record at a time.

### Free-text review notes

Pros: richer contextual explanations.

Cons: creates an unbounded sensitive-data and retention surface. Rejected for
this component; an operator may use their separate approved change-management
process where appropriate.

### Automatic policy or model tuning from the result

Pros: less manual work.

Cons: treats a descriptive aggregate outcome as a causal, authorized command.
Rejected.

### Immutable decision record

Pros: simple append-only history.

Cons: makes an important operator submission hard to correct and expands
retention. Rejected in favor of one bounded optimistic-concurrency revision.

## Research Basis

- W3C's WCAG 2.2 Error Prevention guidance says important submissions should
  be reversible, checked, or reviewable before finalizing. The decision record
  uses an explicit pre-submit confirmation and a revision path:
  [Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data).
- W3C's status-message guidance supports programmatically determinable,
  non-focus-stealing result feedback. The auto-loaded review state and write
  result use a concise polite status region:
  [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- OWASP identifies broken function-level authorization, property-level
  authorization, and unrestricted business flows as API risks. Administrator
  authorization, strict request allow-lists, a fixed DTO, no selectors,
  transaction locking, and rate limits address those boundaries:
  [API5:2023](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/),
  [API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/),
  and [API6:2023](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/).
- NIST's Privacy Framework supports data minimization and privacy-aware data
  processing. Fixed enumerations and shared expiry avoid narrative or
  identity-bearing retention:
  [NIST Privacy Framework](https://www.nist.gov/privacy-framework).

## Recommendation Stack

1. Review the aggregate outcome only after its fixed follow-up window has
   completed.
2. Record one fixed decision and rationale through this bounded component.
3. Revise the record if the conclusion changes; never work around a stale
   revision by assuming a concurrent administrator's intent.
4. Use the existing native policy-maintenance workflow for any later policy
   change, which remains a distinct reviewed operation.
5. Keep outcome observations and decision records descriptive; never use them
   as an automatic AI/RAG, routing, learning, retry, or policy input.
