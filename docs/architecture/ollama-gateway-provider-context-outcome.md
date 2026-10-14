# Shared Ollama provider context outcome

Date: 2026-10-14. Implementation:
`62539a0b45fc16493312c33676af25a95414b619` on `main`.

## Result

Implemented the [provider-context design](ollama-gateway-provider-context-design.md)
as small ESM modules. One context owns the authenticated transport, immutable
provider/model bindings and cancellation lifetime for generation, verification
preflight, text embeddings, inspection and warming. The generation-only factory
remains compatible. The embedding adapter accepts an explicitly injected context
and rejects conflicting endpoint overrides without entering direct HTTP or retry
code. Existing application constructors do not activate this dependency.

Warming now has a narrow gateway contract and spends a durable compute attempt.
An empty prompt cannot request unloading, streaming or extra generation options.
Invalid warming responses preserve uncertainty. Gateway embedding completion now
requires nonzero finite float32 vectors with consistent dimensions before clearing
the durable marker. Missing models are not downloaded; truncation is disabled.

No dependencies, tables, migrations, activation settings, retries or releases were
added. Existing PostgreSQL 18 time-based UUIDv7 identities and attempt limits are
unchanged. Unreleased and the operating guide document the new behavior.

## Research and recommendation

The design records official Ollama, Node.js and OWASP sources discovered/opened
through MCP on October 14, 2026. Retain Node 24 ESM, PostgreSQL 18/UUIDv7, bounded
authenticated gateway admission and composed provider clients. Add cross-host TLS
before deployment beyond the local test boundary.

The benefit is consistent identity, cancellation and admission without expanding
the existing singleton. The cost is an explicit application-composition step;
this is not yet installation-wide routing. Generation-only routing is simpler
but leaves competing embedding/warming traffic uncoordinated. Rewriting the
singleton immediately would couple settings, timers, transport and activation.
The composed context remains the recommended approach.

## Verification

- Focused gateway unit tests: 5 suites, 123 passed.
- Real loopback HTTP and isolated PostgreSQL gateway tests: 1 suite, 67 passed.
  These cover separate generation/embedding model roles, mixed operation attempt
  accounting, exact model checks, warming response validation, float32 and batch
  dimensions, cancellation of compute plus inspection, queued warming cancellation,
  the shared 32-request limit, endpoint refusal and no adapter retry after 503.
- Full backend unit run: 1,841 suites, 58,390 passed tests, one existing skipped
  test, 379.379 seconds. Counts include static repository assertions.
- Type checking, backend test/security lint, normal and production dependency
  reachability, static import checks, ESM mock shapes, copyright and Markdown
  passed. Migration naming/schema snapshot integrity and inventory ownership
  drift checks passed without changing baselines or waivers. Existing unresolved
  inventory ownership paths are not newly authorized.
- Gitleaks found no leaks in the implementation commit. No frontend/API contract
  changed: frontend unit/coverage tests and the full database integration matrix
  were not rerun. The image build compiled the frontend.

The recovery-change skill guided the durable-uncertainty cases and real HTTP,
PostgreSQL and packaged-image tests. Initial new array-parameterized unit tests
incorrectly unpacked their fixture values; wrapping each array as a single test
argument corrected the harness. Final focused and full unit runs passed.

## Exact image and local evaluation

The no-cache Compose build used clean implementation commit
`62539a0b45fc16493312c33676af25a95414b619`. Candidate image:
`sha256:e2f0f7a2a16e56f983e50866e3dda1c61aaf25b802f9fad2495f8a39f69fbc6c`.
Its OCI source label matches that commit. This subsequent outcome document does
not change packaged runtime code or the image label.

The existing network-disabled Linux rehearsal passed against this immutable
image with 11 synthetic compute calls. Embeddings and both warming operations
used the packaged context. Credential reload/revocation, UUIDv7, queue admission,
least-privilege PostgreSQL access, malformed/private-file failure shutdown,
graceful restart and abrupt death checks also passed. Killing the eleventh call
preserved the same uncertain request and 11 attempts; no twelfth dispatch occurred.
There were no external provider calls or source/dependency overlays in the fixture.

The fixture used 2 CPUs, 2 GiB memory, 512 PIDs and no published ports. Its exact
owned container `classifarr-schema-check-d1ee5671-52f3-4473-8c76-e3edcf85cccd` and
data directory were removed, with cleanup verified. This is same-image restart
evidence, not a published-release upgrade, real-model quality test or proof of
remote GPU cancellation.

Before local replacement, a database archive was saved to
`data/backups/gateway-provider-context-before-20261014.dump`. Its index has 1,933
readable lines; SHA-256:
`BAF9F54ADBB63B0956BFF728B374937551E35BA581FBEF52D00BDDBD134DFE63`.
The private backup remains local and was not restore-tested.

Compose replacement completed with the exact candidate image. Docker reported
healthy, zero restarts and no OOM kill. The 2 GiB memory limit, 1,536 MiB V8 heap,
read-only root, user `1000:1000` and `no-new-privileges` remain. An initial memory
sample was 747.8 MiB, not a load benchmark. No gateway activation environment
variables were present. The unrelated Harmoniarr container was not changed.
The local `/health` endpoint returned HTTP 200. Evaluation consent retained
`when_idle`, zero daily calls/tokens and reserved calls, and revision 2. The
application database has no gateway schema and no gateway CLI process is running.

Rollback image remains preserved:
`sha256:c767f6d374c33af3944c9af366af880bf92f1c91fa6b4cce67580c7ec51daf53`,
tagged `classifarr-local-rollback:062c80266440539bdf09626b28a5eeb1b3fbca23faf7993651eb2fe1ae579d05`.
No image pruning or user-data deletion occurred.

GitHub MCP enumeration found no open Classifarr PRs, so none could be randomly
selected or implemented. None was merged. No Unraid or shared Ollama settings,
services or production data were changed, and no live inference was invoked by
this test work.

## Next item

Connect all application call sites to a lifecycle owner using this context:
classification and rule suggestions, the embedding provider/router, health and
settings probes, verification, study clients and warming. Use explicit scoped
credentials for each workload class; replace/close contexts when configuration
changes. Prove that failures cannot bypass the gateway and unsupported model
administration fails clearly before adding any activation setting. Cross-host
TLS/network enforcement and evidence-based recovery of uncertain remote work
remain separate prerequisites to production coordination.
