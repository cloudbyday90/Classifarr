# Prospective policy evaluation capture design

Date: 2026-10-28. Status: agreed scope implemented and locally verified.

Follows the [private disagreement report outcome](prospective-disagreement-report-outcome.md).
The separate [investigation outcome](prospective-policy-intent-capture-outcome.md)
records repository evidence, checks and remaining work.

## Problem

The private disagreement report preserves experimental ranking comparisons and
validated operator assessments. It cannot explain the actual policy evaluation
or historical purpose provenance because neither was frozen with the decision.
Today's policy configuration cannot supply that missing historical evidence.

Native intent storage, operator declaration and runtime admission mean different
things. A policy in native storage may contain profile-derived purpose rules.
An inferred purpose can qualify for runtime ranking without proving an operator
declared that purpose. Preserve all three dimensions independently.

## Agreed evidence boundary

Capture the live policy evaluation retained with a classification. A second pass
may replace an earlier evaluation; the retained result is the capture reference.
This is a policy evaluation snapshot, separate from the final AI or routing
decision, experimental inventory ranking and explicit operator assessment.

Include the complete media-compatible evaluated pool, up to 64 candidates, its
final ranked order, and closed exclusion reasons and counts. Do not cap live
policy evaluation to satisfy the diagnostic budget. A larger pool is an explicit
capture gap, never a truncated pool presented as complete.

The pool counts active rows loaded by the runtime query. Media-incompatible
rows contribute only to the skipped-type count. This is not a census of inactive
configuration or a reconstruction of earlier discarded evaluations.

Freeze only bounded IDs, numeric scores and weights, and fixed categories:

- Typed item identity, evaluation version, stage and capture time.
- Exact policy/library IDs for the evaluated pool and final ranked order.
- Available numeric signal scores, weights, policy scores and thresholds, with
  their evaluation stages identified.
- Actual storage/runtime authority source and validation state.
- Purpose provenance: `declared_native`, `profile_derived`, `mixed` or
  `unverified`, using the existing provenance semantics.
- Runtime admission and eligibility separately from declaration provenance.
- Closed evaluated-candidate dispositions and exclusion counts.

No names, titles, prompts, raw rule values, free-text warnings, raw contracts or
credentials belong in this snapshot. A count or native-storage flag must not
stand in for declaration evidence. Numeric inputs do not claim to reproduce all
calibration, AI selection or subsequent routing.

Discarded evaluations, offline/replay evaluations, legacy classifications,
malformed identities and overflow remain explicit gaps. Existing evidence must
not be upgraded using current policy state or a favorable later retry.

## Minting and persistence

Keep capture construction in small service modules. The production policy-engine
wrapper should supply a per-evaluation capability; shared offline evaluators
must default to no capture authority. Freeze the loaded provenance before
asynchronous scoring can change the source object.

Bind the minted object to the retained result and typed item identity. Hold that
same object before persistence awaits, then recheck identity and final ranking
before saving. A deserialized copy, copied shortlist or replacement result is
not an authentic capture merely because its fields look valid.

Store a separate classification-bound first-write-wins child record. Use exact
classification IDs and database-side identity checks. Protect immutable headers
and evidence against replacement; conflict handling alone does not prevent a
later update. Do not use policy/library foreign keys that erase historical facts
when configuration changes.

Write diagnostic evidence best-effort after classification persistence commits.
A capture failure leaves an evidence gap and cannot roll back a valid
classification. An optional SQL failure inside the pending-decision transaction
would poison that transaction unless isolated; postcommit persistence avoids
making diagnostic storage part of the classification outcome.

The agreed payload lifetime is thirty days. Preserve expiry tombstones so an
expired record cannot be refilled, replaced or upgraded. Exclude the child
evidence from portable configuration backups.

## Confirmed lifecycle and limits

The final scope confirmation includes these details:

- Retain frozen records through configuration restores while their original
  History row survives. Never reinterpret their historical IDs through current
  policies. History deletion cascades to its child record.
- Bound each complete capture to 64 evaluated candidates and 64 KiB. Missing,
  overflow and binding-failure evidence remains explicit rather than truncated.
- Include the optional payload in database-side input admission before transfer
  to Node. Preserve the existing 64 MiB whole-source budget.
