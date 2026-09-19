# Paired local AI context comparison: outcome

Date: 2026-09-19

## Delivered component

The existing description benchmark CLI now supports `--multi-scale-ai`.
Four small ESM modules separate held-out evidence preparation, bounded inference,
anonymous metrics, and orchestration. They reuse the multi-scale profile loader,
live description projection/formatting, and trusted-local generation transport.
The [design and researched trade-offs](multi-scale-ai-comparison-design.md) were
recorded before running inference.

This is an isolated content comparison, **not the full production policy prompt**.
No classification confidence, routing permission, UI, settings, API, schema,
dependency, model configuration, or background recovery behavior changed.
The background context feature from `dddd1597` remains advisory.

## Safety and interpretation

Both arms use identical raw examples and candidate sets. All current-fold copies
of a query description are excluded before fitting. The corpus reader excludes
stable identities with conflicting descriptions. Library names and observed destination
labels are not model inputs; observed placement is used only for aggregate
reporting. A shortlist miss remains a miss rather than being repaired with the
expected answer.

Each complete pair contains four valid responses: raw/context, forward/reversed.
An invalid response, model/provider error, output/context-limit signal or abort
stops further inference. Incomplete pairs do not count as complete comparisons.
No repair prompt or fallback provider is used. A generation shortfall produces a
non-success CLI exit even when the available cases completed successfully.

The first real run revealed a missing experiment admission condition: live-safe
optional discovery fallback was also allowed into the full comparison. The runner
now requires every participating fold's local discovery to be available before
any inference. Incomplete context produces `completed_with_errors`, zero calls,
and `not_run_incomplete_context` inference status. Profile summaries now retain
only `time_budget`, `invalid_groups`, or `discovery_failed` when applicable, plus
the evaluator's fitting time. Live fallback, retry, and deadlines are unchanged.
Safe fold diagnostics are also emitted with preflight progress so a future
interruption does not discard every completed fold's preparation status.

Reports contain anonymous strata and totals, not private prompts, responses,
identifiers, descriptions, vectors or endpoints. Inference token/latency totals
describe valid passes, not unobservable work from failed requests. Input
truncation remains unknown; reported context-limit signals are rejected.
Existing placements are not independently verified truth, so accuracy remains
null and this experiment cannot authorize automatic routing.

## Local evaluation

The frozen command reuses the previous 300-description cohort and requests the
first 100 cases in its deterministic library-balanced selection order. It does
not choose cases after seeing their model outputs:

```sh
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false \
  -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr \
  node src/scripts/runInventoryDescriptionBenchmark.mjs \
  --seed classifarr-profile-20260912 --size 300 --folds 5 \
  --multi-scale-ai --generate-cases 100 --context 32768 \
  --exclude-prior-sizes 300,300,100,100,300,300,300 --max-minutes 60
```

Raw reports and progress remain under ignored `.tmp/`. The source contained 6,655
documents, 6,652 cached vectors and ten libraries. The reused 300-description
cohort has fingerprint
`ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c`:
172 movies and 128 TV items. The inference subset has 58 movies and 42 TV items,
spread across seven remaining query strata. Three small-library query strata
were exhausted by earlier cohorts; all ten remain in retrieval/training scope.

### Initial mixed-context run: diagnostic, not full admission

This run passed source verification and returned 400 valid responses, but four
of five folds fell back to broad-only context. It must not be described as a
fully prepared multi-scale result. The original summary did not retain the
failure reason, so the deadline explanation cannot be asserted from that report
alone. Local discovery has an existing 120-second deadline; the new diagnostics
make future timeout versus invalid-group failures distinguishable.

| Measurement, 100 paired cases | Raw examples | Added context |
| --- | ---: | ---: |
| Stable destination choices | 75 | 58 |
| Stable abstentions | 1 | 1 |
| Order-sensitive cases | 24 | 41 |
| Stable choices agreeing with existing placement | 61 | 45 |
| Prompt tokens across 200 calls | 223,278 | 412,444 |
| Model-request latency, seconds | 166.087 | 247.004 |

Among cases stable in both arms, three changed choice: two gained and one lost
observed-placement agreement. This is not the same as the aggregate stable-choice
comparison, which also reflects increased order sensitivity. Across all 300
preflight cases there were 2,700 raw and 2,517 added examples, one shortlist miss,
no empty candidates, and no prompt-budget rejection. No settings were tuned from
these results.

