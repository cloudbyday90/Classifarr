# Manual suggestion analysis capacity study outcome

November 23, 2026 Eastern. See the [design](manual-suggestion-analysis-capacity-design.md)
for the workload matrix, tradeoffs, and official sources.

## Measured response, time, and memory

Ten fresh Node 24.22.3 runs used the production analysis service, the real
administrator HTTP entry point and serializer, and a disposable PostgreSQL
database per run. The Windows host (NT 10.0.26300) exposed 16 logical processors.
Each profile ran twice, in forward and reverse order. Each analysis policy
had 128 feedback rows. Separate PostgreSQL memory and Linux container memory
are outside these process observations.

The table shows exact HTTP bytes and feedback-reference counts. Timing and
memory ranges span both runs. RSS increase is the difference between the
process lifetime high-water values at baseline and after worker cleanup.
Sampled heap peak is the highest 20 ms or named-phase observation.

| Profile | JSON bytes | Feedback-ID references | HTTP elapsed (ms) | Peak RSS increase (MiB) | Sampled V8 heap peak (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Small analysis | 9,457 | 768 | 357–364 | 21.9–23.1 | 122.8–123.1 |
| Larger analysis | 60,482 | 4,608 | 1,994–2,332 | 50.9–51.8 | 146.7–147.1 |
| Richer analysis | 293,804 | 36,864 | 2,403–2,488 | 50.9–53.6 | 144.6–149.2 |
| Background control | No response | No analysis | No HTTP request | 15.7–15.9 | 115.8–116.1 |
| Combined | 293,804 | 36,864 | 2,465–2,711 | 57.7–58.3 | 150.1–152.1 |

The background control settled its measured work in 447–470 ms. In both
combined runs, queue and ingestion were active when analysis started.
Ingestion committed 40 items, and all 20 metadata tasks completed and saved
enrichment before the HTTP client observed response end. Both combined
runs saved 216 suggestions, matching richer analysis alone. The small and
larger analyses saved eight and 48 suggestions respectively.

At the same policy and feedback-row counts, the richer fixture produced
eight times as many references and 4.86 times as many response bytes.
The RSS ranges and the test runner's baseline prevent using these figures
as a production reservation. They also show why serialized size alone
cannot predict peak process memory. PostgreSQL work, allocator behavior,
and host scheduling all contribute to a deployment capacity decision.

## Recommendation

Retain the current one-request admission and add this study to the existing
integration tests. Prioritize a bounded response contract in the next design
because both policy count and evidence detail contribute to result growth.
Preserve partial outcomes and define how clients retrieve evidence detail.
A shared memory reservation could help coordinate concurrent work, with
Linux cgroup and PostgreSQL measurements needed before setting a budget.

## Verification

All ten recorded runs passed. The normal default-profile integration run
and the existing suggestion lifecycle suite passed 57 tests. The report
captures exact response bytes, per-policy writes, queue enrichment,
ingestion completion, and confirmed overlap. The active application
remained healthy with the same container and start time.

Lint, type checks, preflight, ownership, Markdown, ESM and policy gates
passed. The coverage ratchet passed with the hash-checked reports for the
unchanged production and unit-test inputs. All three npm audits reported
zero findings. GitHub listed no open PRs to adopt or rebase.

## Next recommended item

Design a bounded all-policy result contract with stable summary and evidence
retrieval semantics. Compare the candidate with the current API in the
existing isolated Linux resource study and collect cgroup peak and memory
events before proposing a shared reservation or a numerical limit.
