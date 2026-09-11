# Inventory description evidence-budget benchmark

## Decision

Evaluate 9, 30, and 100 retrieved description examples per query on a seeded
100-title inventory sample before increasing the live prompt budget. This is a
local, read-only experiment, not an automatic-routing qualification or a new
settings screen. The live limit remains three descriptions per candidate.

## Experiment

Take one repeatable-read snapshot of current active inventory, library names,
and unexpired vectors for the inspected local embedding model/digest. Reuse the
existing synopsis projection, conflicting-identity exclusion, and vector cache.
Do not populate the cache or call external providers during this experiment.
Fail the preflight if coverage is incomplete; let the existing refresher catch up.

Select up to 100 unique descriptions, balanced across media type and library.
Assign multi-library items to their smallest eligible library for sampling only.
Seeded hash ordering and a snapshot fingerprint make runs comparable when the
inventory, descriptions, memberships, model, and vectors are unchanged. This is
a balanced diagnostic sample, not a population-weighted accuracy estimate.

Hold out the entire sample, including every copy of its description, from every
query's neighbors. Compute cosine similarity once per unique description. Freeze
the three highest-ranked same-media libraries using their mean top-three
similarities, without looking at the query's observed placement. Report cases
whose observed destination is absent from that shortlist. This deliberately
isolates description retrieval and generation; it does not replay the live
policy engine or claim its nine-example arm is a live end-to-end baseline.

Allocate examples round-robin across the frozen shortlist. The smaller arms are
prefixes of the larger arm; never pad with duplicates when a library runs short.
Record actual example counts and shared examples. Rotate candidate order by case
and arm execution order across cases to reduce fixed ordering/warm-up bias.
Use the same bounded synopsis lengths, prompt, temperature, seed, context size,
and output limit in every arm. Disable optional thinking in this controlled
experiment; reasoning-mode comparisons are a separate experiment.

Preflight all sampled titles. Explicitly request local generation for up to the
sample size; distinguish that number from the sampled/held-out size. Bound each
request and the entire run, allow cancellation, and retain completed aggregate
results on interruption. No automatic retries, cloud fallback, model pulls, or
changes to routing, policies, labels, or stored classification decisions.

## Measurements and limits

- Requested versus actual examples, candidate coverage, and selected title count.
- Successful proposals, abstentions, invalid outputs, failed requests, and skipped
  calls, with explicit denominators and paired destination changes.
- Wall-clock latency and provider-reported prompt/output tokens, including cold
  starts. These are single-run observations, not significance claims.
- Observed-placement agreement is a weak diagnostic, **not accuracy**. This
  benchmark does not ingest independent labels; accuracy remains null even when
  inventory agreement is high. Future qualification needs a separately verified
  reference set that was not used for retrieval or tuning.
- Input byte limits and output reserves bound work, but are not a tokenizer.
  Provider input-token counts cannot prove that no earlier input was truncated.
  Report input truncation as unknown and flag context-limit suspicion explicitly;
  never report verified full-context consumption without that evidence.

## Security and user experience

Only the saved trusted local Ollama endpoint and installed non-cloud models are
eligible. Verify model digests before and after generation, reject redirects,
bound HTTP bodies and time, and validate outputs against numbered candidates.
Descriptions and library names are untrusted quoted data, not instructions.
Model output has no tools or write authority. Print only allowlisted aggregates,
fingerprints, and model provenance; no titles, IDs, snippets, prompts, raw model
responses, host configuration, or exception details. Private inputs stay in memory.

No UI changes are necessary for an offline benchmark. If a summary is later
surfaced in Command Center, show one concise completion/status message and put
diagnostics behind disclosure. Avoid per-title alerts or new acknowledgements.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Increase live examples immediately | Immediate broader context | Unmeasured latency, noise, and truncation | Defer |
| Keep nine indefinitely | Lowest current prompt cost | May miss useful distinctions | Retain only as baseline |
| Paired 9/30/100 local benchmark | Measures the trade-off on this inventory | More local compute; no accuracy without independent labels | Implement first |
| Label-backed routing qualification | Measures correctness and safe automation | Requires representative independent references | Next stage |

Final stack: current synopsis cache → fixed held-out sample → balanced nested
retrieval budgets → bounded local generation → aggregate comparison → independent
accuracy evaluation before any automatic-routing or live-budget change.

## Official sources and date boundary

Research checked September 11, 2026 for the requested August 2026 baseline.
Living documentation is not an archived August snapshot; do not present later
edits as verified August guidance.

- [Ollama generation API](https://docs.ollama.com/api/generate): completion and
  usage fields permit explicit latency/token reporting, not a correctness score.
- [Ollama Modelfile reference](https://docs.ollama.com/modelfile): context, seed,
  and output limits make the generation settings explicit.
- [Ollama context length](https://docs.ollama.com/context-length): larger contexts
  require more memory; provider allocation matters as well as model capability.
- [Lost in the Middle (2023)](https://arxiv.org/abs/2307.03172): longer context
  does not guarantee effective use of all evidence; evaluate task performance.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  preserve provenance and boundaries, limit retrieved input, and validate output.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  accessible status feedback should not become unnecessarily chatty.
