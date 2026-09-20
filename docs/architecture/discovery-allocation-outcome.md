# Discovery allocation and comparison-input outcome

Date: 2026-09-19

## Implemented

The [design](discovery-allocation-design.md) follows the
[transaction recovery work](inventory-transaction-recovery-outcome.md).
Profile handles now close over only retrieval state and aggregate summary, not
the fitting function's temporary community data. Exclusive normalized vectors
are reused from the validated control reader. Shared-description handling,
normalization order in community fitting and exact similarity arithmetic remain
unchanged.

Cache hits and coalesced builds validate/fingerprint fresh input without copying
every vector. New fits still copy synchronously before yielding. The live SWR
scheduler uses the same boundary for initial admission and final verification;
unchanged revalidation does not copy or refit. It still checks source, revision,
configuration and model identity, clears invalid entries, and retries failures.
No user acknowledgement or new setting is needed.

The paired AI benchmark releases the preceding fold before building another and
reports aggregate per-fold process memory. Its new
`inventory_multi_scale_ai_inputs_v1` fingerprint covers document keys, hashes,
types, membership, library IDs/types, exact vectors and actual description text.
Unconsumed enrichment metadata and display names are excluded. Other benchmark
modes retain the full existing fingerprint, including metadata. Prior invalid
reports are not retrospectively relabeled.

## Allocation evidence

A local Node 24.18.1 diagnostic compared the preceding profile implementation
against the revised one using 3,000 deterministic synthetic descriptions,
512-dimensional vectors, ten movie/TV libraries and five 60-description holdouts.
The two runs were sequential, with no competing test/build workload. The baseline
profile code was read from commit `277c9ddf`; other numerical fitters were unchanged.

The diagnostic used explicit collection only to inspect reachability, not in
production. A weak reference showed the temporary discovery result still reachable
after every baseline fold and collectible after every revised fold. All five
combined profile-summary/retrieval hashes were identical.

| Measurement | Before | After |
| --- | --- | --- |
| Heap after collection, first fold | 46,905,512 bytes | 33,832,336 bytes |
| Heap after collection, fifth fold | 119,938,952 bytes | 82,853,960 bytes |
| Sampled peak process RSS | 457,609,216 bytes | 417,320,960 bytes |

This demonstrates unnecessary retention and its removal in this probe, not a
general throughput guarantee or an exact production memory saving. RSS includes
workers and allocator behavior; heap measurements cover the main isolate.
Private diagnostic scripts/logs remain under ignored `.tmp/` and are not shipped.

## Verification

The focused run passed 13 suites / 119 tests. Regressions cover copy admission,
mutation isolation, cache-hit validation, live revalidation, cancellation,
incomplete-discovery retry, fold release order, aggregate-only diagnostics and
every consumed fingerprint component. CLI tests prove unrelated metadata no longer
invalidates this mode and still invalidates the other modes.

Five targeted real-PostgreSQL suites / 32 tests passed, covering live inventory
descriptions, vector cache, refresh, corpus projection and connection recovery.
Lint, server/client types, copyright/dependency preflight, ESM static-import and
mock-shape checks passed. All 1,372 Markdown files passed lint.

The production-naming gate still reports its pre-existing 43 references against
a zero baseline, as recorded in the preceding outcome. No new reference or waiver
is included.
The full backend run passed 1,325 suites / 38,540 tests in 1,036.132 seconds; line
coverage was 90.24% and branch coverage 83.16%.
The full frontend run passed 369 files / 5,128 tests in 399.38 seconds; line coverage
was 87.67% and branch coverage 77.54%. The coverage ratchet passed for both scopes;
no threshold, baseline or timeout was relaxed.

## Frozen Compose comparison

Repeated the same read-only comparison with seed `classifarr-profile-20260912`,
300 descriptions, five folds, 100 requested inference cases, context 32,768 and
prior cohort sizes `300,300,100,100,300,300,300`. Test/build workloads were idle;
normal background recovery remained enabled. Models, work/deadline limits and
the 2 GiB container limit were unchanged. No forced garbage collection was used.

