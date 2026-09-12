# Live learned library profile outcome

## Delivered behavior

Live AI candidate comparison now receives contrastive metadata fit learned from
current inventory, alongside actual retrieved descriptions. The preceding
commit `854a5b3d` provided only a benchmark consumer. This implementation connects
the same learner to the live description retrieval and provider packet path.

Learning discovers arbitrary libraries from membership and metadata. It does not
require a purpose declaration, genre-to-library mapping, or new settings. Movie
and TV evidence remain separate. Fresh read-only snapshots automatically reflect
inventory changes at the next comparison. Versioned source fingerprints identify
the private evidence snapshot; no persistent profile cache can be served stale.

Current and stored query synopses, including conflicting copies, are excluded
from both profile fitting and example retrieval. Existing placements are weak
observations, not verified labels. Learned fit is signed relative evidence, not
a confidence percentage, an independent second vote, or permission to route.

## Design and security outcome

- Small ESM modules isolate profile construction, query-copy exclusions, and
  provider projection. The existing statistical learner is reused unchanged.
- The corpus query explicitly opts into metadata for this consumer; other
  description-only callers retain their previous SQL projection.
- Description examples and learned metadata come from one bounded read-only
  repeatable-read transaction. The profile has no cross-request retained state.
- Provider projection strips feature maps, fingerprints, identities, and unknown
  fields. Only version, status, training count and numeric fit are added. Existing
  local-only snippet disclosure rules are unchanged.
- Missing features are neutral. Profile budget failures omit the profile rather
  than replacing usable description evidence or publishing a partial model.
- No database migration, metadata rewrite, policy edit, public API, user-facing
  warning panel, or new acknowledgement was introduced.

## Local observations

These probes were read-only with respect to classification, policy, metadata,
and routing. They are smoke/performance checks, not accuracy measurements.

| Probe | Observed result |
| --- | --- |
| Live Compose retrieval | Available evidence for all 3 supplied candidates |
| Learned movie population for that query | 5,001 distinct training descriptions |
| Complete description coverage | 2,808/2,808; 1,240/1,240; 29/29 |
| Relative fits in candidate order | -0.53; 0.8605; 0.5613 |
| End-to-end retrieval time | 1,559 ms for this smoke query |
| Seeded 100-title profile fitting probe | 100/100 complete candidate packets |
| Profile-only fit latency | Mean 28 ms; p95 52 ms; min 10 ms; max 64 ms |
| Model calls in fitting probe | 0 |
| Local provider packet smoke | `gemma4:e4b`; valid proposal, no abstention or output-limit hit |
| Generation time for packet smoke | 5,417 ms |

The performance probe used `classifarr-profile-20260912`, the existing seeded
description sampler, and a frozen inventory corpus. Each fit held out its query
and synopsis copies, as live retrieval does. It did not produce 100 new model
classifications. The provider smoke used three supplied same-media candidates
and the actual comparison formatter, not a full production routing transaction.
Neither probe establishes improvement in correct routing or fewer reviews.

The final image was rebuilt and Compose reported healthy. SHA-256 values of the
four new/changed core runtime modules matched the corresponding workspace files.

## Verification

- Relevant PostgreSQL integration: 3 suites, 11 tests passed.
- Final targeted service and code-health checks: 6 suites, 23,616 tests passed.
- Backend lint/typecheck and ESM static-import/mock-shape checks passed.
- Final full backend coverage run: 1,224 suites and 34,685 tests passed.
- Backend coverage: statements/lines 90.00%, branches 81.23%, functions 92.12%.
  The coverage ratchet passed using the fresh backend report and the existing
  unchanged client report. No client files changed.
- The first full run found a test-file closing-line convention failure. It was
  corrected and the entire suite rerun successfully against the final code.
- Markdown lint passed across 1,248 files; `git diff --check` passed.

## Recommendation stack and limitations

The [design](live-learned-library-profile-design.md) records official-source
research, W3C considerations, alternatives and their pros/cons. Sources were
checked September 12, 2026; living documents are not certified August archives.

Recommended stack: current inventory discovery → query-excluded profile learning
and description retrieval → AI comparison → existing constrained routing. Fitting
on demand keeps refresh simple and measured CPU modest; the tradeoff is repeated
work per comparison and dependence on the existing local retrieval path. A
durable cache is not justified by this probe alone.

This does not fine-tune LLM weights, automatically rerun historic reviews, adjust
policy-score thresholds, or allow fit to override hard constraints. Missing local
embedding configuration or failed retrieval still prevents this consumer from
supplying learned evidence. UI layout and client API contracts are unchanged.

Next high-value component: use these learned profiles to improve the eligible
candidate shortlist before the three-candidate AI limit. The correct library
cannot win if it never reaches comparison. Validate that live selection path on
at least 100 held-out titles, reporting candidate recall, contradictions,
abstentions and review burden separately from confidence and true accuracy.

## PR, CI and release scope

GitHub MCP returned no open Classifarr PRs for random selection. No PR could be
implemented from that empty set, and none was merged. No release or tag is made.
The separate production naming gate still reports 26 references against a zero
baseline, unchanged from before this component. Do not claim all CI gates pass.
