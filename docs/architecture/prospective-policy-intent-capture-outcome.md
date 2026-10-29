# Prospective policy evaluation capture investigation outcome

Date: 2026-10-28. Status: agreed scope implemented and locally verified.
See the separate [design and research](prospective-policy-intent-capture-design.md).

## Baseline and requested work

The working tree started clean on `main` at
`371b29d303e85c39e65bad612a7f83aecbf1313a`.
The next recommended item is prospective capture of the actual policy evaluation
and purpose provenance, followed by validation in the existing private report.
The user requested direct-main implementation, documentation, local checks and
commit/push, with no release.

GitHub MCP returned no open repository PRs, including Dependabot. No random open
PR or stale Dependabot PR is available to implement or rebase. No PR mutation was
performed.

## Verified repository findings

Read-only investigation established these boundaries:

- The production policy-engine wrapper and generic evaluator are separate. The
  generic evaluator also serves offline folds and workers; new capture authority
  must be explicitly live-only.
- The live policy query is not capped at 64. A diagnostic limit must not reduce
  live scoring or silently turn a partial snapshot into a complete pool.
- Policy evaluation filters the media-compatible pool, evaluates candidates,
  excludes conflicts/non-comparable results, adjusts and ranks survivors, then
  normalizes the decision. The final ranked result alone omits excluded policies.
- A later classification pass can replace the initial policy evaluation.
  Contrastive retrieval also builds a reduced copied ranking. Neither an earlier
  discarded evaluation nor that temporary copy is the retained policy reference.
- Existing purpose provenance already distinguishes `declared_native`,
  `profile_derived`, `mixed` and `unverified`. Native storage and eligible runtime
  admission do not establish operator declaration.
- Existing candidate cards/diagnostics do not retain complete declaration
  provenance. Current intent contracts include raw rule values and cannot be
  stored or printed wholesale under the agreed privacy boundary.
- Classification persistence has asynchronous work before insertion. Its existing
  held shadow pattern authenticates the same minted object and typed identity;
  a new capture should preserve that boundary and also recheck final ranking.
- Pending classification writes can run inside a transaction. Catching an
  optional diagnostic SQL failure there does not recover an aborted PostgreSQL
  transaction. Existing post-lifecycle witness persistence is the appropriate
  nonblocking placement pattern.
- The queue-witness repository lacks the new expiry/update guards and uses a
  safe-number classification-ID conversion. It cannot be reused wholesale for
  exact BIGINT-bound immutable evidence.
- Portable backups use an explicit configuration export catalog. The new child
  evidence should remain outside it. Retention across configuration restore was
  recommended only while the original History row survives, without reading
  current policies to reinterpret historical IDs.

These findings explain the present diagnostic gap. They do not establish why any
specific historical classification selected the wrong library: the missing
policy/provenance evidence must remain unknown.

## Agreement and implementation

The user confirmed:

1. Capture the retained live policy evaluation, complete media-compatible
   evaluated pool up to 64 candidates, final order, closed exclusions and
   separate authority/provenance/admission facts.
2. Use immutable classification-bound first-write child evidence with a
   thirty-day payload, expiry tombstones, backup exclusion and best-effort
   postcommit persistence.
3. Integrate validated new evidence into the private disagreement CLI while
   preserving historical gaps, cohort eligibility and scoring denominators.

The final question confirmed retention through configuration restore while
History survives, History-delete cascade, 64 KiB per complete capture,
database-side payload admission, and preservation of existing private report
limits and reference semantics. All four scope questions were answered before
implementation, following the repository's
[grilling workflow](../../.agents/skills/grilling/SKILL.md).

Four small service modules now handle the closed payload/byte contract, live
minting and held receipt, immutable child persistence/expiry, and validated
private reading. The live evaluator supplies complete pool/exclusion facts;
generic offline evaluators default off. Classification persistence holds the
retained evaluation before awaits, rechecks its ranking and identity, and writes
best-effort after the classification commits.

The new migration and reproduced fresh schema preserve immutable headers and
expiry tombstones, reject direct replacement/deletion/truncation, and cascade
only with History. Configuration restore retains surviving evidence and
portable configuration export excludes it. Existing maintenance clears bounded
expired payload batches; the private reader withholds expired payloads even
before cleanup.

