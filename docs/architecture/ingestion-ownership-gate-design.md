# Ingestion ownership review gate

## Decision and scope

Extend the existing inventory-writer compatibility scanner into an offline CI
drift gate. Do not add a runtime service, timer, provider request or database
connection. Fresh installations remain unaffected: the gate runs during development
and CI, not while users configure or ingest libraries.

Protect `media_server_items`, `media_server_sync_status`,
`media_source_capture_state` and `library_ingestion_state`. Reuse the existing
ESLint AST collection, SQL operation tokenizer and authoritative-schema cascade
discovery. Include direct writers, dynamic targets, indirect query gaps, cascade
parents, all SQL files and explicit ownership-dependency pins. SQL files are
included even without a discovered DML statement because DDL and trigger functions
can change the boundary.

## Research and alternatives

Official sources discovered and checked on 2026-09-27:

- [PostgreSQL 18 advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html):
  applications must cooperate with advisory locking. Locks do not prevent another
  connection from issuing ordinary SQL. Therefore this gate cannot certify old
  binaries, external scripts or shared helpers as fenced.
- [PostgreSQL 18 TRUNCATE](https://www.postgresql.org/docs/18/sql-truncate.html):
  `CASCADE` follows foreign-key references independently of `ON DELETE` actions.
  Discovery therefore includes all foreign-key ancestors for truncate candidates,
  conservatively including statements whose default `RESTRICT` would block them.
- [ESLint custom rules](https://eslint.org/docs/latest/extend/custom-rules): AST
  visitors inspect source structure. Reusing the installed parser avoids executing
  application imports and avoids a second discovery implementation.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use):
  keep validation least-privileged and avoid interpolating untrusted PR text into
  shell commands. The new step is a fixed npm command in the existing
  `contents: read` job; no token, extra action or secret is added.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/): distinguish a
  measurement and its provenance from a broad quality claim. We apply that
  principle to the report's scope, fingerprints and explicit gaps. This is a
  Working Group Note, not a claimed accessibility or runtime-safety certification.

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Reviewed static drift gate | Detects changes before deployment; no production load | Conservative review friction; incomplete data flow | Implement now |
| Database roles and enforced fencing | Can reject noncooperating writes at storage boundary | Migration, restore, trigger and old-binary compatibility work | Separate follow-up design |
| Another recovery scheduler | Can retry transient failures | Cannot establish write ownership | Do not add |

Recommendation stack: static drift review, targeted lost-owner database tests,
then a narrowly designed storage-enforced write boundary. Preserve current
ingestion readiness, backoff, full replay and administrator reconciliation.

## Review contract

`ownershipReview.json` records an initial source revision, parser version, review
rationales and exact per-file SHA-256 fingerprints. Each entry also pins its
discovered operations, gap kinds and dependency role. Normalize CRLF to LF before
hashing so Windows and Linux checkouts agree. Hash the entire file, not only SQL:
removing a guard with unchanged SQL still invalidates review.

Classifications describe a reviewed context, not all possible invocations:

- `owned`: the current ingestion entry path and explicitly pinned ownership
  mechanism, covered by interrupted-import and late-callback regressions.
- `separately_coordinated`: administrator reconciliation, with its disabled-library,
  exact-preview, stopped-worker attestation and atomic-audit requirements.
- `unresolved`: existing shared writers, dynamic/indirect SQL, maintenance sources
  and SQL history whose compatibility is not proven. These are frozen technical
  debt, not new permissions, safe writers or a list of confirmed defects.

New, changed or removed watched files fail review. New parse errors, missing files,
symlink/nonlocal sources and read budgets fail closed even if a manifest entry
exists. A parser upgrade or changed discovery result also requires review.
Reports retain `productionCompatible: false`, show unresolved counts and bounded
examples, and never print SQL literals or application credentials.

## Maintainer procedure

1. Run `npm run inventory:ownership:check` after server dependencies are installed.
2. For a failure, run `npm run inventory:ownership:report` and inspect the named
   source, its callers and its coordination mechanism. The report provides current
   source and analysis digests; it does not edit the manifest.
3. Add or amend the explicit review rationale and only the reviewed entries.
   Preserve unresolved status unless there is evidence for the claimed context.
   Do not regenerate the whole baseline to clear a failed check.
4. Test the changed path. For writes, include loss of ownership, late callbacks,
   finalization/pruning rollback, and fresh/incomplete-ingestion behavior as relevant.
5. Run the gate again and submit source, tests and review changes together.

There is deliberately no auto-accept/update flag. CI and local `test:ci:preflight`
invoke the same check. Removing a file also requires removal of its stale review
entry after review; a tracked missing worktree file remains a read failure until
the deletion is staged. Repository review/branch protection must protect the gate
and manifest themselves; this change does not configure remote branch protection.

## Limits and next component

This is a drift tripwire, not an authorization engine, call graph or SQL parser
proof. It does not prove arbitrary string data flow, alias-based query execution,
runtime reachability, other languages, imports outside the scanner's roots,
deployed schema/privileges, or historical/external processes. Tests and fixtures
remain excluded from production-source discovery. Unsupported discovered source
languages remain explicit gaps. False positives are intentionally retained until
reviewed, rather than guessed away.

The highest-value runtime follow-up is to separate shared capture/pruning helpers
from the owned import gateway and audit their maintenance callers. Require an
explicit owned capability for destructive finalization; keep maintenance entry
points separately coordinated and tested. Do not merely remove pool fallback
globally: older capture scripts and enrichment workflows have distinct contracts.
Then evaluate database-role separation/fencing against restore and upgrade drills.
