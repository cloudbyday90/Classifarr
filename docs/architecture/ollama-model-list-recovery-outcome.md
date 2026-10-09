# Ollama model-list recovery outcome

Date: 2026-10-09. See the separate
[design, official sources and tradeoffs](ollama-model-list-recovery-design.md).

## Root cause and limits

Read-only probes of the configured local provider returned version `0.40.1` and
two entries for the configured generation model: different valid digests, one
`ggml` runner and one `llamacpp` runner, plus a llama.cpp downgrade guard alias.
The official Ollama 0.40.2 release and fix 18874 explain and correct this exact
listing pattern. This establishes a concrete upstream cause for the local
preflight refusal, not an import-ownership problem or a reason to weaken memory
admission. It does not diagnose the separate Unraid installation.

Updated Classifarr's existing fixed recovery text and operator runbook to name
the conditional upstream remedy. The diagnostic does not make a new version
request or claim all duplicate listings have this cause. No new service or
database schema was needed. All JavaScript changes remain ESM.

The provider is the native Ollama app on this Windows host: its configured IP is
a local interface, the app/server processes are running, and the CLI also reports
0.40.1. It has not been restarted, upgraded or reconfigured. Whether other
applications share it and authorization to interrupt it require confirmation.
No model deletion, guard-alias selection, model switch, AI call,
budget activation, quota reset or Unraid change was performed. The five-call
trial is still blocked; a Classifarr rebuild alone cannot repair that server.

## Verification

- Backend: 5 suites, 99 unit/real-HTTP tests passed, no skips. New regression
  checks cover conditional recovery wording and both orders of the legacy/
  converted model listing; no `/api/show`, generation or reservation occurs
  for either duplicate ordering.
- Dependency/tooling policy: 40/40 passed after removing the random PR trial.
- Isolated PostgreSQL quota/cache suites: 2 suites, 11 tests passed, no skips.
  The actual read-only transaction leaves quota/progress and cache rows unchanged.
- Random open [PR 556](node-types-pr-556-outcome.md), freshly selected from
  555/556: exact local diff rejected by the unchanged Node 24 alignment gate
  (8/8 baseline → 7/8 candidate → 8/8 restored). No install or merge.
- Reviewed the complete diagnostic module and its diff: only fixed recovery
  text changed, not queries, transport, admission or returned fields. Updated
  only its ownership-review hash, retaining its read-only classification and
  all unrelated unresolved writer debt.
- Backend lint/typecheck, all 2,037 Markdown files, copyright and ESM static-import/
  mock-shape checks passed. Ownership drift gate passed after that narrow review;
  its existing `productionCompatible: false` limitation still applies to unrelated
  unresolved writers. No SQL, client API or schema contract changed; a fresh full
  application coverage run is not claimed for this fixed-text change.

## Local no-cache rebuild

Built clean code commit `8ab4a7071994d5b1208b7811edcb08ef1803e810` with
`docker-compose-smart.mjs ... build --no-cache --require-provenance`, then
recreated only the local `classifarr` service with `--no-build --force-recreate
--wait`. Image ID:
`sha256:1a5cd1894ea508be70d278161bf028aa26e14de116e4055ed69711bd2041ce27`.
The OCI revision matches the code commit. Follow-up documentation is not a
runtime image change.

The container started at 20:14:34 UTC and became healthy, with zero restarts and
no OOM, UID/GID 1000, a read-only root and the unchanged 2 GiB limit. Health
returned 200; unauthenticated evaluation history returned 401. At 20:15 UTC the
packaged diagnostic returned `model_ambiguous` and the new conditional remedy
(expected exit 1). Budget status remained disabled with zero limits and zero
reservations. A startup memory sample of 612 MiB is not a retention/leak study.
The Windows provider, Unraid and the unrelated Harmoniarr container were untouched.

After recreation, `check-schema-snapshot-container.mjs --dump` passed against
that image with a fresh disposable database. There was no tracked schema diff.
The runner removed its exact temporary container and appdata directory; both
removals were verified. Existing application data was not used for the dump.

## Next item

Confirm the provider's deployment scope and update it to Ollama 0.40.2 through
that deployment's normal mechanism. Recheck metadata and policy/vector readiness,
then perform the bounded five-call trial and disable its recurring budget.
Do not infer evaluation success from provider version or metadata readiness.

The recovery skill kept diagnosis and safe remediation separate from an
unauthorized shared-server restart. The dependency skill prevented retaining a
Node-major mismatch merely to complete a PR trial.
