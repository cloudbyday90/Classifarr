# Content-first library comparison outcome

Follow-up: the [selective conflict recheck design](selective-inventory-recheck-design.md)
tests an outcome-independent trigger on a fresh cohort; see its
[separate outcome](selective-inventory-recheck-outcome.md) before adopting name-free comparisons.

## Scope

Implementation follows the [separate design](content-first-library-comparison-design.md).
It compares all requested cohort cases, not only baseline disagreements, with
ordinary nine-example prompts and library names either present or replaced by
numbered labels. Production policies and routing remain unchanged.

## Reproduction

```powershell
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false `
  -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000' `
  classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs `
  --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200 `
  --folds 5 --generate-cases 300 --context 32768 --max-minutes 20 `
  --learned-profiles --content-first-comparison
```

Omit `--generate-cases` for preflight. This reuses the existing 300-title cohort;
it does not add another 300 titles. The prior 100/200 cohorts are excluded from
sampling but remain available in the training corpus. Held-out descriptions and
copies stay excluded from their own fold's training evidence.

Preflight verified the sample fingerprint
`6a35df4dfced22a5c8f7a608ae26cdfac8db6316f386328be451463f76a040ce`
and fold assignment
`49e220b946dfd7e8e019491b374fa3050399808ca67d6e5a125ea32fc086a784`.
The cohort contains 144 movies and 156 TV titles. All ten libraries retain
training data; one small movie library has no remaining new sampled identities.

## Measurements

The run completed all 600 generation calls and 300 valid pairs, with no missing
pairs, failed calls, malformed/limited output or unavailable evidence. The named
arm proposed a destination in all 300 cases. The anonymous arm proposed 299 and
abstained once. Abstention is a valid outcome but not placement agreement.

| Cohort | Cases | Named agreement | Anonymous agreement | Gained | Lost | Net |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 300 | 243 (81.0%) | 233 (77.7%) | 21 | 31 | -10 |
| Movies | 144 | 124 (86.1%) | 114 (79.2%) | 4 | 14 | -10 |
| TV | 156 | 119 (76.3%) | 119 (76.3%) | 17 | 17 | 0 |

Both arms agreed in 212 cases and both disagreed in 36. There were 54 changed
proposals/abstentions. The full-cohort result reverses the encouraging selected
case/control result: 31 losses across all 243 named-baseline agreements, versus
six losses in the earlier 57 selected controls. The earlier investigation left
186 agreeing cases untested and could not establish the full regression rate.
Historical per-item answers were not retained and full snapshot hashes differ,
so the difference must not be attributed to specific historical control identities.
A blanket anonymous-label switch is therefore not recommended.

| Library stratum | Type | Cases | Named agreed | Anonymous agreed | Gained | Lost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Movie | 0 | — | — | 0 | 0 |
| 2 | Movie | 36 | 28 | 29 | 3 | 2 |
| 3 | Movie | 36 | 35 | 32 | 0 | 3 |
| 4 | Movie | 36 | 27 | 23 | 1 | 5 |
| 5 | Movie | 36 | 34 | 30 | 0 | 4 |
| 6 | TV | 15 | 8 | 6 | 2 | 4 |
| 7 | TV | 35 | 16 | 28 | 13 | 1 |
| 8 | TV | 35 | 29 | 25 | 1 | 5 |
| 9 | TV | 35 | 30 | 28 | 1 | 3 |
| 10 | TV | 37 | 37 | 33 | 0 | 4 |

Stratum numbers are positions in this snapshot's library-ID ordering, not names
or hardcoded categories. A shared TV item belongs to two rows; membership rows
sum to 301 while the overall result counts 300 distinct cases. Stratum 1 has no
new sample, not a measured zero-percent success rate. TV stratum 7's improvement
does not justify a special-case rule for that library.

