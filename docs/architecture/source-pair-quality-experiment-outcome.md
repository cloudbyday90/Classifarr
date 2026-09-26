# Frozen movie/TV quality experiment: outcome

## Implemented and reconciled

September 25, 2026. Follow `f8d02ad0` (gap-directed capture admission) with the
[quality experiment design](source-pair-quality-experiment-design.md). The prior
commit improved scheduling, not destination correctness. Existing semantic
reference artifacts assess admit/review/abstain and are not repurposed as
destination truth. Existing aggregate history cannot reconstruct destinations.

- Separate small ESM services for pure contracts, protocol preparation, metrics,
  orchestration, worker egress validation and private read-only execution.
- A frozen protocol selects up to 300 movie/TV cases without correction-priority
  sampling. Actual feedback remains available to existing training exclusions and
  the separate, temporally screened correction slice. Music is unsupported.
- Strictly separate protocol and reference files. Check case/media/destination
  membership, declared provenance, consensus and reviewer counts. Conflicting
  references remain ungradable; missing references remain missing. The checksum
  binds evidence but cannot verify reviewer independence or authenticity.
- Replay through existing production policy preparation and cached response
  reduction, including unchanged automatic decisions. Compare both arms on the
  same paired labeled subset; retain unpaired cases in coverage totals.
- Report correct/wrong destinations, abstentions, gains, regressions and movie/TV
  breakdowns. Wilson intervals are conditional binomial descriptions, not
  representative population accuracy or paired-difference significance tests.
- Count unique retained response usage once. New provider calls and routing
  writes are always zero. Cache misses cannot trigger generation or promotion.
- Validate private inputs before runtime loading; silence application logging
  before loading database services. A fixed isolated worker has no credentials,
  database access or generation capability and is terminated on completion,
  cancellation, timeout or validation failure.
- Reuse shared memory/lease admission and a repeatable-read, read-only snapshot.
  Never call the pruning state reader. No queue, cursor, checkpoint, history,
  retention, budget, policy, schema, API or UI change is made by the experiment.

## Local usage

Run from the checkout root with the existing database configuration. These
commands read library evidence; they do not generate AI responses or change
routing. Output is limited to new project-relative JSON files under `.tmp`.
Existing files are never overwritten. Treat all private artifacts as sensitive;
opaque hashes are not encryption and must not be committed or published.

```sh
node server/src/scripts/runSourcePairQualityExperiment.mjs --prepare --output-file .tmp/quality-protocol.json
node server/src/scripts/runSourcePairQualityExperiment.mjs --protocol-file .tmp/quality-protocol.json --output-file .tmp/quality-unlabeled-report.json
node server/src/scripts/runSourcePairQualityExperiment.mjs --protocol-file .tmp/quality-protocol.json --reference-file .tmp/quality-references.json --output-file .tmp/quality-labeled-report.json
```

The reference document is `source_pair_quality_reference.v1`, with the exact
`protocolId`, `provenance` (`independent_human.v1` or `synthetic_fixture.v1`) and
`labels` array. Each label has exactly `item`, `mediaType`, `target`, `consensus`
and `reviewerCount`. Item and target must be present in the protocol with matching
media. Consensus is `unanimous` (2–8 reviewers) or `adjudicated` (3–8). Different
targets for the same item are reported as a conflict, never last-write-wins.

Reviewers must evaluate destination suitability independently of predictions and
current placement. Trusted local review tooling can map the corpus identity to
`SHA256(JSON.stringify(identityKey))`, and a destination to
`SHA256(JSON.stringify([mediaType, String(libraryId)]))`. These are protocol
references, not labels by themselves. No blinded destination review UI/export is
introduced here. Do not relabel synthetic fixtures as human judgments.

The CLI prints only an aggregate receipt. Exit code 0 means a protocol was
prepared or a fully labeled paired report was measured; 2 means missing labels,
incomplete evidence, partial reference coverage, synthetic-only evidence or no
eligible cases; 1 means validation/runtime failure. None of these statuses
authorizes routing. A measured result can still be poor quality. Changed or
expired evidence requires a new protocol, not a bypass or edited checksum.

## What the tests establish

A controlled 300-case synthetic experiment exercises six equal-size groups:
correct agreement, gain, regression to abstention, paired abstention, unlabeled
wrong agreement, and a labeled cache miss. It produces 250 completed pairs,
250 reference labels, 200 paired labeled cases, 50 gains and 50 regressions.
Both arms have 100 correct paired labeled decisions; baseline has 50 wrong and
50 abstentions, source-aware has zero wrong and 100 abstentions. The separate
correction slice has 50 wrong pairs. One shared cached request is charged once.

These are constructed accounting checks, **not measured library accuracy or an
improvement claim**. The real worker separately processes 300 movie/TV cases with
missing caches and refuses to report quality. Production cached parsing on a
48-case fixture grades 25 paired abstentions and leaves 23 unpaired cases visible.

PostgreSQL verification compares complete stored evaluation, sweep, history,
budget and cache records before/after protocol preparation and grading. They are
unchanged. Both snapshots explicitly use repeatable-read/read-only transactions;
the observed statements contain no inserts, updates or deletes. No live database,
provider, container restart or deployment was used for these tests.

Focused verification passed: six backend suites / 105 tests and one PostgreSQL
suite / 23 tests.

Full verification:

- Backend: 1,447 suites / 42,949 tests passed. Statements/lines 90.37%, branches
  84.31%, functions 92.25%. Protocol, reference and metric services have 100%
  statement, line, branch and function coverage. Real worker execution is tested
  separately; its thread entrypoint is not included in parent-process coverage.
- Frontend: 383 files / 5,338 tests passed. Statements 85.73%, branches 77.84%,
  functions 85.30%, lines 87.79%. The combined coverage ratchet passed.
- Chromium: the existing keyboard-pause, mobile-disclosure and access-loss
  clearing scenario passed. Production build and both type checks passed.
- Development/production dependency checks, static ESM imports, test mock shapes,
  copyright, migration/schema snapshot integrity and documentation lint passed.
- Lint passed with the pre-existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.
- PostgreSQL: 165 suites / 1,908 tests passed, with one existing suite/test skipped.

## Recommendation stack, limits and follow-up

Keep **strict ESM protocol/reference contracts → grouped production replay →
pure paired metrics → isolated worker → read-only PostgreSQL → private artifact**.
Keep the existing pausable Vue SWR interface unchanged. The W3C, PostgreSQL and
NIST guidance, alternatives and tradeoffs are linked in the design document.

Benefits: reuses tested production paths, no inference cost, explicit denominators
and provenance, and no live routing authority. Costs: independent labels require
real review; frozen evidence can expire or drift; retained cache coverage is
limited. Independence is declared, not cryptographically verified. Library
membership strata and known-identity grouping do not prove population
representativeness or detect every duplicate. Correlated cases can make binomial
intervals too optimistic. Do not use them as an automatic promotion threshold.

**Next: protocol-bound multi-window evidence collection with a blinded review
packet.** The cache retains at most 50 responses; replaying a 300-case cohort does
not create 300 paired AI results. Retain bounded per-case outcomes before cache
rotation, fence all evidence revisions, deduplicate costs and expire artifacts.
Then collect genuine independent references and use this same metric contract for
one complete comparison. Do not sum overlapping aggregate reports or repeatedly
raise sampling counts without retaining the evidence needed to grade them.

GitHub MCP was checked twice during this work and returned no open pull requests
for `cloudbyday90/Classifarr`. No PR could be randomly selected or implemented;
none was merged. No release, tag or version change is included.
