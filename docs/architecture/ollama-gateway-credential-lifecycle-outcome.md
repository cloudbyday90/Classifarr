# Ollama gateway credential lifecycle outcome

Status: Unreleased, 2026-10-14. See the separate
[design, tradeoffs and official research](ollama-gateway-credential-lifecycle-design.md).

## Implementation

Small ESM modules own the private file reader, bounded reload coordinator and
request-scoped credential authority. The standalone Linux CLI reloads only
credentials on SIGHUP. Atomic publication retains unchanged callers and cancels
removed or rebound credentials. File/configuration failure stops the gateway;
neither a reload nor a restart resets the durable attempt/uncertainty ledger.

There are no new dependencies, tables, migrations, HTTP administration endpoints,
application settings or automatic retries. Existing UUIDv7 identifiers remain.
Normal Classifarr routing is unchanged. The complete source-level cutover matrix
now includes interactive rule suggestions, inspection, warming, model installation,
embedding adapters and study tools as well as primary generation and verification.

## Verification

Focused gateway checks passed: four suites, 86 tests. Real HTTP and isolated
PostgreSQL checks passed: one suite, 51 tests. They cover active buffered/streaming
revocation, queue cancellation, inspection, claim/completion races, token overlap,
unchanged authority, incomplete body intake, overlap queue limits, durable attempts,
cooldown and owner continuity. Type checking, backend test/security lint, normal
and production dependency reachability, static imports, ESM mock shapes,
copyright, Markdown, migration naming and schema snapshot integrity passed.
The inventory ownership gate passed without manifest changes or new waivers;
its existing unresolved paths remain unresolved.

The full backend unit run passed all 1,840 suites: 58,317 passed tests and one
existing skipped test, in 377.523 seconds. The total includes repository static
assertions, not just runtime scenarios. The targeted integration run covers the
gateway suite, not all database integration suites. Frontend unit/coverage checks
were not run because no frontend or application API contract changed; the image
build compiled the frontend. Gitleaks found no leaks in the implementation commit.

The recovery-change skill guided the request-lifetime checks, durable uncertainty
invariants and network-isolated rehearsal. No safety baseline or ownership waiver
was changed to make tests pass.

## Image and local evaluation

The no-cache Compose build passed from clean implementation commit
`46555aa29d4d7fbadccf1e737a061192a6c22e2c`. The immutable candidate image is
`sha256:c767f6d374c33af3944c9af366af880bf92f1c91fa6b4cce67580c7ec51daf53`;
its OCI revision label matches that commit. Subsequent outcome-only documentation
does not change packaged runtime code or that label.

The packaged rehearsal passed against this exact image with eight synthetic
compute calls. It verified real Linux SIGHUP, atomic configuration replacement,
old/new token overlap and removal, unchanged owner/attempt counts during reload,
POSIX private-file enforcement, malformed JSON, symlink rejection, fail-closed
shutdown and continued rejection of revoked tokens after restart. It also retained
the existing generation/verification, streaming, queue priority, least-privilege
database and UUIDv7 checks. Abrupt death after the eighth request preserved the
same uncertain request and eight attempts; no ninth dispatch occurred.

The fixture had no external network or published ports, with 2 CPUs, 2 GiB RAM and
512 PIDs. It used packaged source and dependencies, not source overlays. Cleanup
of `classifarr-schema-check-fd4db300-aa48-43e8-a7a6-756578a3bf98` and its exact owned
data directory was verified. This is same-image restart evidence, not a published
release upgrade, cross-host TLS test, real-model test or proof of GPU cancellation.

Before replacement, the local database backup was written to
`data/backups/gateway-credentials-before-20261014.dump`. Its archive index has 1,933
readable lines; SHA-256:
`185CC60954E51586DA09D83CC4609E946A3FC28F6DD1472343EF758E7C3FE095`.
It remains local and has not been restore-tested.

Local Compose now runs the exact candidate image. Docker reported healthy, zero
restarts and no OOM kill; `/health` returned HTTP 200. The 2 GiB memory limit,
1,536 MiB V8 heap, read-only root, user `1000:1000` and `no-new-privileges` remain.
One post-start sample used 769.9 MiB; it is not a load or memory benchmark.
Evaluation retained `when_idle`, zero daily calls/tokens and reserved calls, and
revision 2. No gateway schema exists in the application database, and no gateway
CLI process is running. The unrelated Harmoniarr container was not changed.

The previous image remains available for rollback:
`sha256:b1f6c7c92eeb7f26848c5ab7d327d6d45972f88a6fb095205c1e18ecfec36d75`,
under `classifarr-local-rollback:10b68c0896e1b23edf7ac02585a99174df1067f999b37fda611e28efe0ec600c`.
No Docker pruning or user-data deletion was performed.

GitHub MCP enumeration found no open Classifarr PRs. No PR could be selected or
implemented, and none was merged. No release, live provider inference, Unraid
write or shared Ollama change has been made.

## Remaining work

This is server-side local credential lifecycle, not installation-wide activation.
Clients still require explicit close/recreation when their credentials change.
Cross-host TLS, network bypass prevention, all-path provider composition, token
expiry/secret management and verified unknown-outcome recovery are still deferred.

Next recommended implementation: one explicitly injected installation-level
provider context covering generation, embeddings, inspection and warming, with
unsupported model administration rejected and no direct fallback. Prove it in
isolated tests before adding any activation setting or connecting shared Ollama.
