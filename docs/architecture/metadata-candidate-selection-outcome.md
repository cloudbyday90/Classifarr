# Metadata-aware candidate selection outcome

## Implemented

Added an opt-in, modular ESM metadata candidate ranker and integrated it into the
existing offline benchmark. Default description-only behavior and live routing
remain unchanged. The metadata snapshot shares the corpus transaction; no new
provider, database migration, setting, or user acknowledgement is required.

```powershell
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-budget-20260911 --size 100 --generate-cases 100 --metadata-candidates --max-minutes 20
```

Omit `--metadata-candidates` to reproduce the baseline. Public reports contain
aggregate metadata coverage and shortlist changes, not private genres, studios,
ratings, titles, descriptions, or identity-level hashes.

The [design](metadata-candidate-selection-design.md) records algorithm choices,
security boundaries, pros/cons, official research, and the recommended stack.

## Local comparison

On September 12, 2026 the local trial completed 300 valid proposals, with no
abstentions, malformed outputs, context rejections, or provider failures.

| Metric | Description baseline | Metadata trial |
| --- | --- | --- |
| Sampled titles | 100 | Same 100 |
| Missing observed destinations in shortlist | 3 | 1 |
| Inventory agreement, 9 examples | 78/100 | 79/100 |
| Inventory agreement, 30 examples | 78/100 | 83/100 |
| Inventory agreement, 100 examples | 77/100 | 80/100 |

The trial changed 21 shortlist sets; no query lacked both usable genre and studio
metadata. Generation mean latency was 293, 331, and 812 milliseconds respectively;
the 9-example arm included a 5.3-second outlier. These are single local-run
measurements, not a general performance guarantee or confidence calibration.

All three original omissions were recovered, but one new omission appeared.
Private inspection of that case found animation/drama genres and an animation
studio in local metadata. The issue is therefore not simply absent metadata:
generic overlap and the fixed three-slot fusion can still displace a specialized
destination. Do not tune the ranker repeatedly against this same held-out cohort.

The final SQL-projection refactor was followed by a rebuilt-Compose preflight:
it reproduced the trial fingerprint and shortlist metrics without more inference.

Trial snapshot fingerprint:
`63b0ba9e67545e2e6a2f6efd5f225bbcbf3cd42a0b6c13d5b092e4441a240873`.
Shared sample fingerprint:
`1a8055ceab40e37f170c901c16d36729913be94bcaa74f31620e099e2d8a44d4`.

## Final recommendation

Keep this mode available for controlled evaluation; do not replace live policy
selection yet. The gain is better candidate coverage without extra model calls
or user forms. The cost is sensitivity to generic metadata and a demonstrated
new omission. Inventory agreement cannot tell whether existing placements or
new answers are actually correct.

Next component: declared-intent-aware candidate preservation and overlap
comparison. Use actual policy provenance and content evidence to distinguish
specialized eligibility from broad inventory resemblance before truncating to
three candidates. Validate against a fresh cohort and retain this run as a
regression check. Do not hard-code an exception for the newly omitted title.

This commit does not resolve live routing, create verified labels, claim an
accuracy improvement, or change thresholds. Ratings are not used as genre proof.

## Validation

- Full backend coverage run: 1,222 suites, 34,597 tests passed.
- Final focused run after projection/report refinements: 49 tests passed.
- Real-database integration: 3 suites, 10 tests passed. An initial fixture failure
  exposed unnecessary coupling to the live projection; the benchmark now opts
  into metadata columns and the live query does not request them.
- Backend lint/typecheck, ESM import/mock-shape checks, and Markdown lint passed.
- Coverage ratchet passed with fresh backend coverage and the existing unchanged
  client report. No client files changed.
- Rebuilt local Compose is healthy; final preflight reproduced all shortlist
  metrics and the trial fingerprint. No release was created.

## PR and CI scope

GitHub MCP returned no open Classifarr PRs on September 12, 2026. None was
available for random selection or local implementation; no PR was merged.
The pre-existing production naming gate still fails with 26 references against
its zero baseline. This change does not weaken that gate or claim all CI green.