The model was installed `gemma4:e4b`, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`,
with context 32,768, temperature zero, seed 42 and a 64-token response limit.
Retrieval used cached 1,024-dimensional `mxbai-embed-large:latest` vectors, digest
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Timing excludes fitting, source/model verification and other overhead, and the
initial run overlapped regression/background work. It is not a throughput claim.

### Guarded repeat: interrupted, no admission result

The same command with complete-context admission prepared four folds (240 cases)
before the application container restarted at 21:07 UTC. Inference had not begun:
the repeat made zero AI calls and did not reach final source verification. Its
partial progress is not a completed report, and no per-fold availability or
accuracy claim can be made from it. The two attempts together made 400 local
generation calls, all in the initial mixed-context run.

The application log recorded an idle-in-transaction timeout, a failed rollback,
and an uncaught `Connection terminated unexpectedly` error; Docker recorded the
application exiting with code 1 and restarting. The interrupted exec returned
137. That exit code alone does not establish an out-of-memory cause, and no Docker
OOM event was found. The application recovered to healthy without intervention.

The shared `withTransaction` helper does not attach a checked-out client error
listener. Several inventory readers also perform synchronous projection work
while their read-only transaction remains open. These are concrete follow-up
paths, but the current logs do not identify which reader exceeded the deadline.
The benchmark itself fits only after its snapshot transaction has completed.
Do not raise database timeouts or disable background recovery to hide this failure.

[PostgreSQL documents](https://www.postgresql.org/docs/18/runtime-config-client.html)
that the idle-in-transaction limit terminates the session, not merely a statement.
[node-postgres documents](https://node-postgres.com/apis/client) that a connection
can emit an error while idle, outside a query promise. These findings change the
immediate next priority to transaction failure containment and bounded snapshot
work before repeating the full-context evaluation.

## Verification and PR availability

The preceding commit's six GitHub workflows passed. The open-PR collection was
empty when checked through the GitHub connector, so no PR could be selected or
applied. No PR was merged and no release or version change is included.

Focused validation: 13 suites / 109 tests passed, with 100% line coverage
and 99.12% branch coverage across the four new services. Lint, server/client type
checks, documentation lint and three real PostgreSQL integration suites / 26
tests passed. All 369 frontend files / 5,128 tests passed with coverage.

The first concurrent backend run exceeded the unchanged 10-second limit in an
existing geometry test. Its isolated rerun passed, but repeated 2,000-row fits
left little headroom inside instrumented Jest. The deterministic 800-row fixture
still takes 33 fitting passes (beyond the original 12-pass bound), converges and
retains all original assertions: three starts, objective improvement, partition
bounds, deterministic repeat, legacy equality and the one-pass limit. This is a
test-fixture optimization, not a model or timeout change.

Final backend coverage: all 1,323 suites / 38,446 tests passed in 713.296 seconds.
The coverage ratchet passed with backend 90.23% lines / 83.12% branches and client
87.67% lines / 77.54% branches. Final lint, server/client type checks, documentation
lint, copyright/dependency preflight, static ESM imports and mock-shape checks
passed. No coverage baseline or test timeout was relaxed. The targeted 109-test
run was repeated after the final safe progress-diagnostic addition and passed.

The naming audit still reports its pre-existing 43 production references against
a zero-reference baseline. This patch neither adds such references nor relaxes
that baseline; this separate blocked audit is not reported as completed cleanup.

## Final recommendation stack

1. Keep the paired, held-out comparison and its complete-context admission check.
   It measures actual model behavior without adding user controls or routing power.
2. Next, isolate inventory snapshot processing from open transactions and contain
   checked-out connection failures. Add a real PostgreSQL idle-timeout regression:
   the operation must fail safely, discard the broken client, and leave the server
   able to accept a fresh request. Do not automatically replay non-idempotent work.
3. Repeat this exact frozen comparison after the recovery fix. Retain the initial
   run as a mixed-context diagnostic, not a full-feature success or accuracy score.
4. Then evaluate a smaller, query-focused evidence selection against the same raw
   baseline, including order stability and prompt cost. More examples alone did
   not improve the initial result. Full policy replay and independently verified
   correctness remain necessary before expanding automatic routing.

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Contain database failures first | Protects hands-off operation and makes evaluation repeatable | Does not itself improve semantic choices | Next component |
| Add more prompt examples now | Broader visible library context | Initial run cost more and was less order-stable | Do not expand yet |
| Raise timeouts or confidence | Can reduce visible interruptions | Hides the measured failure without proving correctness | Reject |
