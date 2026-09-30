# Embedded identity provisioning and maintenance handoff

Date: 2026-09-30. Implementation base: `825ca102`.
This continues [one-shot restore maintenance](restore-maintenance-design.md).

## Decision and scope

We keep the single-container deployment and make its executable assets and account
setup safe to use in the selected supervisor design. Normal startup now validates
and verifies identity provisioning before changing data ownership. Shipped code,
dependencies, migrations, entrypoint and extension binaries are root-owned; the
application cannot replace them even on a writable image filesystem.

The supervisor gains a bounded, single maintenance phase before application launch.
Its fixed schema/restore child launcher is exercised with genuine separate OS and
SQL identities in the disposable drill. **Ordinary production startup does not yet
activate that maintenance phase or change its database identity.** Legacy cluster
migration and the remaining privileged jobs must be handled before that cutover.
This is not an automatic remedy for `legacy_owner_unknown`.

## Evidence and diagnosis

I inspected the Dockerfile, entrypoint, supervisor, schema/restore commands and
separate-identity drill. The image gave the application ownership of code and
PostgreSQL extension binaries. The entrypoint could also continue after failed
account updates. We cannot safely place a privileged executor above code that a
less-privileged runtime can replace, or trust a requested UID without verifying it.

Online sources discovered and checked on September 30, 2026:

