# Grounded library comparison design

## Finding and scope

On 20 September 2026, the preceding anonymous comparison changed decisions on
22 of 50 reordered cases. Earlier independent ordinal grading also increased
instability. Neither experiment supports automatic adoption. This change tests
explicit evidence references and distinguishes contradiction from missing evidence,
without teaching library names or fixed genres as routing rules.

## Selected design

- Extend the existing read-only benchmark with exclusive `--leader-grounded`.
  Reuse complete candidate scope, private sanitized plans, clean grouped holdouts,
  exact-neighbor integrity checks, local-only inference and source verification.
- Keep the preceding two-call comparison as a within-case control. Add three
  grounded assessments: original, byte-identical repeat, reversed candidates and
  examples. At most 32 cases / 160 generation calls, explicitly requested; zero
  generation is the default. Do not retry malformed output or select cases by result.
- For every candidate, return only a fit category and numbered supporting or
  contradicting examples. Missing information is insufficient, not contradiction.
  Supported fit requires at least two distinct references and no contradiction;
  this is an experimental evidence floor, not independent votes or a probability.
- Validate exact scope, shape, reference ranges, duplicate references/keys, and
  category consistency. Remap both candidates and references after reversal.
  A distinct supported candidate is required. Ties and absent support abstain.
  Any repeat or reorder change in decisions or cited assessments withholds support.
- Report fixed aggregate reasons, per-media results, control comparisons and
  repeatability separately. Never serialize private prompts, titles, destinations,
  descriptions or raw provider responses. Valid references establish input binding,
  not that the cited text entails the model's assessment.
- Keep live routing, training labels, database schema and UI unchanged. No new
  acknowledgements or user review chores. Provider failures stop the run; source
  drift invalidates it. Fresh invocations retain normal admission and recovery.

## Options, tradeoffs and recommendation stack

| Option | Pro | Con / decision |
| --- | --- | --- |
| Repeat uncited ordinal scoring | Small output | Already unstable; reject |
| Grounded full-scope assessment with paired control | Auditable input references, explicit abstention | Five calls per case; implement offline |
| Trust a citation or majority vote as truth | Fewer reviews | Correlated or fabricated interpretation; reject |
| Change automatic routing now | Immediate automation | No independently demonstrated correctness; defer |

Recommended stack: validated organic inventory → provenance-clean retrieval →
full-scope semantic assessment → reference validation → repeat/order checks →
source-verified aggregate comparison → unchanged routing safeguards. Evaluate TV
separately and a disjoint description cohort before recommending any adoption.

## Official sources checked on 20 September 2026

URLs were discovered through web search and opened, rather than guessed.

- [Ollama structured outputs](https://ollama.com/blog/structured-outputs) supports
  schema-constrained generation plus application validation. Deterministic settings
  are controls, not a correctness guarantee.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports provenance checks, untrusted-context boundaries, bounded inputs and
  fail-closed output handling. Citation binding is not semantic validation.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  calls for accessible feedback without unnecessary interruption. This offline
  experiment adds no screen clutter; future summaries should expose actionable
  results, with technical evidence available on demand.

Implementation and measured results belong in the separate outcome document.
