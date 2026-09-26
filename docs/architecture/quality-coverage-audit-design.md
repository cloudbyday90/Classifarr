# Quality coverage audit: design

September 26, 2026. Follow-up to `24cee4a2`.

## Evidence and decision

A read-only catalog check of the running local Classifarr database found no
`quality_evidence_study`, `cached_adjudication_batch`,
`automatic_source_pair_evaluation`, or `adjudication_capture_budget` tables.
The running installation therefore cannot yet supply this experiment's evidence.
Do not invent coverage, enable capture, or implement a new selector based on that
absence. This commit will not upgrade or restart it.

Add `--audit` to the existing private study command. A short, repeatable-read,
read-only transaction checks required schema capabilities before querying study
data. It returns a bounded aggregate with a fixed next-step explanation. Missing
schema is `upgrade_required`, not zero coverage and not a database stack trace.
Catalog visibility also depends on database privileges; guidance must explain
checking access before concluding that an upgrade is needed.
The audit must not use the budget repository's mutating read/reset methods.

For an installed study, separate completed pairs, pairs whose remaining arms only
need cache backfill, and blocked pairs. Count fixed gap reasons and unique missing
request hashes without exporting them. Reuse the existing quality/reference
validator and metrics; never infer independent labels from current placement.
Compare stored diagnostic/study cohort overlap only when both are valid and
unexpired. This is a stored-reference comparison, not proof of current request
eligibility, model identity, source freshness, or eventual capture completion.
Different stored cohorts can include already-completed cases; a mismatch alone
does not establish the cause of the missing responses or justify a selector change.
Cache timestamps and record count describe stored metadata only, not response
validity. The daily call setting is not the remaining daily allowance. Neither
piece of context authorizes or guarantees capture.

Only fixed status codes, aggregate counts, protocol reference, and bounded timestamps
leave the audit. Do not read prompts, source titles, raw responses, or library
metadata. Preserve the current private-file containment and exclusive-write rules.
The audit does not acquire the heavy worker lease: it must remain usable while
evaluation is busy or deferred. Enforce query/transaction deadlines instead.

## Alternatives and recommendation stack

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Build a new capture selector now | Could fill some gaps | No live evidence identifies that gap yet | Defer |
| Increase cache/budget | More responses | More cost and still no deployment or labels | Reject |
| Another Command Center panel | Visible status | More density and new API/UI surface | Defer |
| Read-only audit in existing CLI | Repeatable, actionable, no inference | Requires intentional execution; historical evidence only | Implement |

Recommended stack: fixed PostgreSQL catalog checks → consistent read-only snapshot
→ pure ESM aggregate projection → strict output contract → existing private CLI.
Keep Vue SWR and pause controls unchanged. No new dependency, migration, worker,
provider call, deployment, release, or routing permission is required.

## Official research discovered and read online

- [PostgreSQL 18 application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html):
  multiple reads under read committed can see different committed states. Use one
  repeatable-read snapshot and report its observation time; it is not a live guarantee.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document test sets, methods and limitations and involve independent assessors.
  Separate unavailable evidence, synthetic validation, and actual quality findings.
- [W3C Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification):
  explain errors in text. Apply that usability principle through fixed descriptions
  and recovery instructions. This CLI change is not a claim of web WCAG conformance.

## Acceptance

Test missing and partial schemas, inactive/expired/invalid studies, mixed movie/TV
coverage, shared request deduplication, blocked-plus-missing arms, disabled capture,
cohort mismatch, independent/synthetic reference status, and strict egress rejection.
Exercise a real PostgreSQL read-only transaction and show that budgets, checkpoints,
expiry, and evidence do not change. Do not fabricate independent reviewers.

The older held-out reviewer tools bind a different packet contract with 24–32
fixtures; they cannot directly consume the new 300-case packet. Any future adapter
must preserve independent submission binding and disagreement handling rather than
silently relabeling those documents or weakening their limits.
