# Saved deployment configuration admission

Date: 2026-10-05. Follows [operator tuning](selected-tuning-design.md).

## Decision

Add a pure, internal ESM compiler for resolved container environment settings.
Do not parse host Compose files or overwrite saved Unraid XML. Partition reviewed
application values from supervisor-owned identity, umask, startup deadline and
vector-staging choices. Reject unknown or unsupported input before selection.
This prepares production dispatch; it does not activate it or change compatible
startup. A reviewed configuration is not proof of safe filesystem permissions,
writer quiescence, OS account separation or completed migration.

The compiler requires the effective heap option after existing cgroup sizing.
Accept only one canonical `--max-old-space-size=N` option, 256–65536 MiB.
Do not inherit preload, inspector, TLS-bypass or other executable options. Missing
or unlimited automatic sizing remains deferred rather than becoming an invented
1 GiB cap. Preserve saved 1536 MiB Compose heaps and explicit reviewed overrides.
This is a compatibility bound, not a claim that 64 GiB is suitable for a NAS;
heap is not total RSS and PostgreSQL also needs memory.

Pin the compatible application's effective pool/retry defaults (15/2) in the
compiled profile instead of silently substituting protected defaults (5/0).
Explicit values retain precedence, including zero connection retries and disabled
age retention. Database/JSON precedence remains with existing consumers.

## Boundaries and failures

- Accept only bounded string own properties in a plain environment snapshot.
  Unknown names, authority overrides, malformed values and unsupported restore
  HTTP mode produce fixed errors without keys, values or credentials.
- Only known image/container metadata is discarded. Unknown platform extensions
  need review; there is no broad prefix-based allowlist.
- Legacy embedded database identity may be absent or exactly match the bundled
  local database. Remote/alternate credentials and privileged retirement settings
  are not converted. Credentials never enter the maintenance environment.
- Return requested PUID/PGID, umask, vector staging and startup timeout separately.
  The eventual dispatcher must consume and verify them, not drop them. It must
  also inspect actual UID/GID and mounts. Forced-non-root templates continue on
  their current compatible path; this compiler cannot grant missing privilege.
- Host mount interpolation names are not container environment settings. Reject
  them here; changing a path string cannot create or validate a Docker mount.
- No I/O, background service, retries, key generation, ownership reset, data
  mutation or new HTTP/UI contract. No W3C interaction change is needed.
- Exercise the compiler in the existing isolated real-image fixture before
  passing its application profile to the protected launcher. Supervisor settings
  are checked but production dispatcher integration remains a follow-up.

## Research and alternatives

Official sources discovered by web search and opened on 2026-10-05:

- [Docker environment precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/):
  the resolved container environment, not an assumed host `.env`, is authoritative.
- [Unraid Community Applications](https://docs.unraid.net/community-applications/):
  existing settings survive through saved user templates. An image update must
  not depend on all users adopting new template fields.
- [Node 24 command-line API](https://r2.nodejs.org/docs/latest-v24.x/api/cli.html):
  `NODE_OPTIONS` can control runtime loading; old-space limits are not RSS limits.

| Option | Benefit | Cost |
| --- | --- | --- |
| Inherit parent environment | Broad compatibility | Transfers execution/DB authority |
| Fixed protected defaults | Small profile | Silently changes operator resource choices |
| Explicit compiled profile — selected | Preserves reviewed values and rejects gaps | Unsupported settings need review |
| Require edited templates | Simpler rollout | Breaks stale Compose and saved Unraid installs |

Recommendation stack: explicit deployment admission; restricted restore HTTP;
production dispatcher that consumes all supervisor settings; published-old-image
upgrade rehearsal; database-fenced unattended ingestion recovery. Key rotation
and lost-key reset remain separate: notification cannot recover ciphertext.
