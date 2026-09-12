# Learned candidate shortlist design

## Problem and decision

Commit `8e7c79e8` supplies learned inventory fit to live AI comparison, but the
comparison contract has already taken the first three policy-ranked libraries.
A better-fitting fourth candidate therefore cannot be compared. Move bounded
profile learning before this cutoff, without changing policy eligibility.

The policy engine already excludes hard-constraint conflicts before returning
its ranking. Build the full active, same-media candidate pool from that ranking
and the supplied libraries. Never add a library just because inventory learning
finds it. Keep the policy leader in slot one and fuse policy order with positive
learned-fit order for the alternative slots. Negative or missing fit is not a
hard exclusion; no usable fit preserves the baseline exactly.

## Architecture and boundaries

Extract the existing contract's uncapped eligibility projection for reuse.
Keep the public comparison contract capped at three. An optional internal order
must be a complete, duplicate-free permutation of that eligible pool with the
same leader; otherwise ignore it. This order is not a client API input.

A small ESM shortlist service reads learned profiles from a current read-only
inventory snapshot, using the preceding component's query/copy exclusions and
versioned learner. It makes no embedding or generation calls. Respect the saved
RAG switch, verify it again after reading, and fall back to the unchanged baseline
on cancellation, invalid identity, missing metadata, unavailable storage, or
budget failure. Pools of at most three need no new read or work; pools over 64
are not partially reranked. Reuse the existing AI-mode resolver: outcomes that
forbid AI comparison do not trigger learning. `prompt_select` may still compare
candidates while requiring human confirmation; that review flag is not an AI
veto. Preserve this distinction instead of adding a second interpretation.

Reuse reciprocal rank fusion with constant 60 for the alternative rankings.
Do not add raw fit to policy scores or present RRF as confidence. Validate every
profile's supported version, finite numeric fields, and consistent snapshot
fingerprint before reranking. No raw profile terms or fingerprint are passed to
AI by the shortlister. The existing live provider projection still governs
subsequent evidence delivery.

Keep the original policy result, action, confidence, and ranking unchanged.
Only the advisory comparison contract changes. Use the selected comparison
identities for the accompanying exact-inventory comparison, so competing evidence
describes the same set. Routing authorization, strict verification, and final
response validation remain authoritative. No source metadata, policies, or
historic classifications are rewritten.

## Pros, cons, and recommendation stack

| Approach | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep first three policy candidates | Cheapest; unchanged behavior | Can miss a strong library before AI runs | Fallback |
| Compare every library in the prompt | More destinations visible | Context/latency growth and ambiguity | Not selected |
| Learned alternatives with a retained leader | Recovers candidates while retaining policy comparison | Observational bias; one extra bounded snapshot | Implement and measure |
| Replace routing confidence with fit | Immediate apparent automation | Uncalibrated scores and incorrect routes | Reject |

Stack: hard eligibility → full candidate pool → retained policy leader + fused
learned alternatives → three-candidate evidence/AI comparison → existing routing.
Learning remains library-agnostic and does not require purpose declarations.
Names are display data, not features in the shortlist ranker.

## Validation and UI

Test recovery from below the cutoff, leader retention, stable ties, unchanged
scores, duplicate/unknown/inactive/wrong-media exclusion, malformed or stale
profiles, disabled RAG, no-op small pools, cancellation, and fallback. Exercise
the production policy path, real PostgreSQL reads and local Compose. Evaluate
at least 100 held-out items with recovered and newly missed placements reported
separately; existing placements are not ground truth.

No UI controls, purpose forms, or warning panels are needed. W3C status-message
guidance applies if a later UI exposes progress: keep it concise, accessible,
and non-interrupting. This change does not rerun old reviews automatically.

## Official research and date boundary

Search-discovered official sources were read September 12, 2026. These living
pages are not certified archived August 2026 snapshots.

- [Elastic RRF](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
  describes merging rankings with different relevance scales before pruning.
  We reuse the existing local implementation; no Elasticsearch dependency.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
  supports fitting learned features without the evaluated examples.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports bounded retrieval, current scope checks, and independent enforcement
  of output constraints rather than relying on model instructions.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains non-focus-taking accessible status and warns about chatty interfaces.
