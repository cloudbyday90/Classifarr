# Combined source evidence outcome

Observed on 2026-10-11, America/New_York. This is development verification, not a
release or an Unraid deployment. See the [design](source-combined-evidence-design.md)
and preceding [parent-ID audit](source-identity-agreement-audit-outcome.md).

Follow-up: the [episode gap investigation](source-episode-gap-outcome.md) traces
the two single-candidate exclusions and adds scoped source/catalog guidance.

## Result

Mapping evidence previews now combine parent-ID agreement, complete source
membership and agreement with the proposed catalog work. Parent lookups and
scope reads are repeated within the same bounded, admitted operation. Changed
source/configuration/actor or catalog evidence invalidates the result. The
report has its own fingerprint; explicit approval retains the existing fresh
membership fingerprint and transaction checks.

No automatic repair authority, mapping approval, provider mutation, scheduler,
cache, migration, release or runtime/dependency upgrade was added. Ownership,
memory safeguards, deadlines and source grouping are unchanged. New modules are
ESM. The API change is additive, with a client parser and accessible UI that reject
malformed included reports while allowing older servers to omit the report.

## Local evidence: why four items still require review

At **08:08:43 EDT**, the rebuilt image was queried with PostgreSQL's
`default_transaction_read_only=on`, a 10-second statement timeout and a one-second
lock timeout. The probe serially checked at most four retained conflicts. Only
single available candidates received a diagnostic whole-work scope; multiple
candidates were not arbitrarily reduced to one. No proposal was saved.

| Source conflict | Parent evidence | Membership evidence | Outcome |
| --- | --- | --- | --- |
| First TVDB conflict | Missing match and other-scope result | 155 / 156 episodes; one lacks a TMDb episode ID | Review required |
| First TMDb conflict | Two candidate works | No single-work proposal inferred | Explicit scope still needed |
| Second TVDB conflict | Missing catalog match | 135 / 136 episodes; one episode ID absent from proposed scope | Review required |
| Second TMDb conflict | Three candidate works | No single-work proposal inferred | Explicit scope still needed |

References: `c02a45ee-68ce-48a7-8333-6c0e321d2917` and
`565b301c-e6ce-484d-84ed-fccf9f503196`. These identify transient reports, not
persisted approval receipts. No private item IDs, provider payloads or credentials
are included here. Local results are not evidence about current Unraid data.

Before and after: **four unresolved items**, **zero probe mapping approvals**,
**zero probe provider writes**. At 08:09:39 EDT, a separate database-only check
confirmed all **seven previously approved mappings materialized**, all seven
historical application dates retained, and no pending recheck marker. All ten
active libraries remained covered. Five status reads took 172.21 ms initially,
then 7.24, 7.85, 6.18 and 14.05 ms; this is a small observation, not a benchmark.
At 08:11:57 EDT, the database-only consumer check also passed (distinct bounded
embedding batch, consistent pending counts) and found no WARN/ERROR rows since
this container's startup. This short window does not prove unrelated background
comparison or memory-pressure issues resolved.

The practical distinction remains: Plex having a title, artwork or synopsis does
not establish complete episode IDs or settle competing catalog identities.
Prior approval recorded a deliberate mapping decision; it was not a claim that
the administrator owns the ingestion process. This change explains the evidence
more clearly without copying those local decisions into an upgrade backfill.

## Validation

- Focused backend: 120 tests across six suites passed.
- Additional scope/provider/mapping contracts: 77 tests across five suites passed,
  including real compressed HTTP, oversized bodies, cancellation and redirect refusal.
- Isolated PostgreSQL: 45 tests across two suites passed, including configuration
  drift, retained observation preservation, advisory admission and lease loss.
- Focused client after restoring dependencies: 74 tests across three files passed.
- Full frontend coverage: 455 files / 6,793 tests passed in 356.62 seconds.
  Statements 87.20%, branches 80.89%, functions 86.80%, lines 88.98%.
- Full backend coverage: 1,789 suites passed; 55,999 tests passed and one existing
  test skipped (56,000 total), in 1,253.804 seconds. Statements/lines 89.70%,
  branches 86.08%, functions 91.09%.
- Combined coverage ratchet passed using both current reports; no baseline update.
- Backend and both client typechecks; full lint; copyright; ownership audit;
  regular and production dependency analysis; 40 tooling checks; four policy
  gates; static ESM imports and mock-shape checks passed. No baseline was relaxed.
