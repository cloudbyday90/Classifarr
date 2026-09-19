# Group evidence readiness and targeted recovery

## Decision (September 2026)

Keep learning library-agnostic. Use validated, exclusive description groups, not
library names, genres chosen by developers, or previous automatic placements.
Distinguish data availability from classification quality: complete metadata does
not prove that two libraries are semantically separable.

The preceding group-term experiment recovered zero additional decisions over 900
cases. Its `group_incomplete_terms` result conflated insufficient repeated words
with common or non-distinctive words. It did not demonstrate missing metadata.

## Bounded implementation

1. Report aggregate reasons that training groups have no usable lexical terms.
   Keep holdouts excluded, thresholds unchanged, and all terms private.
2. Assess identity-checked TMDB observation availability inside validated runtime
   groups. Empty keyword lists and unknown language are legitimate observations,
   not reasons for endless retries. Missing, invalid, or expired observations are
   gaps; descriptionless/conflicting identities remain explicitly ungrouped.
   The readiness-only projection reads at most 4 KiB per observation. Oversized
   records are unknown, not invalid or automatic repair targets; the normal
   enrichment path retains its full validation. No source fields are overwritten.
3. Reuse the existing scheduled enrichment queue. Within each already-eligible
   refill page, alternate a gap-priority item with an ordinary item. Never add
   requests, change queue priority, bypass six-hour retry/30-day cache rules,
   or replace source identity checks and guarded persistence.
4. Publish a private, expiring plan only after source verification. Recheck the
   current row's identity, library, normalized description and due time before
   applying a hint. Source revision changes, cancellation, shutdown and expiry
   disable hints. Failure falls back to ordinary refill ordering.

This refreshes attributable keywords/language only. It does **not** rewrite Plex
metadata, infer missing genres, repair source identities, train an LLM, raise
confidence, change routing, or promise that enrichment resolves genuine overlap.
No new controls, acknowledgements, polling loop, API, or dense UI are introduced.

## Options and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Refresh everything repeatedly | Simple | Wasteful; cannot resolve semantic overlap |
| Raise scores or relax safeguards | Fewer reviews | Conceals uncertainty and risks incorrect routing |
| Readiness + existing bounded recovery (chosen) | Automatic, attributable, fair, reversible | Changes order within a page, not global throughput; completeness is not accuracy |
| New queue or AI repair agent | More flexibility | Duplicates retries, provenance checks and provider cost controls |

Recommended stack: existing PostgreSQL inventory and guarded queue; small ESM
readiness/projection services; scheduler-owned expiring hints; training-only
diagnostics; existing quiet, pausable SWR status surfaces. Evaluate discriminative
metadata in held-out comparisons before granting it any routing authority.

## Official research

- [TMDB append-to-response](https://developer.themoviedb.org/docs/append-to-response)
  supports retrieving related detail resources together. Reuse the current
  provider implementation rather than introducing another request pipeline.
- [AWS retry with backoff](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  distinguishes transient recovery, bounded retries and idempotency. Keep the
  existing retry eligibility and identity-guarded writes; priority is not retry
  permission.
- [W3C WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  addresses automatically updating content. Preserve existing pause controls and
  do not create another continuously changing diagnostic panel.
- [scikit-learn common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)
  recommends learning transformations only from training data. The new term
  diagnostics use the existing copy-excluding training index, not held-out items.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports excluding sensitive content and bounding untrusted log data. Publish
  only allowlisted counts; keep descriptions, terms, provider responses and item
  identity bindings private.

URLs were discovered and read through search/MCP tools on September 19, 2026.
Outcomes and validation are recorded separately in
[group-evidence-readiness-outcome.md](group-evidence-readiness-outcome.md).
