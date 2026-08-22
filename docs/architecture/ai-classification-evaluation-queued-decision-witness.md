# Queued AI Classification Evaluation: Decision Witness Design

Status: Step 3 implemented on 2026-08-22. This document records the secure
queued-ingest extension to the local AI classification evaluation system.

## Objective

`requests` and `webhook-overseerr` currently acknowledge that a task was
queued, then eventually expose a persisted classification-history row. That
does not expose the actual classification outcome produced by the worker. A
grader must not manufacture such an outcome by copying values back out of the
history row: doing so would make response/history consistency tautological.

The selected design records a compact, server-authored decision witness from
the in-memory classification result before history persistence. It later binds
that witness to the task and the persisted history row. The local sweep reads a
narrow, validated projection and deterministically compares the two sources.

The witness is an evaluation artifact, not a routing command, an AI transcript,
or a durable audit log. It contains only task and history identifiers, a
versioned SHA-256 fingerprint, method, status, final-decision confidence and
library selector, and clarification/retry flags. A clarification or retry
stores `confidence` and `library` as `null`, because neither is a final
destination decision. It never contains prompts, provider output,
policy text, tokens, webhook payloads, titles, or routing instructions.

## Official-Source Research

Research was performed on 2026-08-22 using current primary sources.

- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model)
  recommends measuring representative tasks with explicit success,
  completeness, required-evidence, latency, and cost criteria. It also advises
  bounded workflows with explicit schemas and retry limits. The witness gives
  queued evaluations a defined evidence source instead of a synthetic score.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  says data from other trust zones must be treated as untrusted, recommends
  validation and sanitization of event data, and calls for protection from
  tampering and unauthorized access. The design allowlists every witness field,
  hashes a canonical projection, and exposes a server-side read model instead
  of raw queue payloads.
- [NIST SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final) describes sound
  log-management infrastructure and processes in support of audit,
  accountability, and system integrity. The witness is retained only while its
  linked queue task and history record remain, so it supports correlation
  without becoming an uncontrolled evidence store.

## Options Considered

### Reconstruct the response from `classification_history`

Pros:

- no schema, service, or API change;
- immediately makes every queued row look gradeable.

Cons:

- compares persisted history with a reconstruction of that same record;
- cannot detect a worker-to-history persistence mismatch;
- can produce an unjustified pass after an accidental history transformation.

Decision: rejected. It is a tautological evaluation.

### Reuse completed `task_queue.payload.result`

Pros:

- no new table;
- the worker already appends a result object on completion.

Cons:

- combines raw submitted payload and result in a mutable operational record;
- queue retention and generic queue endpoints are not an evaluation API;
- broad queue-path access exposes more than the sweep should receive;
- it does not establish a strict, versioned source contract.

Decision: rejected.

### Dedicated bounded witness record and read-only projection

Pros:

- captures the worker result before classification-history persistence;
- binds one safe projection to a queue task and concrete history row;
- validates and fingerprints the source before returning it to the sweep;
- retains no raw model or webhook content and is automatically removed when
  linked task or history retention removes its parent;
- supports independently comparable queued and direct evaluation cohorts.

Cons:

- requires a migration, persistence hook, repository, read service, route, and
  focused tests;
- a best-effort witness write can be unavailable after a storage error, in
  which case the queued row remains explicitly `not_evaluated`;
- a short-lived sweep credential still needs narrow settings mutations to set
  and restore the local no-route guardrail and model configuration.

Decision: selected.

## Security Design

```text
queue task
   |
   v
worker classification result -- bounded witness builder --> SHA-256 witness
   |                                                          |
   v                                                          v
classification-history persistence <--- database binding --- witness record
   |                                                          |
   +------------------- read-only server projection ----------+
                                  |
                                  v
                    local sweep deterministic grader
                 (witness outcome vs persisted history)
```

### Witness contract

The ESM contract owns a single versioned projection:

```js
{
  version: 'classifarr.classification_queue_decision_witness.v1',
  algorithm: 'sha256',
  fingerprint: '<64 lowercase hex characters>',
  queueTaskId: 42,
  outcome: {
    status: 'completed',
    method: 'ai',
    confidence: 91,
    library: { id: 7, name: 'Movies' },
    needsClarification: false,
    needsRetry: false,
  },
}
```