Named prompts averaged 808.57 input tokens and 897.91 ms generation latency;
anonymous prompts averaged 810.00 tokens and 868.76 ms. These timings include
concurrent local validation load and are not a controlled throughput benchmark.
Both arms used the same installed local `gemma4:e4b` model, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`,
context 32,768, temperature zero, seed 42, thinking disabled, output limit 64.
Embeddings were `mxbai-embed-large:latest`, 1,024 dimensions, digest
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
No input-limit signal was observed; actual input truncation remains unknown.

These are agreement measurements against existing placement, not verified
accuracy. The development cohort already informed this treatment, and independent
labels remain zero. No model answer was promoted into a trusted training label,
and no media was routed or moved by this experiment.

### Snapshot provenance

The generation run and preflight matched on the sample, folds, legacy snapshot
fingerprint and all four new canonical component hashes. The legacy fingerprint
was `ff30d1a86bd603a98a21dbcbf9522b07514e3e412e550425a958a07d337c1de0`.
This also matches the earlier grouped benchmark, but not the intervening
contrastive investigation's full snapshot hash. That earlier mismatch remains
unexplained; the new digests cannot retrospectively identify its cause.

| Component | Records | Canonical SHA-256 |
| --- | ---: | --- |
| Descriptions and memberships | 6,647 | `3fed0b8a6b475c0cfa2748886844d512a6057f68499e85b2d564fdb89471043a` |
| Libraries | 10 | `0d42f113861c96c3a55d2316d87a1be7f412e293acd79fbe76143ed760f531dc` |
| Cached vectors | 6,644 | `ff6ce008357689342e440b306fe57f7bc0b2b1028d95e4aaf041825d94725db4` |
| Candidate metadata | 6,649 | `c96a2aed203771ac47544603e1001e78cf16b478524c75e1cbd8d99d0f427274` |

Protocol: `inventory_description_snapshot_v1`. Only aggregate component digests
are retained, not individual content hashes, names, descriptions, IDs or vectors.

## Engineering validation

Compatibility checks cover both the original description-comparison service,
which remains unchanged, and the shared benchmark helper extracted from the
contrastive runner. They are separate modules with distinct names. The legacy
benchmark fingerprint and default prompts are unchanged by retaining comparison
evidence or computing canonical component hashes.

Focused validation passed nine suites and 140 tests. PostgreSQL integration
passed seven tests, including a paired run over a real read-only snapshot and
unchanged vector-cache row counts. Server/client lint and typechecks, ESM checks,
documentation lint and whitespace checks passed. Final full-suite coverage
validation passed 1,232 suites and 35,143 tests: statements/lines 90.03%, branches
81.49%, functions 92.11%. The final full run started after the module-name
correction and covers the final runtime code.

The coverage ratchet passed using this backend report and the existing coverage
report for the unchanged client. The full client unit suite was not rerun.

Compose was rebuilt and verified healthy with the corrected final service files;
their SHA-256 values match the workspace. The original description-comparison
service is unchanged. The frontend was unchanged and its build layer was reused.
No paid provider, model download, policy write, new UI setting or user question
was introduced. The naming gate still reports 26 pre-existing references against
its zero-debt baseline; this work adds none and does not relax that gate.

## Runtime follow-up context

Read-only inspection of `aiPromptBuilderFormatters.mjs` and
`liveInventoryDescriptionEvidence.mjs` confirms that live candidate adjudication
already includes profiles, learned-fit evidence, retrieved descriptions, library
names and policy scores. This experiment isolates names using a simpler fixed
prompt; it is not a replay of the entire live classifier. A future runtime
change must preserve explicit eligibility constraints and account for these
additional inputs rather than assuming offline agreement transfers unchanged.

## Recommendations and next component

| Recommendation | Pros | Cons / limitation |
| --- | --- | --- |
| Retain the named nine-example baseline | Avoids the measured blanket-switch regression; preserves useful context | Names still mislead some comparisons |
| Add an evidence-triggered content-first recheck next | Targets name/content conflict and avoids a second call for every item | Trigger quality is not established; needs fresh held-out evaluation |
| Reuse current profiles and retrieval services | Library-agnostic, hands-off and avoids another dense UI | Their evidence is correlated and must not be counted as independent votes |
| Keep current authorization and output validation | A model proposal cannot bypass explicit policy constraints | Benchmark gains alone do not establish a safe routing threshold |

The next high-value component is an **automatic evidence-conflict recheck**:
retain names normally, but compare without names when retrieved descriptions and
learned metadata conflict with the named proposal. Build the trigger from current
content evidence, never from knowledge of the desired destination, a fixed
library name, or these stratum numbers. Reuse the existing candidate adjudication
path and closed eligible candidate set; do not add another declaration screen.

Predeclare and test the trigger on fresh held-out cases before changing live
decisions. Initially measure it without routing side effects, including additional
call rate and regressions as well as recovered agreement. Independent outcome
validation is still needed before claiming accuracy or training on its outputs.

Final recommendation stack: **learned profiles + description retrieval → named
baseline → selective content-first conflict recheck → existing policy gates**,
with fresh held-out and trustworthy outcome validation before production adoption.
Do not globally remove names, increase every prompt, or create a special rule
for the one TV stratum that improved.

## Pull requests

GitHub MCP searches returned no open PRs on September 12, 2026, both initially
and on recheck. No random PR was available to implement locally; none was merged.
Changes remain under Unreleased, without a release, tag or version bump.
