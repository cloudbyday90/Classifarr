# Cached AI adjudication replay: design

Status: Unreleased, September 25, 2026.

## Decision and boundaries

Extend the existing source-pair worker, not the live classifier. Select at most
25 movie/TV pairs needing review or showing different deterministic outcomes,
without consulting correction labels. Reuse frozen fold-local preparation and the
existing adjudication prompt/parser/reducer. Prefer alternating movie/TV cases
when both are available. Music stays excluded.

Automatic runs consume exact captured responses only. Missing responses never
authorize generation. A separate private command explicitly budgets local Ollama
generation, with at most two requests per selected pair, fixed generation options,
memory admission, a deadline, and no routing capabilities. No paid/cloud inference,
model pulls, provider fallback, or automatic routing is added.

One replaceable cache batch binds prompt hashes, ordered candidate contracts,
generation options, configuration, model name and installed-model digest. Store
bounded raw responses and historical usage, not prompts or source items. Responses
may contain private content: keep them in the local database, never logs/status.
Expire the batch after seven days; the existing automatic job removes expired
batches. Interrupted capture leaves the previous complete batch intact. No partial
batch is published. Exact request mismatch is a miss, not approximate reuse.
Same-model/configuration refills preserve the original batch expiry: response reuse
must not silently renew private-content retention.

Automatic replay measures the captured model artifact; it does not contact the
provider to prove that a mutable model tag still names that artifact. Configuration
changes invalidate reuse. Status must explicitly distinguish historical usage
from new calls and proposals from permission to route. A proposal that reduces
deferral can still be wrong. Grade only temporally eligible corrections, and keep
unknown/unlabeled outcomes out of correctness totals.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Exact cached replay plus explicit bounded capture | Repeatable, no surprise inference load | Cold cache needs capture; selected |
| Generate on every automatic cache miss | More coverage immediately | Unbounded cumulative model load and privacy changes; reject |
| Reuse historical decisions by title | Easy apparent coverage | Wrong prompt, evidence, candidate order and model provenance; reject |
| Separate evaluation platform/scheduler | Independent infrastructure | Duplicated lifecycle and evidence logic; not needed |

Recommended stack: frozen policy comparison → label-independent bounded selection
→ existing prompt preparation → exact captured response → production response
reducer → correction/deferral/usage aggregates → existing restart-safe checkpoint.
Retain a narrow capture command until an explicit recurring inference budget is
designed. Do not equate proposal gains with end-to-end accuracy.

## Official research

Sources discovered through search and read on September 25, 2026:

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  informs repeatable evaluation, uncertainty and documented unmeasured risks.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  informs source lineage, test-data suitability and output evaluation.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  informs versioning, provenance and quality metadata. This private report is
  not public data publication or a claim of WCAG conformance; no UI is changed.
- [Ollama official API documentation](https://github.com/ollama/ollama/blob/main/docs/api.md?plain=1)
  documents generation options, structured output and token/duration observations.
  Fixing options does not turn a probabilistic model into independent ground truth.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
  supports reusing database-scoped admission across application/CLI processes.

No release, package-version bump or live-container update is part of this change.
