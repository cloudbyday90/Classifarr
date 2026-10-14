# Shared Ollama admission: implementation outcome

Status: Unreleased standalone prototype, 2026-10-14. See the separate
[design/research](shared-ollama-admission-design.md) and
[operator guide](../operations/ollama-gateway.md).

## Implemented slice

The administrator approved building an optional gateway, tested locally only.
Its ESM modules separate configuration/authentication, admission, PostgreSQL
ownership, fixed-target HTTP transport and the server. A dedicated CLI starts
it explicitly; the normal application does not import or start it.

Installation/work-class credentials control foreground precedence. One compute
request can run, with bounded foreground waiting and no background prompt queue.
Fixed route/model allowlists, byte/time/connection/intake bounds, sanitized error
codes and a loopback-only listener limit the initial surface. No gateway retries,
redirects, cloud fallback or arbitrary upstream targets are introduced.

A dedicated PostgreSQL session owns the gateway lock. A durable marker is written
before dispatch and cleared only after a known terminal response and successful
completion write. Lost sessions, cancellation, abrupt termination and unknown
outcomes cannot clear that marker or reset attempts. Complete overload responses
persist a five-second cooldown. No clear-lock/reset operation is provided.

The independent migration is timestamp-named
`20261014_121441_admission.sql`. Its table primary key, gateway owner and request
references use PostgreSQL 18 native time-based UUIDv7 with database constraints.
A separate singleton constraint prevents duplicate control rows. No existing
application table or identifier is changed. The migration is also the dedicated
database's fresh schema; it is intentionally outside automatic app migrations.

## Verification

- Gateway unit and repository code-health checks: two suites, 35,044 tests passed.
- Isolated PostgreSQL and actual HTTP gateway/workload checks: two suites, 25
  tests passed. Gateway-specific coverage includes two installation credentials,
  authentication, allowlists, request/response bounds, priority, cancellation,
  truncated/malformed replies, overload cooldown, missing state, competing owners,
  concurrent claims, lost completion writes, lost database sessions and actual
  standalone-process death/recreation. UUIDv7 versions/timestamps are checked.
- Type checking includes all new gateway modules and its CLI. Backend lint and
  normal/production dependency reachability checks passed.
- Static import, migration naming, application schema snapshot, copyright,
  Markdown and whitespace checks passed. The inventory ownership gate passed
  after reviewing the new ledger's dedicated-database SQL; no existing ownership
  debt was waived. Gitleaks found no leaks in the implementation commit.

The focused checks above are not a full backend/frontend coverage run. No client
code changed. Synthetic tests do not measure real-model quality, GPU memory,
cross-host TLS or published-release upgrade behavior.

## Packaged image and local Compose outcome

The clean-source, no-cache build passed at implementation revision
`a4a53bb456f559b896eeb3addd5081c1280342eb`. The tested local image is
`sha256:d196409b60f16b95135a675de268003fc998a1bd260a894050bfbf5521ddbc58`;
its source label matches that revision. This outcome document is a subsequent
documentation-only commit, not a claim that the image contains that later commit.

The packaged-service rehearsal passed with five synthetic compute calls, two
installation credentials and a least-privilege database role. It checked
authentication, foreground precedence, UUIDv7, graceful restart, actual abrupt
process death and preservation of the uncertain marker and attempt count after
restart. No second compute request was dispatched while the outcome was unknown.
The fixture used no external network or published ports and retained the normal
application entrypoint. Cleanup of its exact owned container and data directory
was verified. This is same-image process-restart evidence, not a release upgrade.

Before replacing local Classifarr, a database archive was created and its table
of contents read successfully (1,933 lines). The archive is local-only and was
not restore-tested. The prior image remains available under a rollback tag:
`sha256:adabd220d5ab1b14b3ed0799951b1114cf8bb833f1e34da661ef2318feb2084c`.

Local Compose now runs the exact tested candidate image. The health endpoint
returned HTTP 200, Docker reported healthy, zero restarts and no OOM kill. The
2 GiB container limit, read-only root, user `1000:1000` and `no-new-privileges`
setting remain intact. The evaluation budget retained `when_idle`, zero daily
calls/tokens, zero reserved calls and revision 2. The application database still
has no gateway schema, and no gateway CLI process is running. Building and
replacing the application did not activate the optional gateway.

## Preserved boundaries and next item

Existing Classifarr clients are not rerouted. Their budgets, consent, memory
safeguards, model validation and checkpoints are unchanged. No live inference,
Unraid setting, shared Ollama configuration, provider restart, release or PR merge
is included. GitHub MCP enumeration again returned no open Classifarr PRs.

Next: integrate a common authenticated transport into the real clients, retaining
streaming and embedding behavior, and prove cancellation/uncertainty handling
end to end before planning cross-host deployment. The restricted first gateway
is not a drop-in replacement for every current Ollama operation. Production
cutover also requires a reviewed uncertainty-recovery procedure and prevention
of direct-client bypass; independent databases still do not coordinate today.
