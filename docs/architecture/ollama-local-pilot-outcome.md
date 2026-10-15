# Isolated full-application gateway pilot outcome

Implementation, 2026-10-15. Unreleased; no branch, release or PR merge.
See the [design and recommendations](ollama-local-pilot-design.md) and
[operator guide](../operations/ollama-local-pilot.md).

## Delivered

Extended the existing network rehearsal with focused ESM host orchestration and
HTTP/application fixtures. It uses a fresh normal application instead of
substituting its authentication, migrations, admission or scheduler. The gateway
fixture now runs with restricted database privileges. Existing UUIDv7 schema,
attempt accounting and default direct routing are unchanged. No dependencies or
new tables were introduced.

## Verification

The initial isolated run passed all four full-application phases (seed, active,
unavailable, replaced) and cleanup against the prior local image. The final run
against the no-cache candidate also passed, including the restricted-role denials
and unchanged admission snapshot across history reads, outage and replacement.
There were exactly two provider compute attempts: the existing composition
generation and the full application's explicit warming. There was no extra
startup, history, retry or replacement compute during the bounded test.

Real setup/login sessions, anonymous 401, ordinary-user 403, invalid-filter 400,
private administrator history, task filtering, gateway-outage 503 and subsequent
history recovery passed. The application had no direct network path to the
provider. Same-image replacement retained identical request records, without
rolling back or resetting the separate gateway ledger. Runtime access to recovery
operator/evidence columns and deletion of completion receipts were denied.

Host tests passed 11 tests, including three new command-contract cases. Focused
backend tests passed three suites / 91 tests; real PostgreSQL/HTTP gateway
integration passed nine suites / 212 tests. Type checks, test/security/client lint,
npm CLI flags, static imports, copyright, syntax checks and Markdown checks passed.
No coverage baseline was changed. The full application/frontend suites were not
rerun for this test-infrastructure-only change; no runtime/UI/API code changed.

## Candidate image and existing recovery checks

Clean-source no-cache Compose build passed for source
`2d5141407d606eb6d8d2959b9ca0ef3cacad85b2`, immutable image
`sha256:3e5ef70ba84d906d2e2e8af4894ec5784749a147009093482667d74a3acd60fc`.
The subsequent outcome-document commit does not change runtime or test code.

The existing packaged rehearsal also passed: private upstream TLS identity,
restricted runtime, credential rotation/revocation, scoped task history,
completion and offline recovery, dedicated synthetic provider stop, abrupt death
and preserved uncertainty. Its main fixture made 19 synthetic calls, completion
fixture four and TLS fixture two. History and offline recovery made no provider
calls. Both runners verified removal of their exact disposable resources. No
real provider was used and no production recovery was attempted.

Before replacing local Compose, created
`data/backups/gateway-full-pilot-before-20261015.dump`, SHA-256
`0EC8E0E508FBEFAAD5B44C669F926FA7F2715B5219751ABA2848CD5FBBF3B889`.
Its `pg_restore --list` completed with 1,933 lines; this is not a tested restore.
Protected prior local image:
`sha256:4c1ac8d1a5d975c7d1ebe97d0192d6712d079f2ae5b6e0266676c4c01d4affbb`,
source `3997cd4bcc077b95e40f27bd73f5e34315b25faa`.

Local Compose replacement completed with no build, dependency replacement or
pull during startup. Its running image and source matched the candidate above;
health was good, restart count zero and OOM false. `/health` and `/` returned 200,
unauthenticated history 401. UID/GID 1000:1000, read-only root,
no-new-privileges, 2 GiB memory and the existing data/media mounts were retained.
There is no Docker socket, gateway routing environment or gateway schema in the
normal local application. Evaluation remained `when_idle`, zero daily calls,
tokens and reservations, revision 2 and the unchanged next-check timestamp.
A short settled sample was 637.6 MiB / 2 GiB, 1.26% CPU; not a peak-load guarantee.
The unrelated Harmoniarr container, Unraid and shared Ollama were untouched.
The local backup and protected rollback image remain available.

## Limits and next step

Synthetic warming and history validate the integration boundary, not GPU/model
performance or a real classification task. Same-image container replacement is
not a version upgrade. Disposable application containers retain the existing
schema runner's filesystem setup; this is not production hardening certification.
Retention/archiving and separately approved real-provider
capacity/network review are next; neither shared Ollama nor Unraid is changed.

The current GitHub MCP open-PR query returned zero results. No closed or merged PR
was substituted for the requested random open PR.
