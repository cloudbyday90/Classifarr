# Current-Library Semantic Self-Match Exclusion Design

Status: implemented on 2026-09-10. Official guidance was reviewed on that
date against the requested August 2026 baseline.

## Problem

Classifarr's candidate-scoped semantic retriever compares an incoming item
with embeddings for the current contents of only the policy-eligible
libraries. Before this change, when the incoming item already had a stable
TMDb identity in the embedding index, the query could retrieve an earlier
historical representation of that very same item. A prior placement could
therefore appear to be independent semantic corroboration.

That is especially misleading for a retry of a bad placement: the system may
be asked whether a disaster documentary belongs in a comedy collection while
the prior comedy-associated representation remains the closest semantic row.
It is not a useful library-fingerprint comparison.

The existing held-out study path already excluded its full cohort. The live
candidate-scoped path did not apply the narrower, per-item exclusion.

## Decision

Advance the semantic-retrieval protocol from v2 to v3 and make one
parameterized read change:

```text
incoming stable identity
  -> same-media historical rows with that identity excluded
  -> embeddings of other current items in policy-owned candidates
  -> bounded advisory semantic evidence
  -> existing AI comparison or operator review
```

- A positive incoming TMDb ID is carried only in the ephemeral server-owned
  retrieval request.
- SQL excludes all same-media rows with that identity before nearest-neighbor
  ranking. A missing stable identity uses a `NULL` guard and preserves the
  prior bounded comparison rather than inventing an exclusion.
- The response exposes only a Boolean that an identity was excluded; it never
  exposes the identity itself.
- The prompt calls these results **independent current-library semantic
  matches** only when that guard ran. This prevents an LLM from treating a
  prior placement as independent proof.
- v3 deliberately invalidates comparisons captured under v2 for any future
  measured study. Retrieval protocol changes form a new evaluation cohort.

No policy score, confidence threshold, candidate membership, AI provider
scope, policy record, learning record, retry behavior, or routing authority
changes. Existing candidate-scoped semantic evidence remains advisory.

## Research Basis

[OWASP's RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
requires provenance, retrieval-time controls, bounded data handling, and
output validation. Removing a candidate item's own historical representation
prevents a provenance-confused result from being treated as corroborating
evidence, while the query stays policy-scoped and parameterized.

[NIST AI RMF Measure guidance](https://airc.nist.gov/airmf-resources/playbook/measure/)
calls for documented metrics, representative evaluation, and continual
assessment. Bumping the retrieval protocol version makes old and new study
results incomparable by design instead of silently blending them.

[W3C WCAG 2.2's Status Messages guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
supports concise, programmatically understandable status without disrupting
work. This change avoids a new diagnostic card; the existing review UI stays
quiet, while the provider receives an unambiguous bounded evidence label.

## Options

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep self matches | No query change. | Earlier mistakes can reinforce themselves. | Reject. |
| Exclude every item without a stable identity | Appears strict. | Drops useful evidence without a reliable exclusion key. | Reject. |
| Exclude the incoming stable identity and version the protocol | Removes circular support while preserving bounded retrieval and honest study cohorts. | Some candidates will have fewer results; prior v2 study packets cannot be combined with v3. | Adopt. |
| Use semantic relevance to route automatically | Fast apparent resolution. | The independent labelled study is still not ready; probabilistic evidence would gain routing authority. | Reject. |

## Security Boundary

- The candidate list remains server-owned and capped by the existing contract.
- The incoming identity is a typed SQL parameter, used only as a comparison
  exclusion; it cannot select a library or alter scan limits.
- The response projects no TMDb ID, embedding, prompt, description, provider,
  or model output.
- Missing identifiers fail safely to the established advisory behavior rather
  than using title similarity as identity.
- The query remains read-only; all mutation, routing, and learning authority
  remains outside this component.

## Recommendation Stack

1. Use v3 self-match exclusion for every candidate-scoped semantic comparison.
2. Keep the existing outcome-backed purpose draft as the only low-friction
   learning path from repeated operator choices.
3. Capture a new, independently labelled held-out v3 study before allowing
   semantic disagreement to change any live review behavior.
4. If that study meets its conservative error profile, test semantic
   counter-evidence only as a candidate-comparison or review trigger.
5. Keep automatic routing deterministic and separate from semantic evidence.
