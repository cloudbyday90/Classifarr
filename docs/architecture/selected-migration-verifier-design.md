# Selected migration verification and bootstrap handoff

Date: 2026-10-05. Follows [lifecycle integration](selected-deployment-lifecycle-design.md).

## Decision

Replace the lifecycle fixture's verification callback with production ESM modules
that verify a stopped, already-converted PostgreSQL 18 candidate without synthetic
tables or fixture credentials. Pass saved deployment settings to a fixed verifier
child through bounded stdin, using a constructed process environment. Saved
`NODE_OPTIONS` is data to validate, not an option for privileged Node startup.

The caller must hold the migration journal lease through verification and the
subsequent lifecycle. The expected cluster system identifier must come from the
independently recorded original cluster, not the candidate being checked. This
work does not invent that record, copy a live database, provision identities, or
enable automatic production conversion. The entrypoint guard remains in place
until the offline conversion/provisioning path is implemented and tested.

## Contract

- Require Linux/root, separated actual OS accounts and matching saved UID/GID/mask.
- Reject an active candidate, links, hard links, external tablespaces/WAL, unsafe
  ownership/modes, unexpected major version or a mismatched cluster identifier.
  Scan at most 50,000 entries / 8 GiB, with cancellation and a bounded preflight.
- Admit only the reviewed external peer-authentication policy and minimal database
  configuration; no include files, executable commands or alternate preload paths.
  Unsupported database tuning is refused, never rewritten or silently dropped.
- Start the verified candidate once, without normal workers. Run fixed catalog
  checks through the database OS identity, with no password, psql startup file,
  caller SQL, inherited environment, or inherited session preload libraries.
- Require a passwordless, unprivileged runtime role with no memberships, owned
  database objects or role/database setting overrides. Verify effective database
  and schema restrictions. Catalog checks use a read-only transaction.
- Stop and join the candidate even after a catalog failure. An uncertain child
  exit fails the caller/container; no automatic restart or retry. Recheck stopped
  state before admitting selection. No media inventory or key mutation.
- Bound bootstrap input to 64 KiB and its read to two seconds. Reject malformed,
  oversized, duplicate-field/unsupported shapes and unexpected process context.
  Never log saved values, raw helper output or credentials.
- Fresh and compatible saved-template installations gain no new background work.
  This verifier is internal, not an operator repair command or an HTTP endpoint.

## Official research

Sources discovered through MCP web search and opened on 2026-10-05:

- [PostgreSQL file-system backups](https://www.postgresql.org/docs/current/backup-file.html):
  ordinary file copying requires a stopped cluster; copying selected files is not
  a valid database backup.
- [PostgreSQL database layout](https://www.postgresql.org/docs/current/storage-file-layout.html):
  distinguish configuration, auto-configuration, tablespaces, WAL and PID state.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  construct child environments, avoid shell concatenation and observe actual exit.
- [PostgreSQL role membership](https://www.postgresql.org/docs/18/catalog-pg-auth-members.html):
  role flags alone do not prove that membership cannot grant additional authority.
- [PostgreSQL parameter precedence](https://www.postgresql.org/docs/18/config-setting.html):
  client startup options and per-role/database settings require explicit treatment.
- [PostgreSQL authorization catalog](https://www.postgresql.org/docs/18/catalog-pg-authid.html)
  and [role/database settings](https://www.postgresql.org/docs/18/catalog-pg-db-role-setting.html):
  role flags/passwords and configuration overrides reside in different catalogs;
  the verifier queries both and the real-image test exercises an override refusal.

## Alternatives and recommendation

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Keep synthetic verification | Existing test coverage | Cannot validate real installations |
| Production verifier and bounded handoff — chosen | Reusable checks without fixture data or inherited execution options | Conservative configuration admission; not a converter |
| Automatically convert now | Immediate unattended rollout | Missing production provisioning and published-upgrade evidence |

Recommendation stack: production verification and handoff; offline conversion with
independent durable cluster binding and vector-policy preservation; published-old-
image upgrade rehearsal; database-fenced unattended legacy ingestion recovery.
No UI/API contract changes or new accessibility interactions are introduced.
