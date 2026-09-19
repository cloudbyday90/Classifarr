# Coverage-preserving multi-scale retrieval design

## Decision and scope

September 19, 2026. The previous community-only experiment left 194 of 300 queries
unsupported. Implement one reusable retrieval profile that retains raw items and
broad groups, with local groups as optional context. Do not replace routing,
combine correlated scores into confidence, add acknowledgements or add UI panels.
This is an offline admission step for a context provider, not another classifier.

## Frozen protocol

Before observing the next cohort, freeze `inventory_multi_scale_context_v1`:

1. Exclude all copies of held-out hashes before fitting. Reuse current validated
   broad profiles and the previous content-only community fitter unchanged.
2. Keep every same-media library, including sparse/unavailable alternatives.
   Retrieve three raw exclusive examples per candidate. Keep shared descriptions
   separately, once; they never become an exclusive vote.
3. Include three representatives from the nearest available broad group. A local
   group is eligible context only when it contains a retrieved raw example and
   has positive query similarity. Include at most one such group's three examples.
4. Merge examples by description hash and record their origins. Keep all raw
   examples; at most nine distinct examples per candidate. Broad/local context
   does not change ranking, confidence, thresholds or route authorization.
5. A missing local group adds no new abstention. A failed optional discovery fit
   returns raw/broad context, is not cached, and can recover on a later request.
   Mandatory source/control corruption still fails closed. Cancellation never
   becomes a successful degraded result.
6. Cache only completed private profiles: one entry, 256 MiB accounting budget,
   five-minute lifetime. Key by protocol, embedding model/digest/dimensions,
   exact source vectors, complete media/library membership and held-out hash set.
   Names and metadata are not features. Never reuse a different source/holdout.
   Same-key concurrent requests share one build; different-key concurrent builds
   are rejected as busy rather than queued without bound. A cancelled waiter does
   not cancel other waiters; when all leave, abort and never publish the result.
7. Measure a new 300-description cohort, five folds, seed
   `classifarr-profile-20260912`, excluding prior sizes
   `300,300,100,100,300,300,300`. Revalidate source and embedding identity at exit.
   No new embedding or generation calls, database writes or routing mutations.

Parameters are an explicit experimental budget, not universally optimal values.
Do not tune them on the evaluation cohort. Existing placement is not truth;
independent labels remain zero and accuracy remains null.

## Measurement and failure handling

Require zero lost raw examples, duplicate merged examples, omitted candidates or
added community-related abstentions. Report movie/TV slices, ungrouped nearest
items, added context, shared evidence, cold-build/warm-cache time and fit reuse.
Preserve the broad-only decision exactly; unchanged decisions are a safety
invariant, not an improvement in routing accuracy.

Report representative similarity excluding each member's own hash. This fixes
the trivial self-match in three-member groups. It is a non-self training geometry
diagnostic, not a full leave-one-out refit or independent semantic validation.
Outer held-out queries remain excluded from both fitting and representatives.

Reuse input/work limits, the bounded graph, cooperative cancellation and the
existing isolated broad-fit worker. Clone owned inputs, expose fresh query results
without vectors, and retain no query data in cache. Limit concurrent waiters and
log only aggregate status; no titles, descriptions, identities or credentials.
Optional build failures never become sticky cache entries. Changed source data
invalidates evaluation; do not disable automatic recovery to obtain a clean run.
Preserve source vector values when calling the existing fitters; they already
normalize internally. Normalize separately for retrieval and diagnostics so an
extra preprocessing pass cannot perturb the control's floating-point geometry.

## Official research and alternatives

Sources discovered through search/MCP and opened September 19, 2026:

- [LlamaIndex auto-merging retriever](https://developers.llamaindex.ai/python/framework/integrations/retrievers/auto_merging_retriever/)
  illustrates retrieving specific units with larger surrounding context. Here,
  broad/local groups are overlapping views of library descriptions, not literal
  document parents; this is an adaptation, not that algorithm or dependency.
- [Elastic reciprocal rank fusion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
  combines ranked result sets. It is not selected here: three views derived from
  the same embeddings do not constitute independent corroboration. First preserve
  and deduplicate context; a learned ranker would need separate validation.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
  supports fitting on training data only and keeping evaluation data separate.
- [Node worker documentation](https://nodejs.org/api/worker_threads.html)
  documents isolated workers and resource limits. Retain the existing Node 24
  worker contract; no newer runtime API or version change is introduced.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports bounded diagnostics and excluding sensitive payloads and credentials.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports accessible updates without moving focus. There is no user action to
  add for this component; preserve existing SWR and status behavior. Future status
  should summarize recovery, not expose internal evidence counters by default.

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| Replace broad groups with local groups | Fine-grained neighborhoods | Demonstrated coverage loss; rejected |
| Fuse three rankings now | May change destination ordering | Correlated evidence and unvalidated weights |
| Preserve raw/broad evidence and append deduplicated local context | Full retrieval coverage, traceable detail, graceful optional failure | More context and expensive cold fitting; no routing gain by itself |
| Approximate graph/index now | Potentially faster cold fit | Recall uncertainty before downstream value is established |

Recommended stack: validated inventory and automatic recovery → cached vectors →
source-bound broad/raw retrieval → optional local context → bounded downstream
comparison → unchanged routing safeguards. Test context usefulness before enabling
any downstream decision change. Do not add another user-managed workflow.
