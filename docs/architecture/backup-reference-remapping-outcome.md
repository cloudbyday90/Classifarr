# Restore reference safety outcome

Date: 2026-09-26. No release, deployment or live restore.

## Result

Restore now maps local Radarr/Sonarr, policy and label references to their restored
parent rows instead of copying source database IDs. The exporter includes the
previously omitted `libraryArrMappings` section; configuration capture now has
32 sections. Direct library routing fields and current Arr connection settings
are preserved. Root-folder and quality-profile IDs remain provider-owned values.

Two small ESM services separate reference preflight from destination persistence.
The existing backup service still owns encryption, transactions and reconciliation
lifecycle verification. There is no new dependency, migration or REST endpoint.

Missing local parents, duplicate source IDs and cross-library policy links are
rejected before configuration writes. Errors name the section, row and field and
explain how to recover without including record contents or credentials.

Merge replaces only restored libraries' fallback rows and restored intents'
routing targets, avoiding stale or duplicated destinations on replay. Replace
clears obsolete routing links on libraries retained for completed history. These
changes do not delete completed history. This is not whole-restore idempotence:
merge still allocates new Arr connection rows, as before.

## Demonstrated behavior

Six new real-PostgreSQL cases use production export/table-restore functions in
disposable integration databases:

- Movie and TV configurations restore in merge and replace modes when the old
  server, library, Arr and label IDs still belong to unrelated destination rows.
- Exact label uniqueness-key matches map to the existing destination preset.
- Native targets, direct routing and fallback routing agree after changed IDs
  and a repeated merge; provider folder/profile IDs remain unchanged.
- Learned preferences point to the restored policy, and labels to the restored
  preset. Provider `source_library_ids` remain unchanged.
- Older files lacking routing sections clear stale destinations on restored
  libraries/intents rather than inheriting unrelated routes.
- Missing parents reject replace before deletion. A separate late constraint
  failure rolls back routing/configuration changes at the transaction savepoint.
- Completed classification history survives replacement, while its retained
  library loses links to removed Arr connections when absent from the backup.

The bullets describe assertions across six cases, not seven independent tests.
No test invokes Radarr, Sonarr, Plex, AI inference or media routing. Existing API
and lifecycle tests continue to exercise backup files and failure gates.

## Validation

- Full backend unit coverage: **43,573 tests across 1,464 suites passed**.
- Full frontend coverage: **5,410 tests across 386 files passed**.
- Targeted PostgreSQL backup integration: **65 tests across four suites passed**,
  including the six new recovery cases. The full integration collection was not
  run.
- Focused backup unit tests: **109 passed**. The two new services have **100%
  statement, line and function coverage**, with **99.08% combined branch
  coverage**. These tests overlap the full backend run; counts are not additive.
- Backend/frontend type checks, frontend production build, backend lint, normal
  and production dependency checks, ESM import/mock checks, copyright, Markdown
  and diff checks passed. Lint retains one pre-existing nonliteral-path warning
  in `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.
- Coverage ratchet passed with fresh full backend/frontend reports. No baseline
  or threshold was lowered.

Reproduce from `server/`:

```powershell
node scripts/run-jest.mjs --testPathPatterns='backup|codeHealth' --runInBand --no-coverage
node scripts/run-jest.mjs -c jest.integration.config.mjs --testPathPatterns=backup --runInBand --no-coverage
```

## Operator guidance

If preflight rejects a field such as `libraries[0].arr_id`, use a complete export
from the source installation. Do not substitute a numeric ID from the destination
database. Diagnose older or edited files in an isolated instance. Keep the
original backup and previous application image available; this patch does not
certify a live restore while other application writers remain active.

## Research, PR and scope

The [design](backup-reference-remapping-design.md) records official PostgreSQL
and W3C sources reviewed in September 2026, alternatives, pros/cons and decisions.
Use **coherent snapshot → reference preflight → typed ID maps → atomic writes →
lifecycle verification → isolated recovery proof**. Fail-fast completeness costs
some compatibility with incomplete/edited files, but avoids silent wrong-target
recovery. W3C guidance informs actionable error text; no UI conformance claim is
made.

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr` on both checks.
There was no random open PR to implement; none was substituted or merged.
No release, tag, version bump, live restore or application-container rebuild was
performed. Production data, background jobs and routing settings were untouched.

## Next concrete item

Implement a **restore maintenance barrier** before any live recovery drill:
inventory every background writer and external dispatch path, stop new work,
drain or safely fence in-flight work, perform restore, verify references and
authority, then resume only after a successful verification. Exercise crashes,
concurrent restores and stale workers. The existing native-reconciliation gate
alone is not proof that all writers/dispatchers are paused.

Then rehearse encrypted full-database recovery in an isolated environment,
including evaluation evidence and external artifacts that configuration JSON
does not cover. Audit provider machine IDs and the mixed runtime terminology of
`source_library_ids` separately; do not guess either identifier's namespace.
Keep routine maintenance conservative: no automatic `VACUUM FULL`, broad log
deletion or cleanup of supposedly duplicate Arr connections is introduced here.
