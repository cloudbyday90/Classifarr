# Protected application data layout

Date: 2026-10-04. Continues [selected database startup](selected-database-adapter-design.md).

## Decision and scope

Provide the application-writable directories needed below a protected appdata
parent. Reuse this provisioner in the selected-database image rehearsal before
restricted runtime admission. Do not turn the current legacy appdata parent into
a root-owned directory at ordinary startup: the old database, restore worker,
major-version upgrade and custom paths still use the shared identity.

The inspected default consumers are runtime settings (`config`), API encryption
keys (`secrets`), logging (`logs`) and backups (`backups`). Only those four direct
children of `/app/data` are admitted. All existing content is preserved. Media
mounts, custom environment paths, database data/configuration, migration receipts,
version markers and PostgreSQL logs are outside this provisioner's authority.

## Contract

- Caller holds the migration lease and has drained application/maintenance work.
  Linux root and already root-protected appdata ancestors are prerequisites.
  This module does not establish quiescence or change the parent's ownership.
- Read actual named OS accounts; require distinct non-root application/database
  IDs. No request path, arbitrary command, environment-selected directory or
  network operation is accepted.
- Inspect all four directories before the first write. Open directory handles
  with `O_DIRECTORY | O_NOFOLLOW`; reject links, foreign owners, group/other write,
  special permission bits and children on a different filesystem. Retain handles for
  permission changes, never recurse into application-controlled content.
- Existing directories must belong to the configured app UID/GID. Root-owned
  empty directories are also admitted as interrupted provisioning; nonempty
  root-owned directories are not reinterpreted as an incomplete attempt.
- Create absent children at 0700, without recursive mkdir. For owned or resumable
  children, set 0700 on the open handle; hand new/root-owned children to the app
  last. Synchronize each directory and the parent, then verify every final owner,
  group and mode. Never read, replace or regenerate encryption keys or settings.
- Fixed four-directory bound; one serialized attempt, ten-second operation budget
  and one-second cancellation join. Check cancellation between filesystem calls.
  An unjoined filesystem call fails the enclosing startup; no runtime admission
  or automatic cleanup occurs. The host/container is the final termination bound.
- A crash can leave missing, root-owned empty, or correctly app-owned directories.
  Repeating the same verified identity is safe. A partial failure is not rolled
  back or called success; changed configured IDs fail closed on existing content.
- Completion means four verified application directories and completed syncs,
  not database selection, installation conversion or import/metadata completion.

The current production entrypoint still refuses a reserved protected database
layout before its recursive chown. Forced-non-root saved templates retain the
compatible startup path; no root privileges are manufactured and no new setting
or mount is required. No automatic conversion or legacy-owner reset is enabled.

## Research and alternatives

Official sources discovered with web search and opened on 2026-10-04:

- [PostgreSQL initdb](https://www.postgresql.org/docs/18/app-initdb.html) requires
  initialization under the eventual non-root server identity, and recommends
  preparing an owned child beneath a root-owned parent where needed.
- [PostgreSQL file locations](https://www.postgresql.org/docs/18/runtime-config-file-locations.html)
  permits separating configuration and database storage. The existing selected
  adapter pins both; this work preserves that separation.
- [Node filesystem documentation](https://github.com/nodejs/node/blob/main/doc/api/fs.md?plain=1)
  documents no-follow opening, directory/file handles, descriptor permission
  operations and synchronization. Inspecting a path alone is not sufficient for
  a later permission write; use the retained descriptor.
- [Docker runtime permissions](https://docs.docker.com/engine/containers/run/)
  explains user/capability overrides. A saved forced-non-root template cannot
  silently acquire the authority needed for protected provisioning.

| Choice | Benefit | Cost / risk |
| --- | --- | --- |
| Recursively change all appdata ownership | Minimal implementation | Destroys protected database/configuration separation |
| Fixed child directories, retained handles — selected | Preserves content; bounded writes and safe restart states | Needs explicit integration and custom-path/restore decisions |
| Require new mounts for every writable directory | Clear mount boundaries | Breaks saved templates and adds installation work |

Recommendation stack: prove protected application storage; connect capability-aware
production dispatch, restricted runtime and restore/maintenance handoff; finish
database-enforced writer admission; then enable unattended legacy recovery and
rehearse published upgrades. This backend-only change has no new web interaction.

## Acceptance

Unit checks cover invalid identities, unsafe paths/owners/modes/mounts, no-write
preflight failures, interrupted creation, sync errors and cancellation. Real Linux
checks must preserve synthetic settings and key bytes, allow app writes in all
four children, reject app writes to the protected parent, reject a substituted
symlink without changing its target, and repeat successfully across a real killed
provisioning process. These are isolated tests, not live migration authority.
