# Reviewed episode mappings outcome

Work date: 2026-10-11. Starting checkout: `8c2512ca476060959c62f9b6543e4d3a8c8ee408`
on `main`. This is development work, not a release or production deployment.
See the [design and official research](reviewed-episode-mappings-design.md).

## Implementation and operator choice

The operator explicitly chose administrator-confirmed episode mappings inside
Classifarr rather than correcting shared Plex. Implemented optional bounded TV
episode rows within existing whole-work/season proposals. Each row identifies a
source position and a typed catalog episode ID plus coordinates. No ID is inferred
from a title, filename, position or missing provider record.

Preview separates source-ID matches from human decisions and shows the returned
catalog episode title. Saving requires both the existing mapping confirmation and
a separate episode-identity confirmation. The approval audit records human
authority. Normal owned sync can materialize only a complete approved scope,
retaining capture fences, cooldowns, revocation and the normal backfill handoff.
Human episode consent cannot transfer across source-layout changes. Season-backed
documents include only represented catalog seasons; a mapped special is not
silently promoted to a whole-series scalar ID.

No migration, new scheduler, provider write or automatic real-item approval is
introduced. Existing scopes keep their contract. No Unraid, Plex or Ollama setting
is changed. No local mapping is approved merely to lower the unresolved count.

The ownership gate flagged the changed recovery service as expected. Reviewed its
sole owned-sync caller and atomic persistence path, then updated only that file's
review digest and rationale. SQL, retry admission and its analysis digest remain
unchanged; the gate passes without weakening the ownership contract. Existing
season mappings retain legacy catalog read order and evidence fingerprint shape.

## Independent random PR trial