The private disagreement report v2 validates the optional sidecar and counts
coverage before display limits. It keeps original references, experimental arms
and policy evaluation distinct. It retains the previous cohort evaluation,
comparisons, flags and sample-size semantics. Missing historical evidence is
never supplied by a current-policy join.

## Checks completed

| Check | Result |
| --- | --- |
| Focused capture/provenance/persistence/report/maintenance and generated code-health checks | 10 suites / 37,062 tests passed |
| Real PostgreSQL integration, including existing feedback and prospective readers | 6 suites / 59 tests passed |
| Server types and test/security lint | Passed |
| Standard and production Knip | Passed |
| ESM imports and mock-shape checks | Passed |
| Reviewed ownership drift | Passed; existing unresolved writer debt remains |
| Migration naming and fresh schema | Passed; isolated PostgreSQL 18 reproduction matched |
| Copyright and four policy gates | Passed |
| Full backend coverage | 1,894 suites passed; 61,193 tests passed, one preexisting skip |
| Coverage ratchet | Passed without baseline changes |

Final server coverage is 89.19% statements/lines, 86.56% branches and 90.70%
functions. All four new capture modules have 100% statement, line and function
coverage; branch coverage is 91.26% for minting/binding, 95.38% for the contract,
97.05% for the reader and 100% for the repository. Real PostgreSQL tests remain
the evidence for SQL behavior rather than mocked line coverage alone.

The ratchet used the current unchanged client report: 87.84% statements, 81.92%
branches, 87.57% functions and 89.52% lines. Client source and API contracts did
not change; no new client test run is claimed for this backend/CLI batch.

The integration checks cover exact BIGINT binding, typed mismatches, first-write
conflicts, replacement/deletion/truncation rejection, expiry tombstones,
concurrent cleanup, configuration restore/export, History cascade and private
read-only CLI behavior. They also prove logical expiry before physical cleanup,
database byte-limit rejection and agreement with PostgreSQL JSONB text size.
Fixture corrections respected existing completed-library and unique-library
constraints.

Final privacy review found that a serializable result field could duplicate new
evidence into existing retained `metadata.policyResult`. The implementation now
uses a private Symbol handle: object spreads retain its in-process authority,
while JSON serialization omits it. Permanent tests cover both ordinary metadata
serialization and actual History persistence. No version of this work was
deployed or released during investigation.

The existing deterministic parity runner also matched 500 adversarial cohorts
against the committed pre-extraction aggregate results/errors. A second pass of
500 valid/invalid optional policy-context variants preserved evaluation, cohort
counts, comparisons, existing case fields, flags and display/errors. Byte-based
whole-case omissions are covered separately by the permanent limit test.

Official W3C, PostgreSQL, OWASP and NIST sources were discovered and read through
MCP; their application and tradeoffs are recorded in the design document. The
coverage baseline is unchanged, and the ownership check does not establish
production compatibility or close historical writer debt.

Dependency manifests and locks are unchanged. The existing Unreleased
`deepmerge` development-dependency follow-up remains open; this change does not
close that advisory or alter release acceptance.

Unreleased records the new evidence boundary. Delivery uses main with no
release, deployment, live classification change, historical import or learning
action. The isolated schema container was removed after successful reproduction.

## Recommended next item

The follow-up is implemented in the separate
[declared-purpose design](declared-purpose-evidence-design.md) and
[outcome](declared-purpose-evidence-outcome.md). The recommendation below records
the boundary identified by this capture batch.

The next concrete refactor is the declared-purpose evidence projection in
`policyCandidateEvidenceCard.mjs`. Its current native branch can mark
`declared_policy` as supporting from eligibility and purpose-rule count alone.
Use verified purpose provenance to distinguish operator declaration from
profile-derived support. Preserve unknowns and assess dependent evidence-card,
calibration and routing consumers before changing behavior.

Benefit: the evidence projection would stop implying a declaration that its
inputs do not prove. Tradeoff: downstream consumers may depend on that state,
so frozen-case comparisons and focused contract tests are needed before any
ranking or routing adjustment. This batch deliberately leaves those consumers
unchanged.

Once verified new captures exist, inspect disagreement cases to distinguish
declared-purpose mismatch, inferred admission, exclusion behavior, score
calibration and later AI/routing choice. A disagreement alone remains neither an
error label nor proof that a particular rule caused the final destination.

Current media placement can be investigated later as a separately sourced weak
observation cohort. It must not backfill missing historical intent or silently
become an operator assessment or successful-route label.
