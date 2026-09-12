# Benchmark disagreement investigation outcome

## Implemented component

The benchmark now supports `--investigate`. After its original comparisons it
automatically identifies case-level discrepancies and performs at most 25 blind
local content re-checks. The original 9/30/100 arms remain unchanged; alternative
libraries are retained privately for investigation, not added to those arms.

The re-check uses the same synopsis and held-out examples, includes omitted
observed destinations where the three-candidate bound permits, and reverses
candidate order. Previous model votes and observed-placement status are withheld
from the prompt. Agreement is correlated model evidence, not verified accuracy.

No dataset upload or user acknowledgement is required. No UI, routing threshold,
policy, schema, dependency, release, or CommonJS change was introduced.

## Running locally

```powershell
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-budget-20260911 --size 100 --generate-cases 100 --investigate --max-minutes 20
```

The existing time budget covers both phases. Case numbers refer to the report's
sample/snapshot fingerprints, not stable media identifiers. The report separates
unrun comparisons, technical failures, budget-deferred work, and unresolved
content/intent differences. A completed benchmark does not imply every flagged
case was rechecked: inspect the separate investigation counts and statuses.

Public JSON includes no titles, library IDs, descriptions, or raw model answers.
Trusted local diagnostic code can use the optional in-memory `onPrivateCase`
callback to examine the synopsis, item identity, observed library names, earlier
answers, and re-check destination. This callback is not an HTTP endpoint or an
automatic export; the normal CLI does not print its private evidence. Callback
failures are counted without exposing their messages or changing public results.

## Local 100-title result

The rebuilt local Compose run completed all 300 original comparisons and 25
additional re-checks on September 12, 2026. All original responses were valid
proposals. Inventory agreement remained 78/100, 78/100, and 77/100 for the
9/30/100-example arms respectively; these are not accuracy measurements.

- 27 cases flagged; all original comparisons ran.
- 3 cases omitted every observed destination from the original shortlist.
- 25 re-checks: 20 matched at least one earlier answer; 5 chose a destination
  absent from that case's earlier answers. Neither category means correct.
- 2 cases deferred by the explicit call cap; no inspection failures.
- No verified labels, user questions, or routing changes were created.

Snapshot fingerprint:
`fb53a0e341ac6cd630c23b93b3370e09d51f23b01f60eb24d2f0773eeff21d11`.
Sample fingerprint:
`1a8055ceab40e37f170c901c16d36729913be94bcaa74f31620e099e2d8a44d4`.

### Evidence examined privately

The first six prioritized cases were inspected in memory and cross-checked
against read-only local inventory metadata. Titles and descriptions are not
reproduced in this repository document.

- Cases 2 and 42: the observed anime-movie destination was omitted. Including
  it in the bounded re-check changed the answer to that destination. The stored
  metadata provides animation and/or studio evidence absent from the prompt.
- Case 1: a talk-show item lacked its observed destination in the shortlist.
  Stored genres include talk-show information, while its synopsis is very short.
- Case 3: a series alternated between anime and general television as the
  example budget changed. Stored studio and audience-rating fields provide
  additional context; the stored genres alone do not establish anime identity.
- Case 8: holiday, family, and general-movie purposes overlap. The synopsis
  already contains holiday evidence; more descriptive text alone cannot define
  which library should take precedence.
- Case 21: inventory contains the item in both competing destinations. Changing
  the chosen destination is not necessarily a misclassification.

These observations motivate metadata-aware candidate selection and explicit
overlap handling. They do not establish causal effects of candidate order:
the probe changes both order and potentially the candidate set. Local metadata
is also evidence with provenance, not independently verified ground truth.

## Recommendations

Adopt targeted investigation rather than asking users to label the entire
sample. Its benefit is lower review effort and bounded additional inference;
its limitation is that a same-model re-check is not independent verification.
Do not convert unanimous AI votes into labels or change routing automatically.

Next, make candidate selection metadata-aware and compare flagged content with
the libraries' actual declared intent. The local inventory already stores
genres, studio, and content rating; avoid demanding these again from the user.
Preserve synopsis retrieval, distinguish missing metadata from contradictory
metadata, and test specialized-library recall alongside general destinations.
Ask preference questions only after those checks leave
a genuine overlap. This component discovers and rechecks discrepancies; it does
not yet adjudicate library-purpose rules or certify a correct destination.

The [design document](benchmark-disagreement-investigation-design.md) records
alternatives, the recommendation stack, and official sources. Research was
checked September 12, 2026; living sources are not certified August snapshots.

## Validation

- Full backend coverage run: 1,221 suites and 34,574 tests passed.
- Focused benchmark suites: 42 tests passed.
- Relevant Compose integration suites: 3 suites and 10 tests passed.
- Backend lint/typecheck, ESM static-import and mock-shape checks passed.
- Coverage ratchet passed using the fresh backend report and existing unchanged
  client report. No client files were modified.
- Rebuilt Compose is healthy. SHA-256 checks confirmed that the running
  investigation, sampler, and runner match the working-tree source files.

## PR and CI boundaries

GitHub MCP returned no open Classifarr PRs. None was available to select or apply;
no PR was merged or invented. The pre-existing production naming gate still
reports 26 references against its zero-reference baseline, unchanged by this
component. Repository-wide CI is not claimed green.
