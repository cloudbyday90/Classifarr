# Metadata-aware candidate selection design

## Scope and decision

The prior 100-title investigation found three observed destinations absent from
the description-only shortlist. More examples cannot select an omitted library.
Implement a controlled metadata-ranking experiment in the existing benchmark,
not an unmeasured replacement of live policy selection.

The live description retriever consumes a two/three-library policy contract and
explicitly cannot expand it. This component does not bypass that boundary.
The new `--metadata-candidates` CLI option changes only offline candidate ranking;
it adds no UI setting, acknowledgement, dependency, schema, or routing change.

## Implementation

Read genres, studio, and content rating with the same bounded, repeatable-read,
read-only corpus snapshot. Normalize at most 32 genre strings and 160 characters
per field; reject conflicting metadata for one stable identity. Preserve missing
values as missing rather than guessing them from titles or library names.

For each same-media library, score distinct, non-held-out inventory descriptions
by genre Jaccard similarity plus exact normalized studio agreement. Sum the best
three positive matches and divide by three so a lone match does not masquerade
as three supporting examples. Conflicting metadata for duplicate descriptions
contributes no match. Ratings concern audience and do not imply genre or purpose;
they are retained privately but do not contribute ranking points.

Fuse the synopsis and positive metadata rankings using reciprocal rank fusion
with constant 60 and equal channel weights. Equal metadata scores share a rank;
remaining ties retain synopsis order. No metadata matches means exact synopsis
fallback. Keep the existing three-candidate limit and unchanged model prompts,
example budgets, model configuration, and held-out cohort.

These are experimental defaults, not calibrated confidence scores. Metadata can
be generic, incomplete, incorrect, or reflect earlier misplacements. Genre/studio
agreement is not proof of user intent. No anime detector, binding library-name
heuristic, or automatic label creation is introduced.

## Evaluation and security

Exclude all sampled description hashes from both retrieval channels, including
copies with different identities. Query membership is used only for sampling and
observational evaluation, never as a feature in metadata ranking. Keep the
description-only baseline reproducible and fingerprint metadata plus algorithm
version only for the experimental mode. The cohort fingerprint remains comparable.

Report changed shortlists, recovered and newly missed observed destinations,
missing query metadata, and baseline placement misses
alongside the trial's placement misses and existing model metrics. Inventory
agreement is not accuracy. Check aggregate regressions as well as individual
recovered candidates before considering any live integration.

All new matching is deterministic and local. Existing SQL timeouts, cache bounds,
provider checks, prompt boundaries, strict output parsing, and private report
allowlists remain. Metadata strings are not interpolated into SQL or model
instructions, nor emitted in public reports. No external metadata call occurs.

## Alternatives and recommendation stack

| Option | Benefit | Limitation | Decision |
| --- | --- | --- | --- |
| More synopsis examples only | Existing implementation | Cannot recover omitted libraries | Keep as baseline |
| Hard-coded genre/library-name rules | Simple for familiar names | Ignores custom intent and missing metadata | Reject |
| Metadata plus synopsis rank fusion | Uses existing structured evidence without new inference | Can amplify generic matches or bad placements | Benchmark here |
| Declared-intent-aware eligibility and overlap handling | Honors actual destination purpose | Requires provenance and live contract integration | Follow up after measured results |

Recommended stack: immutable inventory snapshot → held-out synopsis and metadata
retrieval → rank fusion evaluation → validated declared-intent comparison → live
candidate integration only when supported by regression evidence. Do not increase
confidence or reduce confirmation thresholds based on inventory agreement alone.

## Official sources and date boundary

Sources were discovered through search and opened on September 12, 2026. Their
living contents are not certified archived August 2026 snapshots; no future-dated
research is being presented as an August baseline.

- [Elastic reciprocal rank fusion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
  describes combining independently ranked results. This implementation borrows
  that method; it does not add Elasticsearch or assume domain-specific gains.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports preserving retrieval boundaries, bounded context and output validation.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html?source=post_page---------------------------)
  cautions against unnecessarily chatty feedback. No new UI is needed for this
  experiment; future status should remain concise and programmatically accessible.