Fresh enumeration found open #555 and #556; the recorded random draw selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. The exact local patch upgraded server
`@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0 only.

Script-disabled lock generation, reviewed normal installation and full dependency
tree checks passed. Registry metadata declared no candidate lifecycle scripts or
peer requirements. All-dependency npm audit reported zero advisories at trial time.
Fresh outdated output listed only Node types (wanted 24.19.2; latest 26.6.5).
This is not a universal safety guarantee.

Typecheck failed at the Discord Undici `FormData`/`File` boundary; tooling passed
39/40, with the Node 24 runtime-major guard rejecting Node 26 declarations.
Restored the exact original manifest/lockfile and reinstalled. Backend and frontend
typechecks passed again. No dependency change, PR merge, type cast or weakened
compatibility guard remains. Recommend an intentional runtime migration instead
of treating a declaration-major update as maintenance.

## Validation

Focused backend: 204/204 across seven suites, including the reviewed ownership
gate and legacy fingerprint ordering. Initial focused frontend: 111/111. Isolated
PostgreSQL: 34 recovery tests and 15 scope-review tests passed in separate runs.
Two earlier combined runs each had one `ECONNRESET` in different existing fixture
queries, with 48/49 passing. Their cause was not established; no timeout or retry
guard was changed to hide them.

Chromium: 3/3 passed with the final copy, including keyboard-only confirmation,
320/390-pixel reflow, pending-count preservation and saved human declarations.
Visually inspected the narrow evidence/approval panel. Fixed an initially ambiguous
test locator, not the approval controls. These use synthetic routed responses;
unrelated dashboard panels intentionally lack fixture data and report unavailable.

Full lint, server/frontend typechecks, 40/40 restored dependency-tooling checks,
all four policy-language gates, preflight copyright/ownership/Knip checks,
Markdown and ESM gates passed. The first full backend run encountered the ownership
review before its reviewed digest was updated: 56,075 passed, one failed and one
skipped. Its 39-test recheck passed. A complete clean rerun against the committed
implementation then passed all 1,791 suites: 56,076 tests passed, one existing skip,
zero failures (942.089 seconds). Frontend coverage passed all 457 files / 6,860 tests
(744.05 seconds). No tests or coverage baselines were relaxed.

| Coverage | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Backend | 89.70% | 86.10% | 91.11% | 89.70% |
| Frontend | 87.24% | 80.97% | 86.84% | 89.01% |

The cross-workspace coverage ratchet passed. Both the new episode-declaration
module and updated catalog-evidence module have 100% coverage in this clean run.

## Exact local image and schema

Application commit: `f5a6d23fd7d1ceb03345108dedd0c01511590dbc`. Built from a clean
checkout using `docker-compose.yml` plus the existing local image-tag override,
`build --no-cache --require-provenance`, Node 24.21.0 and local AVX2 detection.

- Previous local image ID:
  `sha256:44ed828072fb4c25bb99922d0659c37c327d50d30cf934326e5781de9ebd129d`.
- Rebuilt local image ID:
  `sha256:2007e15f7349b09569303ab68321fc11c941a05698387ff3d6bb7efb41714dd0`.
- The inspected OCI revision matches the application commit; this is local
  Linux/amd64 evidence, not published-image, signature or multi-platform proof.
- Before replacement, retained the exact previous image under
  `classifarr:pre-memory-1511812e-c655-4af7-8751-ec02f9f81567` and a 75,398,169-byte
  custom-format backup at
  `.tmp/pre-memory-fingerprint-1511812e-c655-4af7-8751-ec02f9f81567.dump`.
  SHA-256 copy verification and archive listing passed; no restore was performed.
- Recreated only local Classifarr using `--no-build --pull never --no-deps`.
  Started at `2026-10-11T14:30:07.176459905Z`; health reports a connected database,
  restart count zero and no OOM flag. Existing 2-GiB limit and safeguards remain.

After rebuilding, ran the existing schema-dump helper against this exact image in
a fresh network-isolated fixture (1 GiB, two CPUs, 256 PIDs). The dump includes
all migrations through `20261010_220000_source_catalog_mappings.sql` and 22 seed
migrations. `database/schema/current.sql` is unchanged. The fresh database has
zero unresolved identities and no invented pending classification/embedding work.
The disposable container and its exact temporary data directory were removed and
their absence verified. Local app-data was not used for schema generation.

## Read-only local evaluation

With database writes disabled for the probe session, checked the previously
observed Miraculous special hypothesis through the rebuilt service. At
`2026-10-11T14:31:07.798Z`, the preview reported 156 covered episodes: 155 declared-ID
matches and one explicitly human-proposed identity, with a typed target title.
This is **not proof that the proposed source/target episodes are identical** and
is not an approval. The combined automatic-agreement report is absent;
`canApply`, `persisted` and backfill eligibility remain false.
Reference: `b7093361-caa9-444e-afc4-55322996ca8c`.

Before and after: seven approved/materialized mappings, zero human episode
approvals and four unresolved items across ten active, covered libraries.
Provider writes and mapping approvals: zero. A separate read-only consumer probe
also preserved four unresolved items, counted 6,832 classifications once, reported
6,810 pending image embeddings consistently and fetched a ten-item batch in 5 ms.
No startup WARN/ERROR records were present in that early observation window.

Container memory snapshots were about 895 MiB before replacement and 912 MiB after
startup under the same 2-GiB limit. These are different-uptime observations, not a
memory soak or proof of a memory improvement. No production recovery, real-item
approval, Plex write, Unraid replacement or shared Ollama change was performed.
The subsequent handoff commit changes documentation only; remote CI must be
checked against its own final SHA, not inferred from the starting commit's green runs.

## Recommendation stack

1. Use typed target review and explicit human decisions for genuinely missing or
   conflicting episode IDs. Benefit: preserves grouping/provider state. Cost:
   administrators must verify identity; no automatic truth claim.
2. Let existing owned sync apply complete approved scopes and normal backfill.
   Benefit: durable, revocable and idempotent. Cost: approval is not immediate
   completion, and changed source layouts require renewed review.
3. Review the four real remaining conflicts separately. An absent catalog episode
   still needs catalog repair or a verified existing target; no arbitrary substitute.
4. Keep Node 24 declarations until a separately tested runtime migration.

Final recommendation: reviewed episode exceptions, not title-based self-healing or
release-time blanket approvals. Operator-specific mappings must not be copied to
other deployed installations.
