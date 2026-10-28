# Prospective disagreement report investigation outcome

Date: 2026-10-28. Status: agreed scope implemented and locally verified.
See the separate [design and research](prospective-disagreement-report-design.md).

## Baseline

The working tree started clean on `main` at
`7c840bb16f2d7eb7a53f2cc721edc9da9b73dac2`. The prior delivery added explicit
History feedback with bound original-destination references and frozen v3 action
evidence. The next recommendation is a bounded disagreement diagnostic.

GitHub MCP returned no open repository PRs, including Dependabot. No random
candidate or stale PR is available to apply or rebase. No PR mutation is needed.

## Verified findings

Independent read-only tracing established the following boundaries:

- Frozen ranking v2 preserves an experimental description/metadata/company
  comparison. It does not preserve the final policy/AI ranking or declared intent.
- Trustworthy original destinations can sometimes come from frozen outcome
  decision context or v3 original-destination references. The current query's
  retained History `original_decision` must remain exclusion context rather than
  positive historical proof.
- Runtime confirmation, retained correction and History feedback have different
  reference semantics. A report must retain those origins instead of combining
  their meanings through destination equality.
- Existing preparation already handles strict bindings, temporal exclusions,
  conflicts, legacy unknowns, unavailable destinations and connected identity/
  description holdouts. A shared disposition extraction is the first useful
  refactor, before adding a separate diagnostic interpretation.
- Existing Evaluation progress HTTP/UI contracts are aggregate-only. Item-level
  details would add a privacy boundary. The existing private prospective CLI is
  the smallest proposed first surface.
- Existing source reads can enforce read-only repeatable-read transactions and
  database-side payload admission. The abortable helper requires a signal;
  read-only options alone do not select it.
- API-key authentication and representative-review reads can write operational
  audit data. Neither is a shortcut for a strict no-application-DML reader.

The implementation therefore cannot honestly claim to explain historical intent
from current rules or inferred-purpose signal summaries. A first report can show
frozen numeric disagreements and state exactly which explanatory evidence is
missing. Prospective policy/intent capture would be a separate later contract.

## Agreement and research

The first round confirmed frozen evidence with explicit gaps and a private CLI
first surface. The final question confirmed exact private IDs/numeric alternatives,
separately named comparisons, a 50-case / 1 MiB display cap after whole-cohort
gating, bounded coherent reads and the full no-mutation/no-new-surface safeguards.
Implementation followed this shared-scope agreement; it is not a production
deployment approval.

Official PostgreSQL, OWASP, scikit-learn and W3C sources were discovered/read via
MCP on October 28, 2026. The design records links, alternatives, pros/cons and the
proposed recommendation stack. These are not compliance or accuracy claims.

## Implemented outcome

The existing CLI now has an explicit `--prospective-disagreements` mode. It reads
one database-clock thirty-day snapshot with database-side payload admission and
genuine abortable read-only repeatable-read transactions. Report construction
occurs after the read transaction. It writes no source evidence, report file,
audit checkpoint, learning data or routing state.

Shared case preparation preserves aggregate eligibility and exclusions. The new
report separately describes original-versus-assessment, baseline-versus-assessment,
company-versus-assessment and experimental-arm differences. It retains reference
origins, exact IDs, explicit gaps, abstentions and bounded frozen numeric
alternatives. Current policies/History prose never become historical intent or
original-decision proof. Display caps apply only after whole-cohort holdouts.

The audit reuses the extracted snapshot reader without new write authority.
Existing aggregate CLI modes and reports remain unchanged. No client API/UI,
capture version, schema, dependency or scheduled job was added.

## Verification

The unchanged focused baseline passed five backend suites / 68 tests, using pinned
Node 24.22.1 and npm 12.2.1. This covers prospective outcomes/evidence/activity,
the evaluation CLI and the audit repository before any refactor.

