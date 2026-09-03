# Current-Inventory Semantic Study Capture Design

## Status

Implemented on 2026-09-03 as an internal, in-memory study-preparation
component. It does not add an API route, database table, Settings control,
classification hook, policy-score change, or routing authority.

## Problem

The prior current-inventory snapshot format correctly reduces a completed
candidate-scoped retrieval to a minimal, redacted evidence record. It did not
own execution of the retrieval. That left no safe, repeatable way to prepare a
real 24–32-case cohort for the independent study needed before semantic
evidence can influence a future review path.

The gap matters because a semantic signal is useful only when measured against
independent answers across representative failures and ordinary cases. It must
not become an implicit confidence increase merely because a local model or an
existing library has a related title.

## Selected Design

```text
operator-selected, independently labelled 24–32 cases
  + server-owned two-to-three-candidate contracts
  + transient request metadata
  -> sequential existing candidate-scoped semantic retrieval
  -> redacted leader-versus-strongest-alternative snapshot per case
  -> content-free, fingerprint-bindable study document
  -> existing independent-label readiness and frozen-study preflight
  -> human review of error profile
```

`policyCandidateCurrentInventorySemanticStudyCaptureContract.mjs` validates a
single study request before any retrieval occurs. It requires exactly 24–32
cases, unique opaque fixture/snapshot identifiers, a valid two-or-three
candidate server-owned contract, and plain in-memory metadata. The request
schema permits no free-form study fields.

`policyCandidateCurrentInventorySemanticStudyCapture.mjs` runs the existing
retriever sequentially. Each retrieval is reduced immediately to the existing
strict snapshot; the raw retrieval result and request metadata then fall out of
scope. A case-level retriever failure becomes an unavailable snapshot, i.e. a
study abstention. It does not log the failure body or produce a partial,
content-bearing document.

The only successful output is the existing snapshot document plus three
aggregate counts: total cases, available retrievals, and unavailable
retrievals. The document contains no title, synopsis, library ID/name, item
ID/title/year, description, provider/model field, prompt, response, vector,
or routing state.

## Authority and Security Boundaries

- The component invokes only the existing, read-only, policy-owned candidate
  retriever; case metadata cannot add a library or enlarge its candidate set.
- It is intentionally sequential. A study run cannot multiply concurrent
  embedding/database load beyond normal individual retrieval behavior.
- The input stays in memory. The component writes neither a study database
  record nor an audit/log record and does not expose a browser endpoint.
- Unavailable/malformed retrieval results fail closed to an abstention. They
  cannot reuse a prior case's relevance values.
- Invalid requests are rejected before the retriever is invoked, including
  content-bearing identifiers, duplicate IDs, wrong cohort size, and invalid
  candidate contracts.
- Its result cannot change a policy, tune a threshold, invoke a model outside
  the pre-existing semantic retriever, learn from an item, retry an item, or
  route media.

## Research Basis

The sources below were retrieved from their official publishers on 2026-09-03
for the requested August 2026 baseline.

- NIST's AI RMF calls for documented, repeatable testing, evaluation,
  verification, and validation processes; its Measure function also calls for
  independently informed assessment and comparing outcomes with deployment
  conditions. A frozen 24–32-case study is therefore a prerequisite to any
  semantic-policy experiment, not a substitute for it. [NIST AI RMF
  Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- W3C's WCAG-EM 2.0 separates evaluation scope, product exploration,
  representative sampling, evaluation, and reporting. It further recommends
  comparing structured and random samples so a study cannot quietly cover only
  easy cases. This component enforces the cohort bound and leaves case
  composition/reporting to the existing independent-label protocol. [WCAG-EM
  2.0](https://www.w3.org/TR/WCAG-EM/)
- OWASP's RAG guidance says retrieved material is data, not instructions, and
  calls for retrieval-time controls plus retention/deletion discipline. The
  capture loop treats retrieval as a transient data source and serializes only
  bounded numeric evidence. [OWASP RAG Security Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Let semantic similarity immediately alter routing confidence | Quickly changes visibly poor suggestions. | No measured error profile; probabilistic evidence gains production authority and can hide failures. | Reject. |
| Persist full RAG packets from normal classifications | Rich debugging context. | Retains library/media data, prompt-like text, and provider output; creates substantial access, deletion, and injection surface. | Reject. |
| Keep only passive snapshot reduction | Minimal code and no run-time work. | Cannot produce a reproducible real 24–32-case cohort without custom caller behavior. | Reject. |
| Capture one bounded cohort in memory, redact immediately, and evaluate it independently | Exercises actual current-library retrieval; preserves candidate scope; supports repeatable TEVV; no normal retention. | Requires authorised case selection, independent labels, and a separate offline packet workflow. | Adopt. |

## Final Recommendation Stack

1. Use this capture component to prepare one representative 24–32-case cohort
   with a mixture of obvious placements, documentary/reality overlaps,
   broad-policy conflicts, and known confusing titles.
2. Bind the resulting document to independently reviewed labels and one frozen
   model/retrieval cohort using the existing readiness/preflight flow.
3. Report per-stratum false positives, false negatives, abstentions, and the
   rate at which the semantic leader conflicts with the deterministic leader;
   do not treat relevance as a user-facing confidence score.
4. If the error profile passes conservative review, test semantic
   counter-evidence only as a bounded candidate-comparison or operator-review
   trigger for broad policies. Keep automatic routing out of scope.
5. Build a calm library-understanding summary only after this measurement
   proves which semantic evidence is trustworthy enough to surface.
