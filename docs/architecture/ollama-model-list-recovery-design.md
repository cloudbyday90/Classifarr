# Ollama model-list recovery design

Date: 2026-10-09. Scope: local provider diagnosis and actionable Classifarr
guidance, not an unattended upgrade of a shared inference server.

## Evidence and official research

The configured provider reports Ollama 0.40.1. Its metadata lists the same
generation model twice with different digests and `ggml` / `llamacpp` runners.
This matches Ollama's documented model conversion: legacy and converted copies
are retained for downgrade support. It is not evidence of two Classifarr writers
or a proxy. The earlier proxy hypothesis is not supported by this finding.

Official sources discovered and opened on 2026-10-09:

- [Ollama fix 18874](https://github.com/ollama/ollama/pull/18874)
  explains the duplicate listing and downgrade guard aliases.
- [The implementation](https://github.com/ollama/ollama/pull/18874/files)
  changes `/api/tags` to list only the locally selected child manifest and hide
  the downgrade guard alias. Selection belongs to the provider, not Classifarr.
- [Ollama 0.40.2](https://github.com/ollama/ollama/releases/tag/v0.40.2), published
  October 8, includes this fix. Keeping backup models is separate from listing
  them; deleting model backups is not required for this remedy.

## Decision and boundaries

Keep the strict one-model/digest contract. Improve the existing `model_ambiguous`
action with conditional advice for Ollama 0.40.1 and a verified operator runbook.
Do not claim every duplicate has this cause or add a version request to ordinary
status reads. No new module, scheduler, schema, response field or singleton is
needed for a fixed-text correction.

The diagnostic retains its read-only transaction before HTTP, 15-second overall
deadline, 1 MiB response bound, explicit cancellation, and zero generation or
permission changes. Unknown failures keep their sanitized GitHub-issue guidance.
Duplicates remain blocked regardless of runner, response order or digest equality.
There is no retry write, new cooldown, lease or durable state to migrate.

Provider restart/update needs confirmation of deployment ownership and consumers.
A Classifarr image rebuild does not update a separately hosted Ollama service.
Do not change generation models, select an internal `llamacpp:<digest>` guard
alias, delete models, install an alternate server or affect Unraid to get a pass.

## Options and recommendation stack

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Update provider to 0.40.2, then inspect — recommended | Uses upstream model selection; preserves Classifarr checks | Requires a planned provider restart and validation of all consumers |
| Deliberately choose a different installed local model | Can avoid the affected model | Changes classification behavior and invalidates model-bound evidence |
| Pick first duplicate or prefer a runner in Classifarr | Appears to unblock immediately | Guesses identity; diverges from provider routing; rejected |
| Delete old copies or use downgrade guard aliases | May change the listing | Alters rollback assets or depends on implementation details; unnecessary |

Order: confirm provider scope → upgrade provider with its existing deployment
method → verify one local identity and capabilities → check inventory/vector and
policy readiness → permit at most five trial calls with unchanged safeguards →
disable the recurring budget and verify capture publication and replay separately.
Restart alone, a ready metadata report, or cached responses alone do not prove
evaluation complete. If blocked, retain evidence rather than resetting budgets.

For the independent random PR trial, reuse the
[Node 24 declaration alignment design](node-types-pr-556-design.md): apply the
exact PR locally, test the unchanged gate, and remove only the rejected trial.
