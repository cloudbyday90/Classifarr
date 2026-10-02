# Synology storage and permissions design

## Decision

Improve the existing Synology deployment, not the application architecture.
Preserve the image, appdata destination and default source, identities, port,
network, startup command, 60-second stop budget and healthcheck. Remove the
obsolete Compose `version` declaration. Use a long-form appdata bind mount with
`create_host_path: false` and an optional `CLASSIFARR_APPDATA_PATH` override.
Missing appdata now fails at deployment instead of becoming an empty directory.

Add an opt-in media overlay requiring `CLASSIFARR_MEDIA_PATH`. Default to
read-only verification; moves require `CLASSIFARR_MEDIA_READ_ONLY=false` plus
filesystem permission. It adds only `/data/media`, never replaces `/app/data`.
The GUI guide explains how to use the same entry in one saved project YAML, or
use separate movie/TV entries, without depending on multi-file GUI support.

No new dependency, background process, model, database migration, API contract,
container socket mount, privileged mode or release. Tests use ES modules.

## Compatibility and security boundaries

Target maintained DSM/Container Manager combinations offered for the operator's
supported NAS model. Do not claim every DSM 7.x system supports Container Manager
or that every compatible CPU has been tested. Do not sideload unsupported NAS
packages or require recent Compose `include`, `!reset` or lifecycle-hook features.
Long-form binds must validate on the target's installed Compose implementation;
an unsupported option is a compatibility failure, not permission to remove the
missing-folder protection silently.

Keep existing startup permissions. The current entrypoint provisions the configured
identity, may recursively change ownership in `/app/data`, then drops privileges.
That makes a dedicated appdata directory essential. Media stays outside that
tree. A forced `user:` migration, filesystem-wide ownership repair or separate
database privilege rollout is not part of this patch.

`create_host_path: false` prevents silent directory creation; it does not prove
that an existing path contains the intended data, detect an unmounted share
whose mountpoint still exists, or check DSM ACLs. Operators must verify actual
paths and permissions. Keep appdata on a local NAS volume and preserve the
backup/image/configuration combination for rollback.

## Options and recommendation stack

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Explicit appdata plus optional read-only media | Preserves API-only installs and limits file access | One-time path/permission review; move users must opt into writing | Implement first |
| Always mount guessed writable media paths | Fewer setup choices | Exposes unwanted folders or creates empty paths | Reject |
| Force non-root startup or change saved IDs now | Tighter initialization boundary | Can break existing database ownership and recovery | Separate migration, not this patch |
| Add a universal small-NAS CPU/RAM cap | Immediate resource ceiling | May kill legitimate migrations/backfills without workload measurements | Measure on actual NAS before choosing defaults |

Recommended order: explicit storage and documented permissions; actual modern
Synology install/upgrade acceptance; resource measurements and bounded defaults;
then broader release acceptance. General Docker checks do not certify DSM ACLs,
the GUI, a specific NAS CPU or database downgrade compatibility.

## Research

Reviewed on 2026-10-02 for the requested September 2026 baseline. These are live
official documents, not archived September snapshots. No October-only feature
is required. Synology's model-specific package/release pages remain authoritative
for availability; this repository does not freeze a vendor support matrix.

- [Synology Container Manager package](https://www.synology.com/en-in/dsm/packages/ContainerManager)
  provides the applied-model list. Scope support by actual package availability.
- [Synology Container Manager Projects](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project)
  documents Compose upload/edit and project operations. Preserve saved project
  settings rather than promising image updates will rewrite them.
- [Synology mapped-folder troubleshooting](https://kb.synology.com/vi-vn/DSM/tutorial/Docker_container_cant_access_the_folder_or_file)
  identifies both volume mode and filesystem permission checks. Our recommendation
  is least-privilege access for the selected identity, not broad Everyone access.
- [Docker Compose service reference](https://docs.docker.com/reference/compose-file/services/)
  documents long-form binds and `create_host_path`. Resource limits are separate
  from storage and require their own acceptance measurements.
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
  explains host coupling and writable access. We limit the optional mount's scope.
- [Compose merge rules](https://docs.docker.com/reference/compose-file/merge/)
  identify mount targets as unique keys; the overlay adds a different target.
- [W3C writing guidance](https://www.w3.org/WAI/tips/writing/)
  informs task-oriented headings, descriptive links and short instructions.
  No UI change or WCAG-conformance claim is made here.

The [operator guide](../installation/synology.md) documents setup and updates.
The [outcome](synology-storage-outcome.md) records checks and remaining limits.