- Preserve the private report's 50-case / 1 MiB presentation limits, existing
  cohort results and distinct comparison references.
- Reuse existing expiry maintenance; add no scheduled report, API or UI.

The user confirmed this complete first batch before implementation. IDs describe
historical configurations; retention through restore grants no present policy or
destination authority.

## Implemented modules and lifecycle

`policyEvaluationCaptureContract.mjs` defines the closed `policy_evaluation.v1`
payload. Its byte admission accounts for PostgreSQL JSONB separator spaces and
expanded numeric exponents, rather than only compact JavaScript JSON size.
`policyEvaluationCapture.mjs` owns per-call collectors and private in-process
receipts. It freezes loaded provenance before scoring, retains raw numeric inputs
separately from final ranks, and binds a minted capture to one exact
classification ID at persistence. Serialized results cannot mint evidence.

The live result carries an enumerable private Symbol handle. In-process object
spreads preserve it, while JSON serialization omits it. This prevents the new
capture from leaking into retained `metadata.policyResult`, retry payloads or
HTTP responses; the only persisted payload is the immutable child record.

`policyEvaluationCaptureRepository.mjs` performs the postcommit first write and
bounded expiry. Migration `20261028_180000_add_policy_evaluation_captures.sql`
adds History cascade, payload/clock bounds, immutable headers, expiry-only
updates, and deletion/truncation guards. Configuration restore does not clear
these child records; portable exports do not include them.

The existing queue-maintenance owner invokes expiry without adding a job or
changing queue admission. Each call clears at most 1,000 expired payloads with
`SKIP LOCKED`. Readers withhold expired payloads immediately even if physical
cleanup has not run. Tombstones remain until their History row is deleted.

| State / failure | Behavior |
| --- | --- |
| Fresh installation or no retained live evaluation | No capture write; private reader reports missing evidence |
| Authoritative bypass or no compatible policy pool | Closed gap record; no fictitious evaluated pool |
| Pool/payload overflow or changed binding | Closed gap; no truncation or replacement capture |
| Diagnostic write failure or crash after History commit | Classification survives; missing evidence is explicit; no reconstruction/retry job |
| Repeated save or lost response | First-write conflict never replaces or refreshes evidence |
| Concurrent expiry | Skip locked rows; later existing maintenance retries remaining rows |
| Cleanup failure or restart | Reader still rejects expired evidence; next maintenance retries safely |
| History deletion | Cascade removes the child; direct child deletion and truncation are rejected |

There are no provider calls, new inference work, new concurrency slots or network
side effects. Postcommit storage uses the existing bounded database connector;
the write adds no unbounded application retry. Capture cancellation/crashes can
leave a gap rather than replaying classification or changing its outcome.

## Private reader integration

Include only validated new captures in the existing explicit private
disagreement CLI mode. Preserve legacy unavailability, confirmation/change
cohorts, scoring denominators, temporal checks, conflicts and connected
holdouts. The policy capture adds diagnostic context; it is not another label or
vote and grants no routing or learning authority.

Keep original automated-destination assessments, experimental ranking arms and
policy evaluation separately named. Preserve whole-cohort validation before
display limits. Omitted cases need explicit counts; omitted or expired evidence
must not appear as an empty successful ranking.

The normal aggregate audit and existing evaluation readers should retain their
contracts. Do not add current policy queries to reconstruct old intent. No new
administrator endpoint, item-level UI, saved report or provider call belongs in
this batch.

The explicit CLI report is now `inventory_prospective_disagreements.v2`.
`policyEvaluationCoverage` describes only its eligible prospective experimental
cohort, including cases later omitted by display caps. Each displayed case has
an available `policyEvaluation` reference or one closed unavailable reason.
Historical-intent/full-ranking availability summaries apply to that scoped
cohort, not all historical classifications. Existing disagreement flags and
scoring denominators are unchanged; a policy snapshot does not add a label or
make previously ineligible outcomes eligible.

`prospectively_frozen` means the provenance categories were recorded, including
`unverified`. It does not establish that purpose rules are known, declared by an
operator or correct for the item. Inspect each candidate's separate provenance
and runtime fields before interpreting the snapshot.

