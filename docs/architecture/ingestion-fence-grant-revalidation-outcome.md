# Ingestion fence: grant revalidation outcome

Date: 2026-10-04. Branch: `main`. No release or production cutover.
See the [design and official research](ingestion-fence-grant-revalidation-design.md).

## Result

The disposable authenticated-role gateway now refuses observed authority drift
before admission, an item write or completion. Its private SQL assertion checks
the real authenticated login, registered role attributes/membership, effective
table/column/routine/schema privileges, private-state access and legacy sessions.
It clears cached activity before inspecting sessions and requires READ COMMITTED.
It does not silently repair grants, terminate writers or claim legacy ownership.

The implementation remains in `server/src/scripts/ingestionWriterFence`, behind
the existing test-environment and disposable-suite-database admission checks.
There is no new migration, runtime hook, service, timer, UI or deployment option.
No W3C-facing behavior changed. The ESM installer loads one additional fixed SQL
module inside its existing atomic installation/revocation transaction.

## Verification

- Red regression: restoring writer UPDATE access allowed the old candidate to
  retire a legacy marker. The new authority check rejects this before mutation.
- Second red regression: activity cached earlier in a READ COMMITTED transaction
  hid a reopened legacy session. Clearing that snapshot makes the write refuse.
- Real PostgreSQL 18 integration: **154 tests, 5 suites passed, no skips**. This
  includes 38 new authority cases, 25 existing writer-fence cases and existing
  legacy reconciliation, library recovery and recovery-progress suites.
- Focused unit tests: **180 tests, 11 suites passed, no skips**. Ordinary runtime
  environments still refuse the prototype before opening a database connection.
- Scoped ESLint, backend typecheck, Knip dependency analysis, Markdown lint,
  copyright, static ESM-import, migration and schema-integrity checks passed.
- Ownership review explicitly covers the new fixed assertion and changed
  installer/lifecycle files. The gate passes with **501 unresolved entries**
  unchanged; `productionCompatible` remains false. Passing means no unreviewed
  drift, not that production writers are all fenced.

Tests used independent authenticated clients in disposable suite databases,
synthetic libraries and generated roles. Fixture teardown closes clients, drains
only its generated identities and removes those roles. The first test draft also
exposed duplicate synthetic URLs and teardown ordering; both fixture defects were
corrected before the complete green runs. Local checks used Node 24.21.0.

## Image and local evaluation

The requested no-cache build, local container replacement and isolated schema
round-trip will be recorded here after completion against the committed source.
This section is not yet image-validation evidence.

## PR and remaining work

Saved GitHub CLI authentication returned **zero open pull requests** on
2026-10-04. No PR was selected, merged or represented as open.

This work does **not** resolve today's `legacy_owner_unknown` warnings. Local
Docker and Unraid have separate databases; sharing Plex does not make one
installation the owner of the other's import. A rebuild cannot establish which
historical writer created an unowned local running marker.

Next: complete the protected production identity/maintenance handoff and remaining
writer adapters, then rehearse an actual old-image upgrade and restore. The
application must lose bypass access before automatic legacy retirement is safe.
Retain reviewed recovery in the meantime; do not fabricate ownership or use age
as evidence. Recovery completion remains full import plus metadata, not optional AI.

The guard is a fail-closed drift check, not containment of a trusted administrator
who can change grants or replace functions concurrently. It covers the candidate's
fixed boundary, not arbitrary extensions or unported production writers. Its
benefit is refusing an invalid boundary; the cost is per-call catalog inspection
and manual review of unexpected grant changes. Production throughput remains to
be measured when the complete gateway is integrated.