| Fold | Local context | Fit time |
| --- | --- | --- |
| 1 | Available | 54.397 s |
| 2 | Available | 119.405 s |
| 3 | Available | 121.589 s |
| 4 | Available | 123.146 s |
| 5 | Available | 123.097 s |

All folds passed complete-context admission, allowing paired inference to run.
The container nevertheless reached its memory limit. The application and separate
benchmark process share that limit; each inherits a 1,536 MiB V8 heap allowance,
and discovery also uses a bounded worker. These individual allowances are not an
aggregate container budget. The allocation fix does not resolve that capacity
mismatch. Timing is not an isolated before/after speed comparison.

The run completed successfully with `contextComplete: true`,
`sourceVerified: true`, no changed source components, zero sample/generation shortfall and all
400 inference calls valid. The source contained 6,655 document identities, 6,652
distinct descriptions/vectors and ten libraries. The cohort comprised 172 movie
and 128 TV descriptions; the inference prefix contained 58 movie and 42 TV cases.
The 1,700 prior exclusions and both frozen fingerprints remained unchanged:

- Sample: `ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c`.
- Inference prefix: `fb8007cae79621eea81854d20d8e5d6737d2e15a55f95182bcedce2ee58369be`.

| Across 100 paired cases / 200 calls per arm | Raw examples | Additional context |
| --- | --- | --- |
| Order-stable selections | 75 | 62 |
| Order-stable abstentions | 1 | 1 |
| Order-sensitive cases | 24 | 37 |
| Agreement with current placement (not accuracy) | 61 | 48 |
| Input tokens | 223,278 | 415,966 |
| Summed generation latency | 176.836 s | 255.527 s |

Additional context cost 86.3% more input tokens and produced more order sensitivity.
There are no independent labels, so accuracy remains unknown. This is a complete
comparison under the new explicit input contract, not evidence to promote broader
automatic routing. It does not validate the earlier incomplete-context report.

The primary study [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/),
discovered and checked on 2026-09-19, demonstrates context-position sensitivity in
its own QA/retrieval experiments. It supports testing order and context selection;
it does not establish the cause of this model's results or promise that shorter
packets will improve Classifarr. That remains the next controlled experiment.

The app remained healthy with zero restarts and OOM kills. Final whole-container
counters recorded 214,945 memory-limit hits and a 2,147,487,744-byte peak. These
include background application/PostgreSQL work and are not per-benchmark memory.
The slight counter overshoot is not a configured limit increase. Do not describe
this run as having eliminated memory pressure.

## PR, release and recommendations

GitHub returned no open PRs on 2026-09-19, so there was none to randomly select or
implement. No PR was merged, and this change creates no release, version or tag.

Recommended stack:

1. Keep this allocation fix, actual-input verification and existing SWR recovery.
   Benefit: less wasted work and fewer false invalidations. Cost: explicit ownership
   and dependency contracts that must remain tested.
2. Add shared admission and a memory-bounded discovery execution boundary for the
   app and evaluator, accounting for PostgreSQL, retained models and temporary
   allocations. Benefit: protect unattended recovery from competing expensive work.
   Cost: queued/deferred work and cancellation/ownership complexity. Do not solve
   this by disabling recovery or raising memory/time limits.
3. Next AI/RAG experiment: select a smaller, query-relevant, nonredundant context
   packet that distinguishes the eligible libraries. Preserve the raw-example arm,
   anonymous candidates, movie/TV holdouts and both candidate orders. Benefit:
   directly targets the measured instability and token increase. Cost: stricter
   selection can omit useful rare-content evidence and needs the same paired test.
4. Keep accuracy unknown until independent outcome evidence supports a quality
   claim. Additional examples are correlated observations, not independent votes.
   Do not raise confidence merely because more examples or placement agreement exist.

No inference result in this experiment changed a route, policy, model or learning
configuration. No new review/acknowledgement workflow was added.

The next implementation is recorded in [shared discovery admission design](discovery-admission-design.md)
and its [outcome](discovery-admission-outcome.md).
