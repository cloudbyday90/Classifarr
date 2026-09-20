# Local cross-encoder evaluation design

Date: 2026-09-20. Scoring rules and acceptance budgets were declared before model
installation/scoring. Deployment corrections discovered during verification are
recorded in the separate outcome document; they do not relax the scoring gates.

## Decision and scope

Implement the dedicated pair scorer recommended in the
[reassessment](library-learning-next-step-reassessment.md). Use TEI 1.9.4 CPU with
BAAI/bge-reranker-base, pinned to immutable image and model revisions. This is
query/example relevance, not generated chat grading, learned library purpose,
confidence, or routing authority. All Classifarr code remains modular ESM.

Retain existing inventory retrieval, provenance exclusions, grouped holdouts,
source verification, and discovery admission. Extend the existing benchmark
runner with an optional scorer strategy; do not add another review screen or
automatic route. Current inventory placements are observations, not truth labels.

## Resource and security budget

- Dedicated optional local scorer: 4 GiB memory, two CPUs, no swap above that
  limit, non-root, read-only root/model mount, dropped capabilities and no-new-privileges.
- Isolate the scorer on a dedicated internal Compose network, without published
  ports. Do not share the app's loopback namespace: its embedded database trusts
  localhost. No app data, credentials, Docker socket or routing tools are mounted.
- Download only explicitly pinned config, tokenizer and safetensors artifacts
  during preparation, verify hashes, and mount them read-only. Runtime uses a local
  model directory; no pickle/custom remote code or automatic model downloads.
- Adapter admits only the exact private Compose service origin (Docker-managed DNS)
  or canonical literal loopback for isolated probes; no arbitrary host, credentials,
  redirects or remote fallback. Verify `/info` before and after scoring, exact
  index coverage, finite raw scores, model revision/type, and disabled truncation.
- Bound each request to 16 examples, 64 KiB input, 64 KiB response and 30 seconds.
  Longer model inputs fail instead of silently truncating. Provider bodies and
  exception text never enter logs or aggregate reports.
- TEI rerank acquires one permit per pair, not per HTTP request. Allow 16 pending
  pairs, while compute batches stay capped at four requests/512 tokens and two CPUs.
  Reject inspection mismatches; never raise memory or CPU limits to hide overload.

## SWR and recovery

Use a bounded, in-memory score cache keyed by model/runtime identity, source and
representation revisions, and exact query/example hashes. Coalesce identical work.
Serve stale scores only within a short declared window for an unchanged scope;
revalidate in the background, with bounded cooldown after transient failure.
Changed source/model/representation scope cannot reuse an old value. Cache eviction,
invalidation, cancellation and disposal must not publish a late obsolete result.
No persistent labels or policy changes are produced by cache refresh.

Defaults: at most 128 entries of 16 numeric scores; fresh for one minute, stale
for at most five minutes since success. Normal reads trigger background refresh
after freshness expires. Failed refresh backs off from one to 30 seconds; it does
not extend stale lifetime. A scheduled caller must supply current trusted source,
access, model and representation digests. This factory is not yet connected to
live classification: no UI acknowledgement or background routing change is added.

Offline repeat/order tests bypass caching so a cache hit cannot masquerade as
model repeatability. Production routing does not consume this cache in this step.

## Predeclared evaluation

Use 300 distinct descriptions per cohort, selecting up to 100 eligible cases
round-robin across observed libraries/media, with one disjoint confirmation cohort.
Report eligibility and inference shortfalls explicitly. For each case, score every
eligible candidate's same bounded retrieved examples. Aggregate by the mean of
each candidate's two strongest scores, requiring two distinct examples; this
limits library-size voting. Missing evidence abstains. No score-to-confidence
conversion or absolute relevance threshold is learned from these outcomes.

Compare original, identical repeat, and reversed example order; require maximum
pair-score difference at most 0.0001 and no winner changes. A tied winner within
that tolerance abstains. Report per-media placement agreement, gains/losses,
coverage, language coverage, and p95 request latency. Initial feasibility budget:
p95 at most 5 seconds per batch under the 4 GiB/two-CPU limit. This is a local
pilot target, not a product SLA. Do not promote if either media stratum loses net
agreement on confirmation, a resource/protocol gate fails, or independent-label
evidence is insufficient. Do not repair results with prompt variants or tuning.

