# Gateway catalog retention — design

Date: 2026-10-17. The user approved separating catalog snapshots from inference
archives, preserving audit history without recursively retaining older catalog
snapshot files. This increment implements the retention boundary first; automatic
catalog admission/scheduling remains a subsequent integration gate.

## Contract

Catalog recovery sets have a separate optional PostgreSQL registry. New registry
identities use native UUIDv7. A retained set binds an exact v5 manifest and its
isolated restore result to a bounded inventory of inference archive files. It is
not an inference archive, cannot be a dependency of another set, cannot authorize
live cleanup, and cannot turn a restored database into an active worker.

Registration requires the existing maintenance lock, rechecks the actual root
bundle and every dependency, and matches the rederived inventory to the captured
manifest. Changed membership refuses registration rather than guessing. The
registry is separate from the immutable captured maintenance tables; registry
history remains local audit metadata, not a claim that its later publication was
inside the older snapshot. v5 capture remains verification-only: this work does
not change its admission contract or convert its unfinished archive job into an
inference success. Independent catalog admission and combined retry accounting
must be integrated before automatic scheduling.

Retained and retiring sets pin all referenced inference bundles. Rotation checks
the registry before both retirement admission and resumed file deletion. SQL
guards independently reject mutation/deletion of referenced inference records.
All participants use the same non-waiting maintenance lock. Missing permissions,
incomplete installation, unknown state or mismatched evidence refuse work.

Catalog retirement requires two other retained, independently rechecked sets for
the same ledger/provider/policy, newer than the retiring set. Persist retiring,
delete only its checked fixed files, then persist retired. Dependencies remain
pinned through interrupted deletion. Historical registry rows and dependency
rows are retained; only retired roots cease pinning. No protection expiry, live
history deletion, receipt rewriting or attempt/cooldown reset is added.

The first implementation exposes internal services only, not HTTP endpoints,
administrator buttons, a cron entry or deployment configuration. No schema is
installed by ordinary application migrations. Optional installation uses the
timestamped SQL alongside its matching fresh schema, with maintenance stopped.

## Bounds and weak points

- At most 10,000 registry rows, 40,000 file references per snapshot and 120,000
  historical file references overall. Reaching a cap stops registration, not
  audit retention. These SQL bounds are distinct from the managed-file budget. Fixed
  identifiers, UUIDv7 archive names, 64 KiB manifests, bounded file reads and
  SHA-256 bind bytes, not arbitrary archived paths. Registration is atomic.
- The existing 1 GiB archive budget is not expanded. Root retirement itself
  creates no new archive. The internal capture seam can count both separate
  stores together. The legacy coordinator cannot account for that extra store,
  so registered roots make it report `catalog_retention_integration_required`
  without admitting or rotating work. A registry is not storage admission.
- A verified receipt is evidence from the isolated verifier, not authority from
  an untrusted network client. Runtime roles receive no public mutation rights.
  A compromised owner/host can bypass this boundary; hashes are not signatures.
- Registration after verification may encounter changed source membership. That
  is a safe refusal, not a reason to weaken the snapshot's dependency contract.
- Shared dependencies stay pinned until their last retained/retiring root is
  retired. Removing one root must not remove any of its inference dependencies.
- Interruption after any unlink leaves retiring state and pins intact. Retry
  rechecks remaining bytes and both surviving sets before completing deletion.
- Keeping two roots does not guarantee unlimited progress: independently protected
  inference archives may still fill storage. Refuse maintenance when it cannot
  fit; do not expire protection or interfere with shared Ollama.

## Research and recommendation

Official sources were discovered/opened through MCP on 2026-10-17. Our application
of their principles is an engineering recommendation, not their endorsement of
this implementation.

[Restic retention](https://restic.readthedocs.io/en/stable/060_forget.html) separates
snapshot selection from pruning data no retained snapshot references.
[pgBackRest retention](https://pgbackrest.org/user-guide.html) completes replacement
backups before expiring older copies. Use these principles without adding either
backup suite as a dependency.
[PostgreSQL advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html)
require every participant to honor the locking protocol. Application prechecks
alone are insufficient: enforce the lock and pinned-record invariants in SQL too.

Recommended stack: small ESM services, PostgreSQL 18/native UUIDv7, a separate
bounded retention registry, existing maintenance locking, isolated native restore
and deterministic interruption tests. The cost is extra metadata and conservative
refusals; the benefit is repeatable protection without an ever-growing chain of
catalog backups. Pinning all catalog ancestry would be simpler but eventually
stop refreshes. Deleting files based only on age or copy count is rejected.

## Verification and completion

Test shared dependencies, duplicate registration, identity/digest drift, missing
files, insufficient replacements, cancellation, concurrent maintenance, SQL
bypass attempts, partial retirement and retry. Use real isolated PostgreSQL for
guards, UUID versions and atomicity; existing native image fixtures for actual
files/restores. Preserve all existing protected-pair and retry tests. Record exact
checks and limitations in the separate outcome document.

After the rotation boundary is proven, integrate independent catalog admission,
shared storage accounting and durable scheduling without minting fresh retry
budgets or triggering a backup loop. No release or production activation here.
