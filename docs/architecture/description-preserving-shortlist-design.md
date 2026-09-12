# Description-preserving candidate selection

## Problem and scope

Commit `851d959c` added an evaluated selective recheck without changing live routing.
Its fresh cohort exposed a separate bottleneck: metadata fusion recovered two
observed destinations but discarded four present in the description-only shortlist.
Existing positive-only RRF gives even a tiny positive metadata fit a second rank
contribution. This can displace the strongest synopsis match before AI sees it.

This component preserves one usable description leader, not a hardcoded library,
genre or destination. It changes candidate selection, never scores or authorization.

## Fixed design

Use one pure ESM helper for benchmark and live selection. Validate the complete
2–64-candidate description scope: unique valid IDs, complete indexing, finite cosine
scores, bounded distinct descriptions and known membership sharing. Rank each
candidate by its mean of up to three nearest descriptions. Empty libraries have no
support; short libraries still compete and cannot manufacture a winner elsewhere.

Preserve a description leader only when it is uniquely strongest, has three
non-shared examples and positive mean similarity. This admits a candidate for
comparison; it is not evidence sufficient to route. Exact ties, malformed scope,
partial indexing and unavailable retrieval do not produce an anchor.

Keep the first two learned-order choices (including the live policy leader) in
place. Only if the description anchor is absent from the first three, move it into
the third slot. Do not reorder an already sufficient shortlist. The provider still
receives at most three eligible libraries: the policy leader, the best fused
alternative and the rescued description option, without duplicates.

The live shortlist reuses the existing bounded local description retriever for
the whole eligible pool. Its same-snapshot learned profiles replace a separate
profile query when usable. If description retrieval is unavailable, retain the
existing metadata-only path within the same cancellation/time budget; never use
an unrestricted model fallback. Missing query metadata must not suppress useful
description retrieval. RAG disabled, invalid identity and non-reviewable policy
actions still do no retrieval work.

The benchmark opt-in uses the same anchor helper after learned ranking. Its
baseline is description-ranked, whereas production retains a policy leader;
explicitly distinguish these populations rather than claiming identical recall.
Report shortlist gains/losses against both description-only and unprotected learned
ranking. Reuse grouped folds and existing read-only snapshots. No generation is
needed to measure candidate recall; do not confuse it with routing accuracy.

## Research, recommendations and tradeoffs

Official sources were discovered with search and opened September 12, 2026.
The primary RRF paper predates August 2026. Current OWASP/W3C pages are not asserted
to be archived August snapshots.

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Preserve one synopsis leader | Prevents metadata from removing the best usable description option; no extra generation | A synopsis match may be wrong; one of three slots is reserved | Implement |
| Increase candidate count | Retains more hypotheses | Changes provider contracts and token costs | Keep the current cap for this component |
| Replace metadata fusion entirely | Could retain every description-only option | Loses organically learned metadata recoveries | Retain fusion for remaining choices |
| Add manual library declarations | Explicit operator intent | More setup and less library-agnostic behavior | No new forms or acknowledgement |

The [original RRF paper](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf) defines
rank fusion rather than confidence calibration. Preserving source representation
at a tiny shortlist cutoff is our design inference, not a guarantee from that paper.

[OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
supports scoped retrieval, treating text as untrusted, and authorization outside
the model. An invalid retrieval cannot expand the policy-owned candidate set.
Existing deterministic policy fallback remains valid, not model-only inference.

[W3C WCAG 2.2 status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
supports non-focus-stealing updates and avoiding chatty interfaces. This internal
ranking change needs no additional panel, refresh control or user interaction.

## Validation and final recommendation stack

Test tiny-positive metadata displacement, policy/description leader overlap,
renaming and input-order invariance, mixed media, duplicate/out-of-scope IDs,
partial indexing, shared examples, cancellation, disabled RAG and unchanged scores.
Use PostgreSQL integration plus local Compose replay of the previous development
cohort and a new non-overlapping cohort. Keep private media content out of reports.

Stack: policy eligibility → description retrieval and organic metadata profiles →
description-preserving three-candidate shortlist → existing AI comparison →
unchanged routing safeguards. Selective anonymous rechecking remains experimental.
