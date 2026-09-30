# gRPC dependency maintenance design

Date: 2026-09-30. Base revision: `ef3ee11f`.

## Decision and scope

Update the server lockfile's single `@grpc/grpc-js` instance from 1.14.4 to
1.14.5. Keep Testcontainers, Dockerode and the application version unchanged.
The existing Dockerode range (`^1.11.1`) accepts this patch; no new direct
dependency, transitive override, application service or runtime listener is needed.

This completes the dependency-alert follow-up before continuing the
[privileged maintenance handoff](../architecture/embedded-supervisor-outcome.md#limits-and-next-component).
It does not claim to fix unknown ingestion ownership, change database privileges,
restart an installation or create a release.

## Evidence and trust boundaries

GitHub CLI retrieved the alerts using the operator's saved login. Process-local
token environment variables were omitted for those requests because the existing
environment token failed authentication; stored credentials were not modified.
Public advisory URLs came from the authenticated alert records, not constructed
guesses. Static triage preceded dependency changes and execution tests.

| Alert | Package-level defect | Classifarr assessment before update |
| --- | --- | --- |
| [115](https://github.com/cloudbyday90/Classifarr/security/dependabot/115), high | Optional-client-certificate TLS can expose an unverified peer as identity | Not actionable on inspected paths; high confidence |
| [114](https://github.com/cloudbyday90/Classifarr/security/dependabot/114), low | Thrown server-handler messages leak to RPC clients | Not actionable on inspected paths; high confidence |

These are application-exposure verdicts, not dismissals of vulnerable package
presence. Both advisories affect the installed 1.14.4 dependency and are updated.

The dependency chain is `@testcontainers/postgresql` → `testcontainers` →
`dockerode` → `@grpc/grpc-js`, entirely marked development in the server lockfile.
The standard Docker backend install uses `npm ci --omit=dev`; its installed tree
is copied into the production image. Neither other workspace lockfile contains
gRPC. Development dependencies still deserve security maintenance.

Dockerode really does contain a gRPC server. Its BuildKit `buildImage` version
`"2"` branch opens a Docker `/session` connection, uses `createInsecure()` and
injects that socket into the server. It does not use TLS certificate identity for
authorization. Current repository consumers start existing PostgreSQL images;
none enables `withBuildkit`, `fromDockerfile` or Docker `buildImage`. There is no
repository `getAuthContext` or optional client-certificate authorization caller.
No sensitive handler-exception trigger was demonstrated in the Docker session.

The inspected boundaries are in `server/package.json`, `server/package-lock.json`,
`Dockerfile`, integration global setup and the PostgreSQL rehearsal scripts.
Installed dependency source corroborates the optional Dockerode session gate and
gRPC sinks. SECURITY.md supports the latest release and private reporting; it does
not certify arbitrary custom installs or external development scripts.

## Official research and tradeoffs

Sources reviewed as of September 30, 2026:

- The maintainer's [certificate-identity advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j)
  and [error-disclosure advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4)
  identify 1.14.5 as the patched version for the installed line.
- The [1.14.5 release](https://github.com/grpc/grpc-node/releases/tag/@grpc/grpc-js@1.14.5)
  includes both fixes. npm registry metadata confirmed its version, engine
  compatibility and the integrity value written by npm into the lockfile.
- The [certificate patch](https://github.com/grpc/grpc-node/commit/2a84ec8b01b9db68ed9d2b117a53a81449edb8ee)
  checks TLS authorization before exposing identity. The
  [error patch](https://github.com/grpc/grpc-node/commit/350de32860428cc62473a00bee4035360690ffea)
  hides thrown details by default. Do not enable
  `GRPC_NODE_DEBUG_SEND_ERROR_DETAILS=true` in normal test/CI environments.
- [npm installation documentation](https://docs.npmjs.com/cli/v11/commands/npm-install/)
  describes lockfile-driven resolution and package-lock-only updates. Use npm to
  regenerate integrity metadata, inspect the narrow diff, then reinstall from the
  committed lockfile; do not hand-edit vendored code or run a forced broad update.
- [W3C error-identification guidance](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  concerns identifying user input errors in text. This patch changes no UI/input
  contract; explicit public application errors remain intact. Do not turn raw
  server exceptions into user-facing guidance. No WCAG conformance claim is made.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Compatible lockfile patch, selected | Removes both affected implementations without graph expansion | Requires committed lockfile and regression checks |
| Add exact override | Forces a chosen transitive version | Unnecessary for the accepted range; extra maintenance and can hold future fixes back |
| Remove or replace Testcontainers | Eliminates this dependency chain | Loses established database integration tooling; disproportionate change |
| Dismiss because development-only | No implementation cost | Retains vulnerable code and ignores developer/CI trust boundaries; rejected |

Recommendation stack: patched lockfile; bounded real-dependency regressions;
development-inclusive npm/OSV scans without ignores; existing CI and Docker
integration checks. Keep the existing production dependency exclusion.

## Verification design

Two small ESM suites cover separate invariants:

1. The installed `BaseServerInterceptingCall.getAuthContext` must reject
   unauthorized or non-TLS socket identity, and preserve authorized identity.
   Controlled real `TLSSocket` state avoids expiring private-key fixtures; this is
   a boundary-unit test, not certificate-chain or TLS-handshake verification.
2. Actual ephemeral loopback gRPC calls must hide thrown `Error` and message-bearing
   object details for unary, client-streaming, server-streaming and bidirectional
   handlers. Successful payloads and deliberate public errors must still work.
   Calls have two-second deadlines; clients, servers and sockets are cleaned up.

Run before and after the update so a safe response cannot merely be a broken
fixture. Check imports/syntax, nearest runtime compatibility, real PostgreSQL
Testcontainers workflows, backend coverage, lint, types and dependency gates.
Never modify live credentials, library records, scanner ignores or alert state.

See [validation and outcome](2026-09-30-grpc-dependency-outcome.md).
