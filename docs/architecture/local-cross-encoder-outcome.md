# Local cross-encoder evaluation outcome

Date: 2026-09-20. Decision: implemented as an optional experiment; **do not enable
this scorer in live routing or run the confirmation cohort yet**. No release.

## What changed

Implemented the [predeclared design](local-cross-encoder-design.md): a small ESM
TEI adapter, strict model/resource/response validation, bounded pair scoring,
revision-scoped SWR, verified artifact preparation and optional isolated Compose
deployment. The existing read-only benchmark runner gained one scorer strategy;
no replacement classification service, settings page or acknowledgement was added.

The previous commit's discovery-admission fix worked during this run: the job
waited twice for busy discovery, then proceeded without manual intervention. The
running app remained healthy, with no unexpected restart or OOM. Scoring did not
write policies, route media, train on decisions or call a generative/cloud model.

## Actual pilot, not a promotion result

The corrected deployment considered 300 distinct descriptions; 285 had complete
eligible example sets and 15 were excluded. The deterministic balanced selection
scored 100 cases across all ten observed libraries, using 300 uncached requests.

| Measurement | Movie | TV | Total |
| --- | ---: | ---: | ---: |
| Completed cases | 51 | 49 | 100 |
| Original policy agrees with observed placement | 36 | 41 | 77 |
| Cross-encoder agrees with observed placement | 25 | 30 | 55 |
| Placement-agreement gains | 6 | 6 | 12 |
| Placement-agreement losses | 17 | 17 | 34 |

These are **diagnostic counts from an invalidated run**, not verified accuracy
or evidence to promote a model. At completion, the existing source-verification
contract detected changes in `metadata` and `observedTraits`. The final report is
`status: invalidated`, `sourceVerified: false`; original snapshot inputs were kept
in memory, but the report does not describe current live metadata. No independent
labels were available. A supported numeric winner is not a safe routing decision.

All 100 cases produced repeat/order-stable winners: maximum pair-score delta
0.0000157 against the fixed 0.0001 tolerance. P95 batch latency was 4,297 ms, below
the predeclared 5,000 ms target. This is a local feasibility measurement, not an
SLA or comparative speed claim; host-side tests overlapped the run. The scorer
used a two-CPU, 4 GiB cap, with a cgroup-accounted peak of 2,762,194,944 bytes
(about 2.57 GiB), zero memory-limit failures and zero OOM kills.

Original-language metadata counted 78 English and 22 other/unknown items; this
does not establish overview language or multilingual accuracy. The final report
schema names this `originalLanguageCounts` and explicitly leaves description
language assessment false. No thresholds, model, examples or scoring rules were
tuned after observing these results. Confirmation was not run.

## Deployment corrections and recovery

The first attempt stopped after one rejected scoring request. TEI acquires one
concurrency permit per query/example pair, not per HTTP request. The initial two
permits rejected a 15-example batch with HTTP 429. Corrected configuration allows
16 pending pairs while retaining four-request/512-token compute batches, two CPUs
and the original memory cap. The adapter now rejects mismatched limits during
inspection and emits bounded failure reasons without retaining provider bodies.
The cause was verified against the
[versioned TEI implementation](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/router/src/http/server.rs).

Final deployment replaces the pilot's shared loopback with a dedicated internal
Docker network. The app's embedded database is localhost-only; giving the scorer
the same namespace would unnecessarily expose that trust boundary. The final
network was verified internal, without published ports: database-port access was
refused and the external model host did not resolve. A full 16-pair transport
probe passed. This follows [Docker's internal-network model](https://docs.docker.com/reference/compose-file/networks/),
without claiming protection against a compromised Docker host.

Weights/config/tokenizer were hash-verified before and after the run. Only pinned
safetensors artifacts were used; the CPU image selected its Candle backend, with
no custom remote code or runtime download. Model inspection is a runtime claim,
not weight attestation; read-only mounts, artifact hashes and image pinning remain
part of the trust boundary. Raw inputs, provider output and model files stay out
of Git. Model preparation preserves another process's partial files and never
overwrites existing artifacts.

The real stop/restart probe retained the app-side cache while stopping only the
scorer. Its sequence was `fresh → stale → unavailable → fresh`: unchanged-scope
scores were briefly available, expired scores were withheld, and the next read
after restart/cooldown fetched scores automatically. Changing the source digest
forced another fetch. Four client attempts were observed; concurrent expired
reads reused the pending outage attempt. The probe used an accelerated cache
clock, not changed production TTL defaults. Unit tests additionally cover
permission/model/representation revisions, cancellation, late-response fencing,
malformed output and bounded eviction. The optional scorer was stopped after
verification to release memory; the live routing path never consumed its cache.

## Verification

- Backend coverage run: 1,362 suites / 39,747 tests passed.
- Final focused/code-health run after the request-byte-boundary check:
  seven suites / 26,470 tests passed.
- Frontend coverage run: 369 files / 5,128 tests passed.
- Focused database integration: three suites / 24 tests passed.
- Lint, type checks, copyright/dependency preflight, ESM static imports/mock
  checks, Markdown lint and coverage ratchet passed.
- The independent naming gate remains blocked by the same 43 pre-existing
  production references against its zero baseline. No waiver was added.
- GitHub MCP returned no open PRs twice, so there was no eligible random PR to
  implement. No PR was merged. The previous commit's CI and security runs passed.

## Recommendations and next item

Follow-up: the [shared snapshot outcome](frozen-evaluation-snapshot-outcome.md)
records the prospective reconciliation and current next item. It does not alter
the pilot's original invalidated status or authorize live scoring.

| Option | Benefit | Cost / recommendation |
| --- | --- | --- |
| Enable BGE scores in routing | Adds content relevance | Invalidated evidence and worse diagnostic placement counts; reject |
| Try more prompts/models immediately | More experiments | Does not resolve inconsistent evaluation lifecycle; defer |
| Reconcile existing snapshot verification | Learning continues while frozen measurements remain interpretable | Requires shared drift semantics and regression tests; do next |

**Next: extract and share the existing frozen-snapshot drift contract between
the fresh-policy evaluator and leader/scorer benchmarks.** The fresh evaluator
already distinguishes metadata-only enrichment from policy/scope/vector drift;
the leader runner currently invalidates both. Reuse that implementation rather
than adding another snapshot framework, review screen or instruction to stop sync.
Preserve `sourceVerified: false` and prohibit current routing authority for stale
metadata; continue to invalidate policy, identity, membership, provenance and
vector changes. Add parity tests for those boundaries before another comparison.
Do not retroactively relabel this predeclared pilot as successful.

After reconciliation, reuse the existing disagreement investigation to identify
concrete missing or misleading examples. Do not retune on the same 100 outcomes
or treat current library membership as independent truth.

Final recommendation stack: existing validated sync and organic enrichment →
shared frozen-evaluation/freshness contract → existing provenance-clean retrieval
and disagreement diagnostics → optional local scoring/SWR → existing routing
safeguards. The scorer remains off the live decision path.