Available language counts describe original-language metadata, not the language
of the fetched overview. Description-language detection and multilingual accuracy
are not established by this pilot; report that limitation explicitly.

## Alternatives and source basis

| Choice | Benefit | Cost / decision |
| --- | --- | --- |
| Dedicated TEI cross-encoder | Purpose-trained pair relevance, typed numeric output | Extra runtime/RAM and domain mismatch; selected bounded pilot |
| More chat-model votes | Existing runtime | Already unstable and costly; not repeated |
| Multilingual larger reranker | Broader language coverage | Compatibility/resources unverified; defer |
| Placement-based fine-tuning | Local adaptation | Self-reinforcing errors without independent labels; defer |

Official sources discovered and read using web search and GitHub MCP:

- [TEI release 1.9.4](https://github.com/huggingface/text-embeddings-inference/releases/tag/v1.9.4)
  and [versioned API contract](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/docs/openapi.json):
  reranking, raw scores, indices, inspection, and truncation controls.
- [Supported models](https://huggingface.co/docs/text-embeddings-inference/supported_models)
  and [BGE model card](https://huggingface.co/BAAI/bge-reranker-base): compatibility,
  English/Chinese scope and MIT licensing; not a claim of universal media accuracy.
- [TEI deployment](https://github.com/huggingface/text-embeddings-inference):
  local-directory, pre-downloaded deployment and inference resource controls.
- [TEI 1.9.4 rerank implementation](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/router/src/http/server.rs):
  each pair acquires a concurrency permit; one bounded batch needs enough permits.
- [Docker internal networks](https://docs.docker.com/reference/compose-file/networks/):
  externally isolated networks keep the scorer separate from the app's trusted loopback.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  scoped caching, provenance, bounded input and independent output validation.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  concise non-disruptive feedback; no new acknowledgement workflow is needed.

Final stack: validated inventory/metadata → existing retrieval → local pair
scorer → revision-bound SWR → existing routing safeguards → independent evaluation.
Measured outcome and any deviations belong in a separate outcome document.

## Local operation

Prepare explicitly with `npm run benchmark:cross-encoder:prepare`, and pull the
immutable image digest recorded in `docker-compose.cross-encoder.yml`. Preparation
verifies existing files, exclusively owns its staging file, and never overwrites
another artifact. All model files stay under ignored `.tmp/cross-encoder-model/`.

Provision the optional network/service once (this may recreate the app to attach
its additional private network):

```powershell
docker compose -f docker-compose.yml -f docker-compose.cross-encoder.yml --profile cross-encoder up -d --no-build --pull never --wait classifarr inventory-cross-encoder
```

Wait for the model to become ready (cold load can take a minute). The CPU image
uses Candle when ONNX is absent; only the pinned safetensors path is prepared.
The `/info` revision is a declared runtime value, not a weight attestation; trust
also requires preparation hashes, the read-only mount and pinned image. CPU
backend approximation is tested for repeat/order stability, not presumed equal
to other inference engines. Keep the overlay when recreating the app for evaluation
so its private network remains attached. Ordinary benchmark launches do not recreate
the app. The scorer's namespace and lifecycle are independent. No port is published.

Run against the currently built app image, with no chat generation:

```powershell
node scripts/run-inventory-benchmark-compose.mjs --seed classifarr-crossencoder-20260920 --size 300 --folds 5 --leader-cross-encoder --score-cases 100 --max-minutes 60
```

Omit `--score-cases` for a zero-inference eligibility check. Confirmation uses
the same seed plus `--exclude-prior-sizes 300` so descriptions do not overlap.
The existing isolated runner waits up to five minutes for discovery admission;
it cannot preempt production work. Cancellation closes the owned job. Source drift
invalidates the report rather than authorizing stale results. Failed scorer requests
stop scoring, without a remote fallback or silent model download. Stop the optional
service when evaluation ends to release its memory.