Five hundred deterministic adversarial cohorts matched the committed pre-refactor
evaluator's complete output or error exactly. New report/CLI tests cover exact
BIGINT IDs, source-specific reference semantics, original gaps/conflicts, unchanged
legacy action handling, whole-cohort display limiting, maximum candidate arrays,
privacy and real CLI sanitized errors. The unchanged source baseline and new
focused tests pass; final full-coverage and gate totals are recorded below.

Five disposable PostgreSQL suites / 43 tests passed, including the new reader and
existing audit/prospective/feedback paths. The new tests verify read-only DML
rejection, repeatable-read coherence during a committed source edit, database-clock
windows, payload withholding, active-query cancellation and unchanged checkpoint
and source state. A real CLI child process also returned one parseable JSON report
with exact BIGINT identity and no startup/query logs mixed into stdout, despite
initial debug logging. Canonical receipts remain append-only: the fixture uses the
harness's disposable suite database, rather than disabling guards for cleanup.

The first full run caught stale ownership-manifest hashes because it was started
before that review was recorded. The exact CLI, audit extraction and new source
reader were reviewed; existing unresolved debt was retained. The ownership gate
and its 42 tests passed before restarting the clean full coverage run.

Client source is unchanged. Its existing final full-coverage report remains
applicable; no new endpoint, component or browser workflow needs client changes.
No production database operation, provider request, historical import, branch,
PR merge, release or deployment has been performed.

| Check | Local result |
| --- | --- |
| Committed aggregate parity | 500 adversarial cohorts matched complete results/errors exactly |
| New report and CLI units | 21 tests passed, including maximum candidate arrays and a real sanitized CLI failure |
| PostgreSQL regressions | Five suites / 43 tests passed, including real CLI process success |
| Full backend coverage | 1,892 suites; 61,097 tests passed, one existing skip; statements/lines 89.18%, branches 86.53%, functions 90.68% |
| Client coverage | Reuse unchanged client source/report: 481 files / 7,440 tests, statements 87.84%, branches 81.92%, functions 87.57%, lines 89.52% |
| Coverage ratchet | Both scopes passed against the unchanged baseline, using fresh backend coverage and unchanged client coverage |
| Source quality | Server lint/types, standard/production Knip, ESM imports/mock shapes, ownership and four production policy gates passed |
| Storage and documents | Migration/schema integrity, copyright and Markdown passed; no migration or schema change needed |
| Staged patch | Redacted secret and whitespace checks passed |

## Delivery

Implementation, tests, Unreleased, reviewed ownership drift and the separate
design/outcome documents were committed and pushed on `main` as
[6ee366d65f380a02c8c54e63d0fb7dcae082073f](https://github.com/cloudbyday90/Classifarr/commit/6ee366d65f380a02c8c54e63d0fb7dcae082073f).
GitHub MCP verified the canonical commit URL. Remote main matched and the working
tree was clean. This receipt-only follow-up changes no tested application source.

Verification used pinned Node 24.22.1 and npm 12.2.1. Backend coverage excludes the
separately executed PostgreSQL suites. Client source/report were unchanged; the
coverage baseline was not updated. Final Markdown checked 2,386 documents with
zero errors; staged redacted secret and whitespace checks passed.

The push notice still reports one existing low dependency alert. Dependency
manifests and existing Unreleased security holds are unchanged; no advisory
closure is claimed. Hosted CI after push is separate from the local evidence.
No new branch, PR merge, release, production database operation, provider request
or deployment was performed.

## Expected next boundary

The follow-up is now documented in the separate
[policy evaluation capture design](prospective-policy-intent-capture-design.md)
and [outcome](prospective-policy-intent-capture-outcome.md).

The first demonstrated explanatory gap is missing prospective policy/intent
provenance. Next, design a versioned, bounded capture of the actual policy candidate
ranking and declared-versus-inferred purpose authority at the decision boundary.
Validate it against observed disagreement patterns before changing scoring. This
would supply future explanations, not recover past evidence. Current library
membership, mutable policies and model agreement must not become historical labels
or correctness proof.
