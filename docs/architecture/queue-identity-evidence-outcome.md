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
- Full client coverage: 470 suites, 7,250 tests passed; statements 87.65%,
  branches 81.59%, functions 87.31%, lines 89.36%.
- Full backend coverage: 1,827 suites passed; 57,685 tests passed. The existing
  Linux-only directory-fsync test was skipped on this Windows host (one skip).
  Statements/lines 89.76%, branches 86.30%, functions 91.18%.
  The combined coverage ratchet passed using these current reports; its baseline
  was not changed.
- Root lint, 2,184 Markdown documents, CI preflight (copyright, unchanged
  ownership gate and dependency checks), static imports and ESM mock-shape checks
  passed. No baseline was refreshed. The ownership gate is not a claim that all
  historical writer paths have completed privilege isolation.
- Policy production naming, product language, delivery terminology and runtime
  maintenance gates also passed. No release workflow was invoked.

Synthetic candidate evidence does not identify a real replacement for Endgame
Encore, establish edition equivalence, or prove a production backfill occurred.

## No-cache local image evaluation

The clean implementation commit was `fa2a6925d546cc61a86be9734e8619b8c06b4f6a`.
The build used the existing local Compose override and
`build --no-cache --require-provenance --protect-running-image classifarr`.
No version bump, tag or release was created.

- Local immutable image: `sha256:7fc9f46bb0c44fba01c086f3db10d5af7202a8ad64d06e3ff930b1eb57688cd5`.
- Platform config: `sha256:ed92a4cb35a99b189c2f9975f86cedb7f3a85cab2f8497256cd6f5b94422789f`.
- A network-disabled, non-root, read-only disposable container loaded the packaged
  service and asserted a synthetic TV evidence chain used exactly five provider
  reads, preserved the task and included the new UI code. Its providers and DB
  were synthetic; this proves packaging, not a real provider match or HTTP route.
  The real HTTP and PostgreSQL contracts were tested separately above.
- Protected Compose replacement used that exact image. Container
  `da4259f18d903655a61093745ce718ab99813885eedc1468b263b44b4340cd44`
  was healthy at 19:51 UTC, with zero restarts and no OOM kill. `/health` returned
  200; an unauthenticated metadata-check POST returned 401. UID/GID `1000:1000`,
  read-only root, `no-new-privileges` and the 2 GiB limit remain unchanged.
- Initial container memory was 434.7 MiB. This is a startup observation, not a
  complete-cycle memory profile or a claim about retained memory.
- There were zero local failed tasks before and after replacement. No synthetic
  failure was inserted into the live local database; no real-item repair is claimed.

The prior running image is retained by
`classifarr-local-rollback:642051ce12b26067af28166f30b95fdbe499108899ec138e160e62d8f392ec3c`,
pointing to `sha256:5ded1881fdb79e2bcb2db8c639bae59f401b99b76806186b0c84fbf4c96fae32`.
A fresh 76,261,549-byte custom PostgreSQL archive is stored in ignored
`data/backups/identity-evidence-before-20261013.dump` and its `.tmp/` copy.
SHA-256: `d333d1570af4c81f79790e87b6b648fe7d666b96afb58b461ac0338ea93a2481`.
Its table of contents was readable (1,917 lines); this was not a full restore drill.
The final evidence update changes documentation only, not the built runtime.

## PR selection and next recommendation

The repository had zero open PRs at the start, during implementation and again
before push. No closed PR was represented as open, and no PR was merged or closed.

The preceding [CI run 38454563188](https://github.com/cloudbyday90/Classifarr/actions/runs/38454563188)
finished successfully for `5d4ac318b0bc19a3303a63f5effe2d1c86a3f478`, including
the previously problematic shutdown and queue-recovery checks. That run validates
the preceding diagnostic change, not this newer identity-evidence implementation.

Next, implement a durable, administrator-reviewed replacement preview and receipt
using the evidence contract. Bind it to the original request, exact task/source
revisions and typed old/new identities; require explicit work/edition confirmation.
Revalidate on confirmation, consume once, preserve history and retry budgets, and
keep the subsequent routing-capable retry separate. Unknown or incomplete evidence
must remain unresolved, not become automatic title-based substitution.
