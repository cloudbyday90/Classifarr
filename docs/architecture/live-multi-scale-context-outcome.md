# Background comparison context outcome

## Delivered behavior

September 19, 2026. Implements the
[background comparison-context design](live-multi-scale-context-design.md).
The last commit supplied a held-out retrieval component, not a live consumer.
This change connects it to the existing ambiguous-destination evidence builder.

Classifarr automatically prepares one private profile in the background. Local
candidate comparison keeps its ordinary three nearest-description examples and
can receive up to three additional, deduplicated representative descriptions per
candidate. Names, genres and manually declared library purposes do not drive the
new fit. Movie/TV scope and existing policy eligibility still constrain candidates.

There is no new panel, toggle, acknowledgement, API, migration or dependency.
Existing items and descriptions use the previous self-excluding retrieval path;
the new full-inventory profile is admitted only for unseen queries. This avoids
using an item's existing placement to justify the same placement. It also means
existing-item retries do not yet receive this extra context.

The comparison remains advisory: this does not raise confidence, change
automatic-routing thresholds, remove existing review requirements or grant AI
new authority. Extra descriptions can change the local model's recommendation.
No semantic-accuracy gain has yet been established.

## Safety and recovery

- The scheduler owns lifecycle, cancellation and one coalesced build. Requests
  never initiate fitting. Refresh validates the source again before publication.
- Source/representation/configuration changes cannot reuse an incompatible fit.
  Current same-media membership is checked on each optional retrieval; vector
  bytes are checked during background reconciliation, not reloaded per request.
- Ten-minute serving TTL, five-minute reconciliation, six-minute build deadline,
  256 MiB cache accounting limit and a separate 500 ms retrieval deadline bound
  optional work. Cache accounting is not a claim about total process RSS.
- Cold, failed, stale or incomplete context preserves ordinary retrieval.
  Optional local-discovery failure can serve raw/broad context while discovery
  retries with exponential backoff and jitter. Failures are not reused as
  successful complete fits.
- Private cached state has no plaintext descriptions. Selected hashes are hydrated
  from the current corpus. Provider projection caps each example at 600 Unicode
  codepoints, strips arbitrary fields and all extra text for remote providers.
  Fixed text limits are not an exact tokenizer budget.
- Prompt text explicitly marks examples as untrusted and correlated context.
  Existing response allowlists and routing checks remain the authority boundary;
  prompt wording alone is not a guarantee against injection.
- Retry/recovery log messages contain fixed status categories and are emitted
  only on health transitions, not on every retry. No titles, IDs, hashes, vectors,
  endpoint details or raw exceptions are logged by these services.

## Local Compose verification

The rebuilt service was healthy with a read-only container root filesystem.
A read-only database smoke exercise used the real inventory repository,
background factory and live description repository. It warmed from 6,652 cached
descriptions across ten libraries and revalidated the unchanged profile without
refitting. Preparation took 83.694 seconds; the complete exercise took 98.184
seconds. These are local smoke timings, not production latency benchmarks.

| Check | Movie | TV |
| --- | ---: | ---: |
| Policy-candidate-shaped destinations exercised | 3 | 3 |
| Ordinary examples preserved exactly | 9 | 9 |
| Additional distinct examples returned | 6 | 8 |
| Known-item exclusion verified | Yes | Yes |

The smoke query used a synthetic unseen identity/description hash and a borrowed
cached vector. It validates integration and admission, **not** classification
correctness. No embedding generation, AI generation, database writes or routes
were performed. Advancing the service's injected clock exercised revalidation
without waiting five wall-clock minutes. Private outputs remain under `.tmp/`.

An earlier smoke attempt did not complete successfully and is not accepted
evidence. The running application independently reported an invalidated profile
during background inventory activity, retaining ordinary retrieval and scheduling
recovery. The successful repetition above did not disable backfill or relax any
source check.
The application emitted its deduplicated retry transition at 19:55:17 UTC and
its automatic recovery transition at 19:59:22 UTC. No operator intervention or
container restart occurred between those transitions.

## Automated validation

- Focused regression: 16 suites / 151 tests passed. New services: 98.99%
  statements/lines, 96.64% branches and 94.73% functions.
- Real PostgreSQL integration: three suites / 26 tests passed.
- Lint, server/client typechecks, dependency/copyright preflight, documentation,
  ESM imports/mock shapes, product-language, delivery-term and maintenance checks
  passed. No client API or UI source changed.
- The separate production-naming gate still reports the same 43 pre-existing
  references against its zero-reference baseline. No baseline was weakened.
- Full backend: 1,320 suites / 38,342 tests passed. Full client: 369 files /
  5,128 tests passed. The coverage ratchet passed with current reports from both
  suites: backend 90.22% statements/lines, 83.07% branches and 92.32% functions;
  client 85.58% statements, 77.54% branches, 85.09% functions and 87.67% lines.
  No test timeout or coverage threshold was relaxed.

GitHub MCP returned no open PRs on both collection checks, so no random PR could
be selected or applied. All six hosted workflows on the preceding commit passed.
No PR was merged. No release, version bump or tag is part of this change.

## Recommendation stack and next item

Validated inventory and automatic backfill → cached description vectors →
background content-only profiles → fresh, bounded local comparison examples →
existing candidate/response/routing safeguards.

| Choice | Pros | Cons / recommendation |
| --- | --- | --- |
| Background context plus raw fallback | Automatic recovery; no interactive fitting or new controls | Cold fit cost and stricter unseen-item admission; keep |
| Append rather than replace nearest examples | Broader context without losing the original evidence | More prompt text; keep bounded and deduplicated |
| Use existing placement as evidence for retries | Easy to implement | Can reinforce a wrong placement; reject |
| Increase scores because several views agree | Appears more confident | Correlated evidence is not independent proof; reject |

Next high-value item: run a paired, held-out movie/TV comparison of the actual
AI decisions with and without these examples, using the existing sampled corpus
and unchanged candidate set. Measure changed choices, abstentions, order
sensitivity, token/latency cost and failure behavior before expanding authority.
Observed placement agreement is not ground-truth accuracy. Separately, extend
cached self-excluding context to known-item retries only after its training
exclusions and memory/work budget are demonstrated; do not refit per request.

Official-source findings, W3C considerations and rejected alternatives are in the
design document. Routine background progress adds no new user-facing messages.
