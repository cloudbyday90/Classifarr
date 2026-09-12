# Fresh inventory policy evaluation design

## Decision and scope

Evaluate the existing 300-item movie/TV cohort with fresh policy decisions, not
stored classification results. Reuse production policy scoring, exclusions,
candidate ranking, bounded AI adjudication and routing checks. This is a local,
read-only diagnostic component, not another settings panel or an automation gate.

Freeze current policy configuration and inventory in a repeatable-read snapshot.
Split identities and duplicate descriptions into grouped folds **before** building
library observations, learned metadata profiles or description neighbors. Rebuild
those inputs from the training portion for each fold. Existing placements are
weak comparison labels; never pass the query's library membership into scoring
or its prompt. No fixed library names, categories or destination overrides apply.

Current policies remain configured inputs, including their existing provenance.
This does not undo historical influence on policy configuration. Historical RAG,
learned patterns, outcome history, source-library shortcuts and exact-inventory
identity lookups are unavailable in this evaluation because those sources do not
yet have fold-safe readers. Do not silently reuse them or describe this as full
production-input parity. Inventory description RAG remains available from the
held-out snapshot. Missing or conflicting query metadata must be counted.

Only production-admitted adjudication receives a local generation call. Other AI
modes are counted separately; verification is not silently converted into
adjudication. The report separates fresh policy coverage, shortlist inclusion,
placement agreement, valid responses, abstentions, skipped modes, safety blockers
and measured generation cost. No independent labels means accuracy stays null.

## Options and tradeoffs

| Option | Benefits | Costs / limitations | Decision |
| --- | --- | --- | --- |
| Replay stored decisions | Small, reproducible response-contract check | Does not test fresh policy or learning | Keep as a separate regression tool |
| Invoke the live classification worker | Closest operational path | Writers, routing side effects and held-out leakage | Do not use for this benchmark |
| Isolated adapter with production evaluators | Fresh decisions, bounded inputs, no domain writes | Explicitly incomplete historical evidence; adapter needs parity tests | Implement |
| Force all cases through AI | Uniform generation count | Bypasses production mode selection and manual-review constraints | Do not implement |

Recommended stack: frozen inventory and policy snapshot → grouped fold training →
production policy evaluation with held-out library evidence → policy-eligible
description/metadata shortlist → admitted local AI proposal or abstention →
production validation and safety assessment → aggregate report.

## Security and usability

Use a dedicated PostgreSQL pool with default read-only transactions, statement
and lock deadlines, bounded records, and no transaction held during inference.
Only the configured admitted local model is used; no cloud fallback, model pull,
embedding fill, policy mutation, review question, routing receipt or learning
record is available through the adapter. Recheck source and model fingerprints;
configuration, policy, scope or vector drift invalidates the run. Treat descriptions as untrusted data and
retain the production bounded prompt projection and strict response contract.

Fingerprint the resolved policy inputs and observed metadata traits, not unused
authoring views, observation-expiry fields or metadata-fetch timestamps. Changes
to authority validation, constraints, thresholds, library names, descriptions,
memberships or vectors still invalidate the snapshot. Serialize bulk policy reads on the single
transaction connection, even when a production reader submits them in parallel.

After preparation, metadata-only background refresh is reported, not used as a
reason to restart a read-only evaluation. All query metadata, observations,
learned models and prompts already belong to the starting snapshot. Report
`snapshotScope: frozen_at_start`, `liveMetadataRefreshed: true` and
`sourceVerified: false` when this happens. Such results do not describe the updated
live metadata or authorize a current route. Metadata drift before generation
still requires a new preparation. This avoids interrupting organic enrichment
or discarding valid frozen-snapshot measurements merely because enrichment runs.

Public progress and reports contain counts, anonymous library strata and aggregate
fingerprints, never titles, metadata identifiers, library names, descriptions,
raw responses or exception text. The runtime requires logging to have started
with `LOG_LEVEL=fatal` and `FILE_LOGGING_ENABLED=false`, checking the immutable
logging configuration before opening its reader. Setting environment variables
after ESM imports would not disable already-created production loggers.
No UI change is necessary. A future Command
Center summary should show outcomes and exceptions, with technical detail on
demand, and announce updates without moving keyboard focus.

## Official research

Sources were discovered through online search and opened on September 12, 2026.
These established practices apply to the requested August 2026 design baseline;
mutable documentation is not an archived August snapshot.

- [scikit-learn: common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)
  explains fitting only on training data and preventing preprocessing leakage.
  The application uses its existing JavaScript learners, not a new Python stack.
- [PostgreSQL 17: SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html)
  documents repeatable-read snapshots and read-only transaction restrictions.
- [node-postgres: transactions](https://node-postgres.com/features/transactions)
  requires the same checked-out client for all transaction statements, with
  explicit commit/rollback and release. The adapter retains that boundary.
- [OWASP: LLM prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
  treats retrieved content as an injection surface. Bounded untrusted evidence,
  strict output validation and absence of write capabilities remain layered
  controls; a valid proposal is not proof that its classification is correct.
- [Ollama: Generate](https://docs.ollama.com/api/generate) documents structured
  formats and generation usage fields. Keep the existing admitted transport and
  strict application parser; schema conformance is not destination accuracy.
- [W3C: ARIA22 status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  supports non-disruptive status updates. This CLI change adds no interface to
  audit and makes no claim of platform-wide WCAG conformance.

## Verification and outcome

Test fold exclusion (including copied descriptions), metadata conflicts, fresh
scoring, mode admission, private-data redaction, cancellation, drift, budgets and
read-only snapshots. Run local Compose without concurrent heavy tests so bounded
retrieval and generation measurements remain interpretable. Record actual counts
and limitations in the separate outcome document before considering live changes.