- Browser: final Chromium mapping/recovery scenario passed in 17.3 seconds,
  including keyboard activation, narrow reflow, visible blocked-parent reasons,
  no automatic approval and unchanged unresolved count. The 320-pixel screenshot
  was visually inspected. One intermediate run hit the existing 30-second test
  deadline amid repeated page navigation; the unchanged rerun passed. No deadline
  or assertion was weakened. Fixture-only unavailable dashboard responses remain
  visible in its log and are not a production outage finding.

## Random open PR #555

Fresh enumeration returned #555 and #556; random selection chose
[the client Node-types PR](https://github.com/cloudbyday90/Classifarr/pull/555).
Its reviewed immutable head was `4cbffcb7dd726af152382a1f92edb9dc326fe349`.

Locally implemented the exact 26.6.4 declaration / 8.9.0 undici-types candidate
(not newer registry latest 26.6.5), generated and reviewed the two-package lock
change with scripts disabled, then installed using the existing strict policy.
The final trial manifest range matched the PR's `^26.6.4`.

- `npm ci`, complete dependency-tree validation, client typechecks and build passed.
- Client npm audit, including development dependencies: zero reported advisories
  at the time of the trial. This is not a general security guarantee.
- The runtime-alignment gate failed: 39 / 40 tooling checks passed; the client
  declaration major was 26 while the deployed runtime policy requires 24.
- Restored the exact original manifest/lockfile and reinstalled 24.19.2 with
  undici-types 7.24.6. All 40 tooling checks then passed. No dependency diff remains.

The [DefinitelyTyped guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
describes declarations as targeting the corresponding library version. The
benefit of newer typings does not justify describing unsupported runtime APIs.
Recommendation: leave this PR unmerged until a separate Node-runtime migration
is justified and tested. The trial did not merge or modify the PR.

The fresh outdated inventory also identified Playwright 1.64.0, Vue plugin 6.0.10,
Vue Router 5.4.0 and vue-tsc 3.3.13 as newer wanted versions, and TypeScript 7.0.2
as a newer major than the client's pinned 6.0.3. These were not bundled into this
identity change and need their own compatibility review.

## Exact local image and schema

Clean code commit: `0416b9512ddb2a8aed311e6daf6a23e1e2d2278b`.
The subsequent handoff commit changes verification documentation only; the local
runtime image remains explicitly tied to this code commit.

- Previous local image retained for rollback:
  `sha256:031facafb3197da11c8168210436a47d58ec2e5e49613fb8d4beed3adff77c59`.
- New no-cache local image identity:
  `sha256:044a85c9123ba948e1408d95e9523ee536b77d29bd7449aef023b44e69132e31`.
- OCI revision matched the clean code commit. These are local Docker identities,
  not a published multi-platform image or a signed release-provenance claim.
- Pre-replacement local database archive: 65,860,818 bytes; checksum and
  `pg_restore --list` verified. The archive and rollback tag remain locally.
- Existing Compose plus the local image override was rebuilt with `--no-cache`
  and provenance required, then replaced with `--no-build --pull never --no-deps`.
  Container healthy, restart count zero; normal entrypoint and safeguards retained.
- After rebuilding, `dumpSchema` ran against the exact new image in a disposable,
  network-isolated container (1 GiB, two CPUs, 256 PIDs), not real appdata.
  Snapshot unchanged; migrations through
  `20261010_220000_source_catalog_mappings.sql`, with all 22 seed migrations.
- Fresh database check found zero invented unresolved IDs, classification work or
  embedding work. The owned schema container and temporary data directory were
  removed and their absence verified. No user database or backup was removed.

## Recommendation stack

1. **Inspect the two precise episode gaps next.** Trace the missing episode ID
   and the out-of-scope ID through current source metadata and typed catalog
   membership. Benefit: addresses observed blockers; cost: additional bounded
   provider reads. Do not treat either as permission to rematch Plex automatically.
2. **Resolve parent equivalence separately.** Seek authoritative typed alias
   evidence for the missing/other-scope lookups and explicit scopes for multi-work
   groupings. Benefit: avoids false repairs; cost: some cases still need review.
3. **Only then specify automatic recovery/backfill.** Require proven identity,
   complete scope, current revisions, durable provenance, idempotency and upgrade
   tests. Benefit: safe unattended repair; cost: more state and failure handling.
4. **Return to the bounded tooling update queue**, preserving the Node 24 type
   boundary until an intentional runtime migration.

Final recommendation: retain this diagnostic implementation, not the Node 26
typing trial. Do not lower completeness, ownership or memory requirements to make
the remaining count disappear. No release, production deployment or production
repair was performed.