- PostgreSQL recommends a dedicated OS account separate from other daemons and
  executable ownership. We apply executable protection now; separate production
  daemon identities remain a subsequent migration.
  [PostgreSQL account guidance](https://www.postgresql.org/docs/18/postgres-user.html).
- Peer authentication obtains local OS identity from the kernel. A SQL-role rename
  under shared trust authentication does not provide that boundary.
  [PostgreSQL peer authentication](https://www.postgresql.org/docs/18/auth-peer.html).
- Unraid stores container settings in user templates. An image update cannot be
  assumed to rewrite an existing launch configuration.
  [Unraid Community Applications](https://docs.unraid.net/unraid-os/manual/applications/).
- Docker user selection, capabilities and no-new-privileges are distinct controls.
  We do not add privileged mode or a Docker socket to bypass saved restrictions.
  [Docker runtime controls](https://docs.docker.com/engine/containers/run/),
  [Docker security options](https://docs.docker.com/reference/cli/docker/container/run).
- Node provides direct child-process execution and process lifecycle events.
  The launcher uses fixed arguments without a shell and waits for exit plus closed
  output pipes. An explicit numeric group in su-exec resets supplementary groups.
  [Node child processes](https://nodejs.org/api/child_process.html),
  [su-exec implementation](https://github.com/ncopa/su-exec/blob/master/su-exec.c).
- W3C requires textual error identification and accessible status messages.
  This change adds no browser UI; its status/rejection text is explicit and does
  not rely on color. Future UI integration must expose equivalent accessible state.
  [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification),
  [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

## Components and invariants

| Component | Responsibility | Boundary |
| --- | --- | --- |
| `embeddedIdentityPolicy.mjs` | Validate IDs/mask, plan account updates | Pure; no filesystem mutation |
| `embeddedIdentityProvisioning.mjs` | Execute fixed account tools and read back UID/GID | No database or application startup |
| `provisionEmbeddedIdentity.mjs` | Entry-point composition and sanitized rejection | Failure precedes data-directory ownership changes |
| `embeddedMaintenanceChild.mjs` | Start only schema or restore maintenance | Constructed environment, numeric identity, bounded/discarded output |
| `embeddedSupervisor.mjs` | Maintenance completion, runtime launch and drain ordering | Failure or cancellation never starts normal workers |

Root startup permits canonical positive IDs through 2,147,483,647, rejects root,
database-account and other-user UID collisions, and reuses existing target groups.
Unraid's `99:100` and custom `2345:2345` remain supported. The packaged accounts
must exist; setup does not invent an account when the image is inconsistent.
Account commands have five-second deadlines and are followed by readback. Partial
group changes can be retried; neither a failed command nor failed readback authorizes
the subsequent data chown. No shared account or group is deleted.

Explicit non-root launches retain their actual host-selected UID/GID, even when
PUID/PGID request something different. They cannot remap identities. Malformed or
root IDs and malformed masks are rejected rather than silently normalized. Existing
valid templates need no edit, new setting or extra container for these changes.

The maintenance launcher is an internal trusted composition API, not an
authorization API. The caller supplies an identity resolved from trusted account
state and owns the database lifecycle. It accepts no executable, arbitrary argv,
environment override or file path. It uses a fixed Unix socket, administrator role
and migration directory, with no inherited password, PGOPTIONS, PGPASSFILE or Node
preload configuration. Schema uses no input; restore uses at most 64 MiB through
stdin and retains the previous encrypted-envelope validation.

The supervisor waits up to 200 seconds for maintenance, cancelling that deadline
when a host stop arrives. It then attempts two-second TERM and KILL joins as needed.
Unconfirmed maintenance exit forbids both application launch and a claimed orderly
database stop. Maintenance output is discarded, with a combined 64 KiB limit;
overflow/pipe errors fail the job even if its exit code is zero. The child has a
512 MiB V8 old-space cap, not a total-RSS cap. There is no retry loop or new daemon.
The host's stop deadline remains authoritative and can still force crash recovery.

## Options, pros and cons

| Option | Pros | Cons / disposition |
| --- | --- | --- |
| 1. Keep the shared identity and strengthen packaging only | Immediate compatibility; small startup cost | Does not separate DB authority; useful protection, insufficient final architecture |
| 2. Staged embedded separation with verified provisioning and fixed maintenance handoff | Preserves single-container model; bounds administrative execution; selected | Requires legacy cluster migration, protected HBA and complete privileged-job routing |
| 3. Separate PostgreSQL and maintenance services | Stronger filesystem/process separation and standard DB operations | Extra services and deployment/data migration; not transparent to existing Community Apps installs |

I recommend Option 2 under the current compatibility requirement. This increment
also delivers the executable protection from Option 1. We should choose Option 3
where operators already manage an external database or prefer that operational
boundary over preserving one container. Merely changing the SQL login is not a
fourth isolation option: shared files and trust authentication would bypass it.

Root-owned files add no runtime daemon or per-request work. Provisioning adds one
bounded startup process; maintenance adds one sequential child only when requested
by trusted composition. It also makes startup unavailable if identity setup fails,
which is intentional. Synthetic drill timing is not representative load sizing.
The existing supervisor and database remain part of the trusted computing base.

## Rollout, rollback and remaining risks

Image packaging and identity validation apply to ordinary startup now. Existing
data locations, credentials, HBA, schema mode and UI restore behavior are unchanged.
No release or live restart is part of this commit. An image rollback needs no schema
rollback but loses the new executable protection. Do not clear restore quarantine
or unknown ownership to force either image to start.

The optional handoff is currently composed only in the isolated drill. Moving it
into ordinary production requires a reviewed root supervisor, separate DB OS
ownership, protected HBA/configuration, role grants and all administrative jobs.
Application-writable runtime pgvector staging also needs separation at that point;
root-owned packaged binaries alone do not protect a shared-UID database process.
Existing non-root, read-only, no-new-privileges installations cannot acquire new
identities from an image update. Compatibility behavior must remain explicit.

## Validation and recommendation stack

The [outcome document](embedded-provisioning-handoff-outcome.md) records actual
tests. The acceptance matrix covers invalid IDs, account collisions, failed
mutation/readback, partial account changes, maintenance failure/cancellation/exit
uncertainty, fixed child arguments, bounded output and actual schema/encrypted
restore before a restricted runtime. Docker checks also cover non-root `1000`,
custom `2345`, Unraid `99:100`, writable-image denial and preserved-data restarts.
These restarts are not a published-release or PostgreSQL major-upgrade rehearsal.

Next, implement **a resumable legacy-cluster identity migration**: inventory every
privileged job, migrate a stopped copy with protected HBA/configuration and separate
ownership, inject failure between each durable phase, and prove old credentials
cannot reconnect. Establish an explicit supported path for constrained non-root
deployments before enabling that migration by default. Then complete enforced
inventory writer capabilities before enabling automatic legacy ownership recovery.
