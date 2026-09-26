# Quality coverage audit: outcome and operation

September 26, 2026. See the separate [design, research, and tradeoffs](quality-coverage-audit-design.md).

## Previous commit reassessment and live finding

`24cee4a2` solved evidence retention across rotating AI caches. It did not deploy
the new evaluation system, enable capture, or establish independent truth labels.
Those distinctions still hold; retention alone is not a quality improvement.

The running local installation lacks all four required tables: study, cached
adjudication, automatic source-pair evaluation, and capture budget. This is a
deployment prerequisite, not evidence of a broken capture selector. No real cohort
coverage, accuracy, or eligible sample count can be claimed from this installation.

A bounded, repeatable-read, read-only catalog query through the existing local
container produced `.tmp/quality-audit-live-20260926.json` using the new projection
and private writer. Its status is `upgrade_required`, with null study metrics,
zero provider calls, zero database/routing writes, and no promotion permission.
This was a catalog-only adapter because the new CLI is not installed in the running
image; it did not copy code into or restart that container. The complete runtime
was exercised separately against disposable PostgreSQL databases.

## Delivered behavior

- Reuse the private study CLI with `--audit`; no new scheduler, API, migration,
  dependency, or Command Center panel.
- Check required schema columns before study queries, including partial upgrades.
  Explain missing schema/access, absent/expired/invalid/inactive studies, non-cache
  blockers, disabled capture, cohort gaps, missing responses, and reference review.
- Report movie/TV and total paired/backfill-only/blocked counts, fixed arm-level gap
  counts, and unique missing requests. A blocked pair can still have a missing arm;
  gap counts therefore are not unique-item counts.
- Compare valid, unexpired stored cohorts without revealing item/request/library
  identifiers. Only aggregate quality metrics and a hashed protocol reference leave
  the audit; source names, prompts, raw responses, and credentials do not.
- Use one PostgreSQL repeatable-read/read-only transaction, with five-second query,
  one-second lock, and fifteen-second transaction limits. Do not seed budget rows,
  reset quotas, prune studies, renew expiry, or initialize providers/replay workers.
  The cheap audit works independently of the heavy discovery admission lease.
- Preserve existing ESM services, Vue SWR, music exclusion, and routing controls.

## Usage after installation

Run from the repository root with the intended database environment. Credentials
belong in the existing environment configuration, never the command line or report.
Choose a fresh private output filename for each run:

```powershell
node server/src/scripts/runQualityEvidenceStudy.mjs --audit --output-file .tmp/quality-audit.json
node server/src/scripts/runQualityEvidenceStudy.mjs --audit --reference-file .tmp/quality-reference.json --output-file .tmp/quality-audit-reviewed.json
```

The reference contract remains `source_pair_quality_reference.v1`, bound to the
exact saved protocol. Synthetic labels are software-test evidence only. JSON can
declare independent provenance but cannot verify that reviewers were independent.
Never convert library placement, model predictions, or synthetic labels into truth.

Stdout contains fixed guidance and an aggregate receipt. The private JSON contains
the full bounded audit. Exclusive writes never overwrite an earlier artifact.
Exit 2 means the audit completed but found a prerequisite or incomplete/synthetic
evidence. Exit 0 means a historical comparison is available, not release approval,
safe routing, verified independent review, or current-input verification. Exit 1
means the command failed; failure text excludes database/provider details.

The audit does not collect or backfill evidence itself. Existing opt-in study
collection remains responsible for that. Stored cache timestamps/counts do not
validate response content or current model identity; the capture setting does not
show remaining quota. Unknown context remains null, not an invented zero. Locally
exported files do not expire automatically; keep them private under operator retention.

## Validation and PR availability

Focused validation passed 67 unit tests and eight real PostgreSQL tests. Coverage
includes 300 synthetic movie/TV cases, shared requests, mixed blocked/missing arms,
future-dated evidence, strict output validation, missing/partial schemas, actual
read-only enforcement, concurrent-update snapshot consistency, cancellation, pool
cleanup, worker/admission bypass, and exclusive private output. A fresh Node CLI
process against the disposable database verified exit 2 for an incomplete audit,
exit 1 on an existing output file, silent stderr on success, and unchanged DB rows.

Full regression and quality gates:

- PostgreSQL: 167 suites / 1,922 tests passed; one existing suite/test skipped.
- Frontend: 383 files / 5,338 tests passed. Coverage: statements 85.73%, branches
  77.84%, functions 85.30%, lines 87.79%. Production build passed.
- Backend/frontend type checks, lint, copyright, development/production dependency
  checks, static ESM imports, ESM mock shapes, migration/snapshot integrity,
  documentation lint, and diff checks passed. The existing nonliteral-path lint
  warning in `captureOperatorCorrectionFrozenPolicy.mjs` remains unchanged.
- Backend: 1,452 suites / 43,180 tests passed. Coverage: statements/lines 90.36%,
  branches 84.38%, functions 92.21%. Each new audit service has 100% statement,
  line, and function coverage; contract branch coverage is 96.93%, with the other
  two audit services at 100%. The combined coverage ratchet passed without changing
  its baseline.

GitHub MCP searches for open PRs in `cloudbyday90/Classifarr` returned no results
twice on September 26. No random open PR was available to implement; no closed PR
was substituted and no PR was merged.

## Recommendation stack and concrete next component

Keep PostgreSQL snapshot isolation, small ESM projection/contract/repository
modules, and the existing private CLI. This yields explainable, inexpensive checks
without new inference or infrastructure. The tradeoff is deliberate CLI execution
and historical evidence, not an automatic live quality guarantee.

The immediate operational prerequisite is a separately authorized release and
controlled deployment using the existing upgrade/recovery checks. This commit
does not create that release or rebuild/restart the live installation.

The next code component should adapt **independent reviewer submissions to the
300-case frozen protocol**. Reuse the existing private-file and consensus utilities,
but add an explicit new packet adapter: validate protocol/case membership, keep
submissions separate and blinded, detect duplicate reviewers, and retain unresolved
disagreements. The older 24–32-case held-out packet cannot be silently relabeled.
Test this adapter offline; do not manufacture actual reviewer judgments.

After installation, run one registered study and the audit to obtain the first
honest movie/TV quality baseline. Add a budget-neutral protocol-bound capture
selector only if the audit demonstrates an actual cohort/request coverage gap.
Do not add another queue, dashboard, or higher AI budget to bypass these prerequisites.