The SHA-256 value covers the version, queue task ID, and entire bounded
outcome. The `classification_id` is a database association made after the
history row exists; it is returned by the read model but is not substituted
into the pre-persistence source projection.

The builder accepts only a positive queue task ID; identifier-like method and
status values; finite confidence in `0..100`; a library with both a positive ID
and bounded sanitized name for final outcomes; and strict booleans. Non-final
outcomes must instead have `null` confidence and library projections. It fails
closed and does not create a witness for malformed input.

### Storage and retention

`classification_queue_decision_witnesses` stores the validated JSONB witness,
fingerprint, queue task ID, classification ID, and timestamp. Its composite
primary key permits a retried task to retain the witness bound to each history
row. Foreign keys cascade on queue-task or history deletion, aligning witness
retention with the existing seven-day default task-queue retention and current
history retention policy. No new broad cleanup job or user-facing history
surface is introduced.

The worker writes the bounded witness best-effort after history persistence:
a logging/evidence-storage failure must not roll back a valid classification or
cause an external retry that duplicates a decision. The absence of a witness is
observable and fails the queued evaluation rather than being guessed.

### Read boundary and least privilege

`GET /api/queue/tasks/:id/decision-witness` returns either a compact validated
witness plus its bounded persisted-history projection, or a fixed
`available=false` reason. It does not return `task_queue.payload`, raw webhook
logs, raw history metadata, policy data, or model output.

The exchanged local-sweep token moves from prefix-only authorization to exact
method-and-route grants. It permits only the harness's required `GET`, `PUT`,
and `POST` endpoints. In particular, it permits read-only queue lifecycle and
witness routes but cannot use the existing queue mutation endpoints. This
removes the broad `/api/queue` prefix from the temporary credential.

### Evaluation behavior

- Direct execution continues to grade the bounded HTTP classification response
  against independently persisted history.
- Queued execution polls the witness endpoint for its submitted `taskId` and
  uses its bound `classificationId`/history projection. A valid witness is
  graded against history with the same deterministic fixture evaluator.
- Invalid or unavailable witness data produces explicit `not_evaluated` reason
  IDs and a failed sweep row for a versioned fixture. Queue lifecycle, no-route,
  and contamination checks remain active.
- The runtime fingerprint records the witness version and fingerprint for
  queued rows, ensuring a witness change creates a new comparison cohort.

## Final Recommendation Stack

1. Use the dedicated bounded witness as the only queued worker-result source
   for deterministic fixture grading. Never reconstruct the response from
   history or generic queue payload.
2. Fail closed for malformed or unavailable witnesses while allowing normal
   classification processing to complete; report evidence capture degradation
   separately from a routing or provider failure.
3. Enforce exact method-and-route grants for short-lived local sweep tokens.
   Keep model/no-route setting changes explicit and restore them in `finally`.
4. Keep task/history foreign-key retention and avoid a second long-lived
   evaluation store. Treat the witness as local, bounded correlation evidence.
5. Compare queued results only within matching fixture, policy, runtime, and
   witness fingerprint cohorts. Review human-authored fixture changes before
   interpreting a changed score as a model regression.

## Implementation Outcome

- `classificationQueueDecisionWitness.mjs` owns canonical bounded witness
  construction and fail-closed validation.
- A dedicated repository, read service, migration, and queue route bind and
  return only task/history identifiers, witness data, and a compact history
  projection. Foreign keys remove witnesses with either retained parent.
- Classification persistence records the witness best-effort only after a
  history ID exists; an evidence-write failure is logged without undoing the
  classification.
- The local sweep polls the submitted task's witness endpoint in queued modes,
  grades it against the bound history projection, and marks unavailable or
  invalid witness evidence as a versioned-fixture failure.
- Focused tests cover canonicalization, tamper rejection, safe reader output,
  route validation, scoped authorization, and queued grading.

## Next Recommended Item

After the queued witness is proven in local sweeps, add a reviewed trend-baseline
artifact that compares approved fixture cohorts across model, policy, and
witness fingerprints. It should report deltas and required human review without
creating an automatic deployment or routing authority.
