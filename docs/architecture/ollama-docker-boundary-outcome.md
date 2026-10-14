# Docker provider boundary assessment outcome

Date: 2026-10-14. This change implements the read-only first stage of the
[dedicated Docker supervisor design](ollama-docker-boundary-design.md), not an
automatic recovery supervisor. The user selected a dedicated Docker provider.

## Implemented

- Modular ESM configuration, bounded local Docker reader, sanitized projection,
  observer and private-file CLI; no dependency or schema changes.
- Immutable daemon/container/image/start pins, two observations, fixed concerns,
  cancellation and size/time limits. Every result denies recovery authority.
- No application startup wiring, Docker socket mount, provider calls, lifecycle
  writes or automatic activation. Existing offline recovery is unchanged.
- Real local-socket regression tests and an exact-owned Docker rehearsal, including
  packaged CLI testing against a synthetic Unix socket without daemon privileges.
- Operator documentation, official-source rationale, alternatives and Unreleased
  changelog. No version bump, merge or release.

## Verification before image build

Focused observer/configuration tests: 2 suites, 129 tests passed. Existing isolated
gateway/application routing integration: 4 suites, 112 tests passed. Type checking,
dependency checks, ESM gates, migration naming/schema integrity, inventory ownership
and documentation checks passed. The inventory gate still reports historical
unresolved ownership paths; it does not certify whole-repository compatibility.

The first lint pass caught a test executor return; it was corrected. A bounded
timestamp regex was split to remove a static unsafe-regex warning. Review also
caught JavaScript end-anchor acceptance of a trailing newline; all pin fields now
explicitly reject CR/LF. Focused tests, lint and type checking were rerun after
the final correction.

Full backend run: **1,847 suites passed; 58,688 tests passed; one existing skip**,
406.238 seconds. The final five line-break regression cases were subsequently
included in the 129-test focused rerun. No client source changed; the image build
compiled the frontend. Markdown checked 2,223 documents without errors before
these final evidence additions. No ownership/security baseline was refreshed.

GitHub MCP enumeration on 2026-10-14 returned zero open PRs. No PR could be randomly
selected or locally applied; none was merged or invented.

## Image and local runtime evidence

Final source: `03612be88a0e9948c02a78661f56998da37af228` on `main`.
The earlier preliminary build was superseded after the line-break correction;
it was not used for the final rehearsals or local replacement.

Final image built without cache from the clean corrected checkout:
`sha256:401dc1b733e81361b4905eda86baa5cc9271a3cb77a1e26930a5e6a71fdeefe6`.
Its OCI source label matched that commit. The final documentation-only commit
records the results and does not change packaged runtime code.

Packaged and real Docker evidence against that image:

- New boundary runner: packaged private-file CLI made exactly five GETs against
  a synthetic Unix socket, rejected a `resume` command and returned no recovery
  authority. Host observer used Docker Desktop's local named pipe to observe an
  owned Linux container running, stopped and restarted; the old start pin was
  refused after restart. Zero provider calls. No real Docker socket was mounted.
- Existing gateway rehearsal: 19 synthetic calls across routing, credentials,
  streaming, UUIDv7 and interrupted-work checks. Completion recovery used four
  additional synthetic calls, five preserved attempts and real elapsed cooldown.
  Offline recovery used zero provider calls, retained all five attempts, enforced
  restricted roles, maintenance across restart and separately reviewed resume.
- Existing two-network rehearsal: one synthetic compute call through verified
  TLS and a refused direct-provider connection. This uses the packaged startup
  function with injected admission/runtime, not two full production installations.

Exact owned cleanup was verified for boundary fixture
`cf-docker-boundary-623695ef-f0b9-4de4-b292-ac02d31b09e1`, gateway fixture
`classifarr-schema-check-b9a04216-b2fc-45f3-9dd2-18d77a1f4312`, and network fixture
`8ef63f38-d611-4fe1-8768-3570d8827ad7`. No Docker pruning or shared-service changes.

Local Compose replacement used `--no-build --no-deps --pull never --force-recreate
--wait --protect-running-image`. Result: healthy, `/health` HTTP 200, zero restarts,
no OOM flag, user 1000:1000, read-only root, no-new-privileges and 2 GiB limit.
No gateway/routing settings or Docker socket mounts were present. Initial sample:
773.3 MiB and 120.94% CPU during startup; this is not a capacity/performance study.
Later spot check: 966.1 MiB and 0.56% CPU, still healthy with zero restarts/no OOM.

Saved budget before/after was unchanged:
`when_idle|0|0|0|2|2026-10-09 16:50:11.617278-04`.
The application database still has no standalone `ollama_gateway` schema.

Retained rollback image:
`classifarr-local-rollback:78d76bbc297bb8f7c9f875044268869310fcb21de83feb0549c35ab7c919c8c3`
points to `sha256:e9f88eb0bcc9cce7511d532100384880c4513ae73bca0a278821d952d0b37cb2`.
Pre-replacement backup: `data/backups/gateway-boundary-before-20261014.dump`, SHA-256
`5F059F60B84105343DCF2AD729CA2DFFF46DB12C5F2CF4A582D5064B82097554`.
Its 1,933-line archive listing was readable; a restore was not rehearsed here.

## Scope and next recommendation

Unraid and shared Ollama are unchanged. No automatic recovery was enabled. A
Docker observation cannot prove which historical request ran in that container,
that all provider work stayed inside it, or that another controller cannot restart
it. The recovery-change skill kept that distinction explicit and required bounded
failure tests and separate design/outcome evidence.

Recommended next: persist a provider instance/epoch on each admitted dispatch,
then implement exclusive lifecycle and ingress ownership for a dedicated local
provider. Only after those contracts are tested should a supervisor be able to
authorize recovery. Keep human-reviewed recovery for existing unbound requests.
