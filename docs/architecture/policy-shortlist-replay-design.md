# Production-contract shortlist replay

## Scope and predeclared comparison

Commit `531076e0` preserved an omitted description leader before the AI cutoff.
Its fresh 300-item candidate-recall result improved from 297 to 299 observed
destinations, but did not measure model choices or routing eligibility.

Add a read-only mode to the existing benchmark command. Replay the latest retained
policy decision for each distinct stable item identity, against current active
libraries and current retrieved evidence. Compare the former metadata-only
shortlist with the description-preserving shortlist. Keep policy scores and
decisions fixed between arms. Do not invent policy scores for inventory-only items.
The local database currently has only four distinct retained policy cases; 72
history rows are repeated runs, not 72 independent examples.

Share production base-prompt assembly, evidence projection, response schema,
response parser, advisory finalizer, consensus assessment and route-safety checks.
Do not call the provider router, repair/telemetry writers, question creation,
consensus receipt issuer or media routing. Report potential consensus eligibility
separately from actual route authorization: historic policy is not fresh authority.
This is production-contract replay, not a full fresh policy evaluation or an
end-to-end deployment accuracy claim.

Collect description evidence and learned profiles once per case. Reuse profile
reads and identical prompts with identical candidate mappings within the pair. Alternate execution order for changed
prompts. Detect inconsistent evidence for shared candidates; do not silently
compare different snapshots. A local generation uses fixed seed/temperature,
bounded output, no fallback, no model pull, and model-digest checks before/after.
The replay follows production's reasoning-model grammar bypass, but fixes thinking
off, temperature 0, seed 42 and the 256-token output budget for this experiment.
These transport controls are not a claim to reproduce every live provider setting.
Report errors, truncation signals, actual calls, reused results, latency, proposal
changes, consensus blockers and media-type coverage. Never publish raw prompts,
model explanations, item names or library names in the report.

Preflight performs no generation; description retrieval may embed a missing query
in memory using the configured local embedding model. Full-pool description
evidence is shared between arms, including its conservative shared-item flags.
Policy/configuration snapshots are checked for drift; this does not refresh old
policy scores or make the whole inventory immutable during inference.
The size option is a maximum of 300 distinct
retained cases, not a requirement to manufacture 300 records. Retained cases are
historically selected and not a random representative accuracy test. Current
inventory placement is not treated as a verified label; this replay reports
proposal changes, not placement agreement or accuracy.

## Official research and tradeoffs

Sources were discovered through search and opened September 12, 2026. W3C's linked
technique records a January 12, 2026 update. Current Ollama/OWASP documentation is
not represented as an archived August snapshot.

- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
  recommends schema-constrained output and application-side validation. Reuse the
  production adjudication schema and parser rather than the benchmark's simpler
  candidate-number contract. Keep production prompt text unchanged in this study.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports retrieval scoping, untrusted-content boundaries, provenance and output
  enforcement. Replay cannot turn a model proposal or historic record into routing
  authority. Read-only database connections provide a second enforcement boundary.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  describes polite, non-focus-stealing status updates. No new UI is needed for this
  internal measurement; any future Command Center summary should reuse that pattern
  instead of adding per-case prompts or acknowledgements.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Replay production contracts over retained cases | Tests the actual prompt/parser and real policy constraints | Small, historical, non-representative case set | Implement and disclose coverage |
| Fabricate policy scores for the 300-item corpus | Larger apparent end-to-end dataset | Cannot measure actual policy gates honestly | Do not do |
| Invoke the full live classifier | Includes every production integration | Can write telemetry, questions, learning or route media | Keep outside this non-routing comparison |
| Repeat identical prompts twice | Measures generation variability | Extra calls do not isolate shortlist effects | Reuse exact prompts; report reuse |
| Relax routing thresholds | Immediately reduces reviews | Does not establish semantic correctness | No threshold changes |

## Validation and recommendation stack

Test prompt parity for all modes, schema selection, strict candidate bounds,
invalid/limited responses, cancellation, snapshot drift, shared-candidate evidence
consistency, true changed-choice pairs, identical-prompt reuse, unknown labels,
consensus rejection and zero write capabilities. Use PostgreSQL integration and
the rebuilt local Compose instance. Keep design and measured outcome separate.

Stack: retained policy + current eligible inventory → shared evidence capture →
baseline/protected shortlist → production prompt/schema/parser → advisory and
consensus assessment → aggregate comparison, with no routing receipt or writes.
