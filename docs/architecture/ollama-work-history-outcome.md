# Gateway work history outcome

Implementation, 2026-10-15. Unreleased; main branch, no release or PR merge.
See the separate [design and recommendations](ollama-work-history-design.md)
and [operator guide](../operations/ollama-work-history.md).

## Delivered

AI settings now contains a manually loaded, administrator-only history panel with
task filtering and older-page navigation. The authenticated gateway credential
selects the installation. Other installations' requests are excluded even when
their queue task IDs match. Direct Ollama work is outside this history.

New append-only, time-based UUIDv7 completion receipts distinguish validated
provider completion, known rejection and cancellation before dispatch. The
receipt and existing fenced completion update commit atomically. Failed writes
retain uncertainty and attempts. Legacy outcomes are not guessed or backfilled.
Reviewed abandonment is labeled separately from completion.

The implementation uses focused ESM query, completion, contract, service and
route modules, the named client API layer, and a separate Vue component. It adds
no dependencies, provider calls, automatic retries, polling or recovery controls.
The standalone v7 migration is explicit and is not an application migration.

## Verification

Gateway/routing integration: 9 suites, 212 tests passed using real HTTP and
isolated PostgreSQL, including owner/provider fences, in-flight closure and
credential revocation. The revocation test initially expected 503; the actual
correct response was 401 with no rows. Its assertion was corrected and the entire
integration selection rerun. No live gateway schema or provider was changed.

Frontend coverage: 476 files / 7,369 tests passed. Type checks, test/security/client
lint, development/production dependency analysis, static imports, ESM mock shapes,
migration checks, reviewed ownership, copyright and Markdown checks passed.
Backend full-suite/coverage and immutable-image evaluation follow below once complete.

The changed ownership review entry is limited to `ollamaGateway/ledger.mjs`.
Review traced its existing single-session advisory owner, v7/provider/request
fences, extracted atomic completion SQL, and the new SELECT-only history query.
There is no application inventory mutation. The indirect-query analysis remains
unchanged; only the reviewed source digest changes. The application transport
boundary test explicitly allows the new contract's operation-label validation;
that module performs no HTTP. No coverage baseline was relaxed.

Before local replacement, created
`data/backups/gateway-work-history-before-20261015.dump`, SHA-256
`7F9474C2FCEE9E4708CDE1DE3617D0BDCF165C70E522D8921173DCBE9E6A598A`.
`pg_restore --list` succeeded (1,933 lines); this was not a restore rehearsal.

## Limits and next step

This is request history, not proof that a queue task succeeded, provider work
stopped, or an installation owns work outside the gateway. No prompts, answers,
fingerprints, credentials or recovery evidence are exposed. A database error
still follows the ledger's existing fail-closed policy. Already executing bounded
reads may finish after a caller disconnects. Pages are not a frozen snapshot.

History remains bounded by the existing 100,000-binding admission cap. Reviewed
retention/archiving is still required before unattended use. A real gateway must
be explicitly backed up, stopped and upgraded to v7 with the documented grants.
The normal local installation remains in direct mode; Unraid and shared Ollama
remain unchanged. Synthetic rehearsals do not establish real GPU performance or
upgrade compatibility with a published image.

Next recommendation: plan a reviewed **local-only gateway routing pilot**, with
bounded workload, rollback that preserves the ledger, and observation through
this history view. Do not enable the shared provider or production installation
without separate approval and reviewed network/uncertainty controls.

The current open-PR query returned zero results, so there was no eligible random
PR to implement. No closed or merged PR was substituted.
