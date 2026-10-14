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

Focused observer/configuration tests: 2 suites, 124 tests passed. Existing isolated
gateway/application routing integration: 4 suites, 112 tests passed. Type checking,
dependency checks, ESM gates, migration naming/schema integrity, inventory ownership
and documentation checks passed. The inventory gate still reports historical
unresolved ownership paths; it does not certify whole-repository compatibility.

The first lint pass caught a test executor return; it was corrected. A bounded
timestamp regex was split to remove a static unsafe-regex warning. Focused tests
were rerun after both corrections. Full-suite and image results will be recorded
after completion, not assumed from these targeted checks.

GitHub MCP enumeration on 2026-10-14 returned zero open PRs. No PR could be randomly
selected or locally applied; none was merged or invented.

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
