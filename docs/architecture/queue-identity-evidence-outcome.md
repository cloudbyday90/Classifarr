# Failed-task identity evidence outcome

## Implementation — 13 October 2026

Command Center's explicit saved-ID check now checks retained IMDb/TVDB declarations
after a current TMDb 404. Small ESM modules separate database reads, source
validation, provider transport and evidence decisions. Movie and series identities
remain separate, and the workflow does not depend on library names or media servers.

A candidate appears only after all supported saved IDs resolve uniquely to the
same typed record and that record's own IDs confirm them. Gaps, ambiguity, invalid
responses and conflicts produce specific guidance. Provider failures remain
separate from the original missing-record observation. Technical details stay in
the support disclosure; no provider body, credential or raw error is returned.

This implements the evidence layer in the [design](queue-identity-evidence-design.md),
not identity-changing self-healing. The existing bounded same-ID recovery is
unchanged. No task, webhook, intake, library, attempt budget or recovery ledger is
written by this check. Nothing runs from rendering, polling, hovering or fresh install.
No migration, dependency update, release, live Encore mapping or Unraid change is
part of this work. Shared Ollama and Plex were not touched.

## Verification

- Focused backend: 8 suites, 186 tests passed, including route authorization,
  same-ID recovery regressions and real HTTP external-ID/reverse lookup transport.
- Isolated PostgreSQL: 2 suites, 27 tests passed. Whole task/source rows remain
  unchanged; actual row revisions reject a changed or deleted linked request.
  The local Testcontainers host override was `127.0.0.1`, not a runtime change.
- Focused client: 2 suites, 50 tests passed. No render-time request, no implicit
  retry/approval, escaped provider titles, accessible messages and cancellation.
- Full server/client type checks passed.
- Broader coverage, quality gates and the no-cache local image evaluation are in
  progress; this document will record their actual results before handoff.

Synthetic candidate evidence does not identify a real replacement for Endgame
Encore, establish edition equivalence, or prove a production backfill occurred.

## PR selection and next recommendation

The repository had zero open PRs when checked. No closed PR was represented as
open, and no PR was merged or closed.

Next, implement a durable, administrator-reviewed replacement preview and receipt
using the evidence contract. Bind it to the original request, exact task/source
revisions and typed old/new identities; require explicit work/edition confirmation.
Revalidate on confirmation, consume once, preserve history and retry budgets, and
keep the subsequent routing-capable retry separate. Unknown or incomplete evidence
must remain unresolved, not become automatic title-based substitution.
