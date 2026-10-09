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

The separately hosted provider has not been restarted, upgraded or reconfigured.
Its deployment management and whether other applications share it require
confirmation. No model deletion, guard-alias selection, model switch, AI call,
budget activation, quota reset or Unraid change was performed. The five-call
trial is still blocked; a Classifarr rebuild alone cannot repair that server.

## Verification

- Backend: 5 suites, 99 unit/real-HTTP tests passed, no skips. New regression
  checks cover conditional recovery wording and both orders of the legacy/
  converted model listing; no `/api/show`, generation or reservation occurs
  for either duplicate ordering.
- Dependency/tooling policy: 40/40 passed after removing the random PR trial.
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

## Next item

Confirm the provider's deployment scope and update it to Ollama 0.40.2 through
that deployment's normal mechanism. Recheck metadata and policy/vector readiness,
then perform the bounded five-call trial and disable its recurring budget.
Do not infer evaluation success from provider version or metadata readiness.

The recovery skill kept diagnosis and safe remediation separate from an
unauthorized shared-server restart. The dependency skill prevented retaining a
Node-major mismatch merely to complete a PR trial.
