# Neighbor rejection evaluation outcome

## Implemented on 20 September 2026

Implemented the [rejection evaluation design](neighbor-rejection-evaluation-design.md)
with three focused ESM services: calibration-context validation, integrity controls,
and library-withheld probe selection/reporting. Shared validation also removes
duplicated query checks from familiarity and exact-neighbor calibration.

The underlying gap was missing item/scope binding: valid-shaped calibration
results from another query could satisfy the offline acceptance checks. Exact
acceptance now requires a trusted expected context matching both result families.
The digest includes the corpus and embedding representation, item identity,
description group, complete exclusions and omitted-library scope. Query identities
are strictly typed; an omitted or missing held query is rejected even after cache
warming. Existing live routing does not consume these experimental results.

The internal exact contract is `library_neighbor_exact_cross_fit_v2`; the report
is `inventory_leader_challenge_v6`. These are evaluation contract versions, not
an application release. No application version, API, schema, dependency, UI,
provider setting or routing threshold changed. There is no new acknowledgement.

## Snapshot-verified Compose result

A read-only run covered 300 descriptions (150 movies, 150 TV shows), ten library
strata and five whole-description folds. Source verification passed with no changed
components, zero model-generation calls and no routing receipts.

### Integrity controls

All **429 controls were rejected**, with zero unexpected acceptance and zero
unexpected errors: thirteen controls on each of 33 nominated cases. Six original
nominations passed the normal acceptance test, giving 78 mutations against an
accepting baseline. These are repeated controls on six cases, not 78 independent
successful classifications.

Controls covered missing identity, conflicting media type, missing held query,
unknown fold, missing context, mixed familiarity context, mixed neighbor context,
stale context on both results, malformed snapshot ID, nonfinite familiarity rank,
incomplete neighbors, sparse rival evidence and foreign candidate IDs. An
unexpected exception is a failure, not evidence that malformed input was handled
correctly. Cancellation interrupts the run rather than counting as rejection.

Corrupt embedding shapes/values, changed representation digests, and cancellation
during the probe stage are additionally exercised by automated tests, not included
in the 429 on-corpus controls.

### Library-withheld probes

Thirty probes were selected before outcomes, three exclusive description groups
per library. Each library's probes shared one existing outer fold. Its reference
groups and candidate were omitted, and the remaining exact-margin distributions
were refitted. Independent per-library familiarity models can be reused because
omitting a different library does not affect their fit.

| Probe outcome | Movies | TV | Total |
| --- | ---: | ---: | ---: |
| No familiar remaining library | 2 | 2 | 4 |
| Familiar but not distinct | 13 | 10 | 23 |
| Familiar and distinct support elsewhere | 0 | 3 | 3 |
| Unavailable evidence | 0 | 0 | 0 |

The three supported probes came from anonymous TV strata 7 (two) and 10 (one).
There was no supported destination for the other 27 probes. This is **not a 90%
novelty-detection accuracy claim**: content may legitimately fit multiple libraries,
and withholding its existing library does not establish semantic ground truth.
`falseAcceptanceRate` remains null and `unknownContentRejectionAssessed` remains
false. The report names this a novelty proxy rather than verified unknown content.

### Ordinary comparison preserved

The exact arm still accepted six nominations: two unvetoed placement gains and
four hypothetical gains under veto, with no accepted placement losses. All 249
policy vetoes stayed intact. The policy baseline had 228 placement agreements;
unvetoed exact changes produced 230. Twenty-five nominations remain undistinguished
and two challengers remain unfamiliar. These are inventory-placement comparisons,
not verified classification accuracy.

## Resource bounds and reproduction

The complete exact arm, including probes, computed 1,261,010,944 vector components
within its two-billion ceiling. It retained 380 cache rows / 2,527,760 Float64 slots
(20,222,080 bytes), and reused 6,999,913 scores. No cache, memory, time, model-count,
or work limit was raised. Omitting a library gets a separate fitted-model key and
context; cached pair values never restore omitted references.

Compose remained healthy with a read-only root filesystem, zero memory-limit
failures and zero OOM kills. The observed cgroup peak was 1,411,059,712 bytes,
including background application work; it is not isolated experiment memory.

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-leader-20260920 --size 300 --folds 5 --leader-challenge --max-minutes 30
```

Sample fingerprint:
`87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a`.
The source-component fingerprints match the preceding
[exact-neighbor experiment](exact-neighbor-calibration-outcome.md).
Private console output is kept under ignored `.tmp/`, not committed. A small
synthetic test suite is not described as additional independently labelled media.

## Validation and delivery

Validation passed:

- Full backend coverage run: 1,351 suites / 39,268 tests.
- Latest focused regression run: 12 suites / 165 tests.
- Database integration checks: three suites / 24 tests.
- Isolated coverage rerun: seven suites / 122 tests; the three new services have
  100% line/function coverage and 95.57% combined branch coverage.
- Coverage ratchet, lint, type checks, CI preflight, dependency checks, ESM static
  imports/mock shapes, Markdown lint and whitespace checks.

The ratchet used the fresh full backend report and the existing client report;
the unchanged frontend suite was not rerun. Tests cover context changes for
identity, groups, vectors, memberships and representation; stale/mixed evidence;
strict query types; omitted-library isolation; bounded selection; redacted
reporting; corruption handling; cancellation and fresh retry. The latest focused
run also covers the final non-Error exception handling change.

GitHub had no open PRs when checked, so no random PR could be selected or merged.
The preceding commit's CI build, database tests and acceptance readout passed.
The existing production-naming gate still has 43 production references against a
zero-reference baseline; no waiver or baseline change is introduced.

## Recommendations and next high-value item

| Recommendation | Benefit | Cost / limitation |
| --- | --- | --- |
| Keep context binding and automatic corruption controls | Detects stale/mixed evidence without user effort | Digests are not signatures or routing authority |
| Retain library-withheld probes | Exposes ambiguous support using real library content | Weak-label stress diagnostic, not unknown-content accuracy |
| Do not promote the evaluator or loosen thresholds yet | Preserves established safeguards | Some reviews remain necessary |
| Evaluate semantic disambiguation on the unresolved cases | Addresses content meaning, not just vector proximity | Requires bounded model work and a separate held-out check |

Final stack: validated inventory → provenance-clean groups → context-bound exact
neighbors → library-relative familiarity/distinction → automatic integrity and
withheld-library checks → existing policy safeguards.

**Next: a bounded, library-agnostic semantic comparison of ambiguous destinations.**

Implemented next in the [semantic comparison design](leader-semantic-comparison-design.md)
and [measured outcome](leader-semantic-comparison-outcome.md). The following rationale
records why that follow-up was selected.

Use the actual item description, metadata and nearest examples from competing
libraries to investigate the three supported withheld-library probes and the 25
undistinguished nominations. Reuse the existing candidate-bound AI adapter,
require structured abstention, cap calls/time, and compare against the frozen
exact-neighbor baseline plus these corruption controls. Validate the approach on
a separate held-out cohort rather than tuning to these examples. Keep library
names from becoming hard-coded genre rules, and do not add another settings or
approval screen. This is the next step toward understanding content, not permission
to treat an AI opinion or existing placement as verified ground truth.
