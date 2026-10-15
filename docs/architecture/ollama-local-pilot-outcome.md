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
unavailable, replaced) and cleanup, with exactly two synthetic compute attempts.
It used the previous local image before rebuilding. Three host command contract
tests passed. Final restricted-role, ledger snapshot and no-cache image verification
is still pending and will be recorded separately. No live provider pilot is claimed.

## Limits and next step

Synthetic warming and history validate the integration boundary, not GPU/model
performance or a real classification task. Same-image container replacement is
not a version upgrade. Retention/archiving and separately approved real-provider
capacity/network review are next; neither shared Ollama nor Unraid is changed.

The current GitHub MCP open-PR query returned zero results. No closed or merged PR
was substituted for the requested random open PR.
