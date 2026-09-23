# Library profile upgrade rehearsal — design

## Decision

Before a release or live-data migration, rehearse the library-profile upgrade on
the **exact v0.48.4-beta schema snapshot** in a fresh disposable PostgreSQL
container. Seed only synthetic movie and TV inventory. Apply the repository's
normal migration runner, then exercise upgrade enrollment, profile planning,
transient retry, process-instance replacement, inactive-library pause and
resumption, and revision-verified publication. No provider or user library data
is needed for this rehearsal.

The entry point is `npm run test:local:library-profile-upgrade-rehearsal`. It
does not accept a database URL or dump path, pins the release tag to commit
`a0e417fd714919bb4ca30e20f9cd2380136ca74e`, uses a random database
password, and refuses to load the schema unless the target is an empty database
named `classifarr_rehearsal`. Its container is stopped in a `finally` block.
The synthetic timeout's retry clock is advanced **only in that database**;
production timing and retry policy are unchanged. Results contain statuses and
revision counts, not media titles or credentials.

## Options and tradeoffs

| Option | Advantages | Costs / limits |
| --- | --- | --- |
| Static/unit checks only | Fast and no container dependency | Cannot prove migration SQL, outbox, and profile publication work together. |
| Pinned release schema plus synthetic inventory (selected) | Repeatable, private, tests the real SQL and service chain across movie and TV paths | Does not reproduce real data distribution, active provider outages, startup scheduling, or a container-image upgrade. |
| Sanitized copy of a real user database | More representative data and historical edge cases | Privacy, consent, redaction quality, retention, and accidental live-target risks; a separate authorized workflow is required. |

Recommended stack: focused unit tests for pinning and target guards; this
disposable PostgreSQL rehearsal for the integrated upgrade path; then a
separately authorized, read-only installation-specific rollout assessment
before a real release. A green rehearsal is necessary evidence, not approval
to restart a live instance or route media automatically.

## Boundaries and source rationale

- PostgreSQL documents consistent exports and distinguishes plain SQL scripts
  from archive restore formats. The checked-in release schema is a plain SQL
  snapshot with a migration ledger, so this tool loads that exact tagged file
  into an empty database rather than guessing a live schema or importing an
  unreviewed dump: [PostgreSQL 18 `pg_dump`](https://www.postgresql.org/docs/18/app-pgdump.html).
- Testcontainers' official PostgreSQL module supports starting a short-lived
  PostgreSQL image and connecting with `pg`: [Testcontainers for Node.js](https://node.testcontainers.org/modules/postgresql/).
- Docker bind mounts can modify host files by default. The rehearsal gives its
  database container no bind mount of the application's persistent `data/`
  directory: [Docker bind-mount guidance](https://docs.docker.com/engine/storage/bind-mounts/).
- There is no new UI in this change. If the rehearsal outcome is later shown in
  the Command Center, dynamic progress and result messages must be exposed to
  assistive technology without stealing focus, consistent with
  [W3C WCAG 2.1 SC 4.1.3](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).

## Security and failure handling

The pinned Git commit is verified before container startup. The runner uses
injected database access, while production keeps its original default client.
The public rehearsal command has no path to a live database, shared Docker
volume, media provider, or routing mutation. A failed migration or state
assertion exits nonzero. The database and generated synthetic identifiers are
discarded on completion. This test does not assert that Docker itself is a
security boundary against a malicious host or daemon.

## Next decision

For release readiness, add an opt-in, read-only assessment that reports
installation-specific inventory breadth and pending upgrade work **without**
exporting titles, provider payloads, or credentials. Only after reviewing that
assessment should a separate, consented representative-data rehearsal or
controlled release rollout be considered.
