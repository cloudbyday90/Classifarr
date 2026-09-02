# Automatic Exact-Item Learning Design

## Decision

Classifarr now records an exact-item learning signal automatically after an
authenticated operator confirms a destination or chooses a different eligible
destination for a completed runtime question. The signal is limited to
the stable media identity and the already-recorded final destination. It does
not create, edit, or broaden a policy.

This removes the former second, manual `exact-item-memory` action from the
normal confirmation path. The endpoint remains an idempotent recovery path for
an interrupted request, not a routine operator task.

## Why this is the next slice

Classifarr already has two deliberately separate forms of library
understanding:

1. Current-library semantic retrieval compares an item against embeddings for
   existing items in policy-eligible libraries. Its result is advisory.
2. The guarded exact-item-memory writer retains an operator-confirmed, stable
   item-to-library association.

The second capability existed but needed a second post-resolution request. That
created needless operator work and prevented a normal confirmation from
immediately improving future exact identity matches. Manual corrections already
record exact-item memory through a guarded transaction, so runtime confirmations
now follow the same outcome-learning model.

## Boundaries and flow

```text
authenticated Confirm / Change destination
  -> resolve and persist final runtime outcome
  -> commit the resolution transaction
  -> validate locked state + stable TMDB ID + typed answer contract
  -> guarded, idempotent exact-item-memory command
  -> future exact identity evidence; semantic retrieval remains advisory
```

The automatic action is eligible only when all of these hold:

- The resolution succeeded.
- The action is `confirm_destination` or `change_destination`.
- The actor is authenticated.
- Existing locked-state checks find a completed/routed item, matching final
  destination, supported media type, stable TMDB ID, and valid answer contract.
- Existing admission and authorization checks approve the server-derived intake.

`route_not_applicable`, unauthenticated actions, invalid/stale state, and
failed admission do not learn. Learning is a separate, best-effort follow-up:
it cannot reverse the committed route decision.

## Security and privacy

The service delegates writes to the existing authorized-outcome command instead
of accepting browser-provided learning data. That command locks the
classification and destination, revalidates the actor, verifies the recorded
outcome, and claims a deterministic source receipt. Replays cannot create a
second record.

The returned status contains only a fixed status and fixed reason codes. It
does not expose media descriptions, prompts, model output, embeddings, library
contents, or the exact memory value. An unexpected persistence problem logs
only a classification identifier and fixed reason code.

This follows continuous measurement and outcome traceability from the
[NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) and
[NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf).
It also follows [OWASP LLM08: Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
by constraining and validating data entering retrieval systems.

## UI and accessibility

No new control, approval checkbox, or persistent evidence panel is added. The
chosen routing action remains the single intentional action. A future UI may
show the compact automatic result as a passive status message, but it must not
interrupt focus, change context, or duplicate the route confirmation. This is
consistent with [WCAG 2.2 Success Criterion 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

## Options

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep a second manual memory action | Maximum explicitness | Friction; high-quality outcome signal is often lost | Rejected |
| Auto-write broad policy preferences | Influences more future items | One item can overgeneralize and misroute unrelated media | Rejected |
| Auto-write guarded exact identity memory | High-confidence local learning; idempotent; no policy rewrite | Helps only future exact matches; needs stable metadata | Selected |
| Let RAG/AI write memory | May capture semantic nuance | Probabilistic output can be wrong, stale, or poisoned | Rejected |

## Recommendation stack

1. **Exact identity memory:** automatic only after a final authenticated
   operator outcome, with authorization, lock, receipt, and admission checks.
2. **Semantic retrieval:** keep embeddings and current-library similarity as
   bounded advisory evidence for similar—not identical—items.
3. **Evaluation:** use aggregate, redacted outcomes to measure RAG usefulness
   before granting it wider authority.
4. **Policy authority:** retain declared policy and deterministic safeguards as
   the only automatic-routing authority.

## Follow-up

The next high-value component is **outcome-weighted semantic retrieval**:
refresh destination profiles/embeddings after confirmed outcomes and use only
aggregate, provenance-tagged confirmed outcomes to calibrate advisory semantic
ranking. It must not change thresholds or route media until evaluation gates
show reliable improvement.