`policyEvaluationCaptureRead.mjs` adds the optional sidecar to this private source
read and validates its exact classification/typed identity, version, clocks,
complete pool and final rank. The SQL includes its text bytes in whole-source
admission before transfer. The ordinary aggregate audit retains its existing
query and input contract.

## Alternatives, pros and cons

| Approach | Pros | Cons / risk | Recommendation |
| --- | --- | --- | --- |
| Freeze retained live evaluation and provenance | Preserves actual policy context; distinguishes declaration from inferred admission | Prospective only; requires binding, retention and payload checks | Agreed first batch |
| Store only the final shortlist | Smaller payload | Hides evaluated exclusions; incomplete pool can mislead | Reject as complete evaluation evidence |
| Reconstruct from current policies | Convenient to query | Changes historical meaning after edits or restore | Reject |
| Store raw intent contracts and prompts | More debugging material | Sensitive values, larger payloads and uncontrolled output | Reject |
| Make diagnostic persistence transactional with routing | Fewer apparent gaps | Diagnostic failure can block a valid classification | Reject |
| Separate immutable child with expiring payload | Explicit lifecycle and first-write boundary | Needs guards, pruning and integration tests | Agreed storage boundary |
| Private CLI integration | Reuses existing privacy and workload boundary | Less convenient than in-app inspection | Agreed first reader |
| Infer historical intent from current media placement | Supplies many weak examples | Placement can be automated, stale or wrong; does not prove historical intent | Separate future observation cohort only |

Recommended stack: live-only per-evaluation minting → closed provenance and
numeric projection → retained-result identity/ranking binding → best-effort
first-write child evidence → expiry tombstone → bounded coherent private read →
validated diagnostic context with explicit gaps. Routing, learning and ranking
formulas remain unchanged.

## Official research checked October 28, 2026

URLs were discovered and read through MCP services. The applications below are
engineering inferences, not conformance or certification claims.

- [W3C PROV-DM Recommendation](https://www.w3.org/TR/2013/REC-prov-dm-20130430/)
  distinguishes entities, generating activities, derivation and time. Model the
  frozen snapshot as evidence generated by a named evaluation stage, with its
  own identity, version and time. This does not require RDF or claim PROV
  conformance, cryptographic authenticity or a complete causal explanation.
- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  documents `ON CONFLICT DO NOTHING` and inserted-row `RETURNING`. Use a unique
  classification binding for the first write, then separately protect updates
  and expiry transitions.
- [PostgreSQL trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html)
  describes row-level enforcement around inserts and updates. Use database
  guards for immutable headers and the narrow payload-expiry transition; test
  replacement attempts against PostgreSQL rather than only mocking SQL.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends purpose-driven event fields, verification of source trust,
  exclusion of secrets and protection of recorded data. Apply a closed field
  projection, bounded values and fixed failure categories to diagnostic evidence
  rather than retaining raw source objects.
- [NIST AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook)
  remains voluntary guidance. Its [Measure guidance](https://airc.nist.gov/airmf-resources/playbook/measure/)
  calls for documented measurements, tools, context and limitations. Preserve
  provenance and explicitly record what this capture cannot measure; do not
  advertise historical error rates or causal conclusions from missing evidence.

W3C provenance guidance is directly applicable to this evidence contract. The
chosen surface is a private CLI, so this batch adds no web interface or WCAG
conformance claim. Any future UI needs a separate privacy/access design and
accessible status and evidence labels.

## Verification plan

Verify complete pools, all exclusion paths, declared/inferred/mixed/unverified
purpose, authority/admission separation, concurrent evaluations, live versus
offline execution, second-pass retention and identity/ranking mutation. Verify
exact large classification IDs, first-write conflicts, binding mismatches,
expiry tombstones, replacement rejection, History cascade and backup exclusion
against the new migration in disposable PostgreSQL 18.

For the private reader, verify malformed/oversized/expired/missing captures,
database-side byte admission, privacy projection, output caps and parity of
existing aggregate results and cohort denominators. Run the repository's
applicable ownership, schema, lint, type, coverage, module and documentation
checks before committing and pushing to main. No release or deployment is part
of this work.
