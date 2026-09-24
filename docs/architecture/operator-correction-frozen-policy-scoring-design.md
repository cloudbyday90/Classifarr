# Frozen policy-scoring replay — design

## Decision and scope

The previous release-pair runner accepted candidate scores, so it could test
only the final policy decision. This increment adds a **v2 frozen evidence
contract** while preserving that v1 mode. The v2 worker runs each version's
actual policy evaluator, preset scorer, profile-score computation, candidate
ranking and decision path on the same bounded inputs. It can expose scoring
regressions, not establish full classifier accuracy. Inventory evidence,
retrieval/RAG matches, AI adjudication, authoritative signals, pattern/history
learning, actual routing and later feedback remain absent. The report keeps
`fullPipelineAccuracy: null` and `promotionAllowed: false`.

The capture path reuses the existing read-only correction screening and
grouped-description sampling. Each fold profile is built without that fold's
held-out descriptions. Captured evidence contains allowlisted media traits,
description text, resolved policy settings, fold-local profile distributions,
source/sample digests, an eligible-correction count, and a digest of each
held-out description set. The pair report includes sampled/eligible coverage. It does
**not** include source media IDs, original membership, feedback narratives,
provider credentials or correction labels in the worker input. The parent
retains labels for exact case pairing. Input schema validation bounds text,
distributions, case/policy/fold counts, JSON depth and size; unknown policy
fields and case fields fail closed. A declared provenance string is not
cryptographic attestation: an arbitrary hand-authored file can still lie
about its origin. Private captures must be made with the capture command and
reviewed as sensitive data.

## Execution boundary

The private capture command sets fatal/no-file logging and a PostgreSQL
read-only session before loading runtime services. Each repository read uses
a repeatable-read, read-only transaction. It reads a versioned
snapshot, prepares a held-out cohort, then re-reads and refuses a changed
source fingerprint before writing an ignored `.tmp/frozen-policy-*/input.json`
file. It invokes no text generation and makes no domain writes. The local
embedding-representation inspection can contact the configured local
embedding service; if unavailable, capture fails. The existing pair runner
requires a clean checkout and the pinned published commit, then sends the
label-free projection to separate offline, read-only, non-root Docker workers
with no database, provider endpoint or credentials. The archived profile
scorer's legacy singleton is redirected only within its disposable worker
and restored after each case; the current scorer uses dependency injection.
No large singleton or production service is changed.

Example after a clean commit:

```text
node server/src/scripts/captureOperatorCorrectionFrozenPolicy.mjs --size=100 --folds=3
node scripts/run-isolated-release-decision-pair.mjs --input-file=.tmp/frozen-policy-.../input.json
```

The first command requires an available, configured local instance and writes
private library data under ignored `.tmp/`. The second command accepts the
committed synthetic v2 fixture for a mechanics smoke without touching live
data. Neither command authorizes a routing or learning change. The same
Docker image ID is used for both versions, but its dependencies are **not**
attested to the published release; `dependencyProvenanceVerified` remains
false. Fold locality is constructed by the capture path but cannot be proved
from a hand-supplied JSON file, so the pair report says only that the fold
profile **schema** passed validation.

## Alternatives and recommendation stack

| Approach | Advantage | Cost / decision |
| --- | --- | --- |
| Continue score-only replay | Smallest, no media text | Misses scoring differences; retain as v1 mechanics mode. |
| Run both versions against the live database | More realistic evidence | Risks changed snapshots, provider fallback and write effects; reject. |
| Frozen, grouped profiles and policy settings in offline workers | Executes real deterministic scoring with one input and explicit omissions | Private capture, legacy scorer bridge, no retrieval/AI; selected intermediate gate. |
| Full released dependency and retriever/AI replay | Closest to deployment | Needs immutable retrieval results, released dependency attestation and provider-safe simulation; next gate. |

Recommended stack: read-only temporally screened correction snapshot →
description-group holdout → bounded v2 evidence + digest → label-blind,
no-network paired scorers → validated private outcomes → aggregate movie/TV
diagnostics → independent review. Do not promote thresholds from this replay.

## Official sources checked in September 2026

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, methods, limitations and conditions similar
  to deployment. That is why omitted sources and unverified dependencies stay
  visible instead of becoming an accuracy claim.
- [PostgreSQL transaction defaults](https://www.postgresql.org/docs/18/runtime-config-client.html)
  documents read-only transactions; the capture also checks the source digest
  again after preparation rather than assuming two reads are one snapshot.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) distinguishes source entities,
  activities and derivation. The source/sample/fold digests are lightweight
  provenance anchors, not an assertion of full PROV compliance.
- [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) informs any future presentation
  of replay status in the Command Center; this increment changes no UI.
