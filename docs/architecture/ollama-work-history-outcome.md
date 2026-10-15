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
Focused backend verification passed 14 suites / 352 tests. The first invocation
missed the local OpenSSL path; rerunning with the existing pinned executable
resolved the fixture setup failure. The full backend coverage run passed 59,145
tests and failed only the ownership gate run before its reviewed digest update
(one skipped). The reviewed gate and focused rerun passed. The final full backend
rerun (`--no-coverage --maxWorkers=2 --workerIdleMemoryLimit=512MB`) passed all
1,854 suites / 59,146 tests, with one skipped, against the final runtime source.

Coverage ratchet passed without baseline changes. Current server statement/line
coverage is 89.58%, branch 86.41%, function 91.09%; client statement 87.79%, branch
81.84%, function 87.50%, line 89.47%. These are repository-wide coverage figures,
not a claim that every new branch is covered by the unit suite; the real database
contracts are additionally exercised by the integration and packaged rehearsals.

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

## Packaged image evaluation

No-cache Docker Compose build passed with clean-source provenance and running-image
protection. Candidate source: `3997cd4bcc077b95e40f27bd73f5e34315b25faa`.
Immutable image: `sha256:4c1ac8d1a5d975c7d1ebe97d0192d6712d079f2ae5b6e0266676c4c01d4affbb`.
The protected prior local image was
`sha256:d5ed7fcb8f85dfa3d06f80c81c109386baafff0c46ea8a7490290b0ef76fd64b`
(source `433d19efc33536b92326485cb40f0557dced3e18`). No release image was published.

The packaged gateway rehearsal passed against that immutable image, using the
normal application entrypoint, isolated PostgreSQL, no external network or ports,
and bounded memory/CPU/PIDs. Its restricted runtime read eight completed requests
for local task 7001 and the uncertain interrupted task 7002 after SIGKILL/restart.
The other installation's credential saw none of those records. Reads left the
ledger and provider call count unchanged. Existing TLS identity, credential
rotation/revocation, completion recovery, offline recovery and provider-stop
fixtures passed. The main fixture made 19 synthetic calls, the completion fixture
four, and the TLS identity fixture two; history/recovery made no provider calls.
The exact disposable container and data directory were removed and verified absent.
The rehearsal was repeated after narrowing the setup grant to the five required
recovery columns. It again passed and explicitly proved the runtime cannot read
`operator_ref` or `evidence_ref`; cleanup was verified again.

The separate-container network rehearsal passed with one synthetic inference,
verified private-CA TLS, direct-provider access blocked and the declared
container/start binding retained. Its three containers, two internal networks and
temporary data were removed with cleanup verified. No shared provider was used.

Local Compose replacement passed with `--no-build --no-deps --pull never
--force-recreate --wait --protect-running-image`. Running image/source matched
the candidate, health was good, restart count zero and OOM false. HTTP `/health`
and `/` returned 200; unauthenticated history returned 401. UID/GID 1000:1000,
read-only root, no-new-privileges, 2 GiB limit and existing data/media mounts were
retained, with no Docker socket or gateway environment configuration. The app DB
still has no gateway schema. Evaluation settings remained `when_idle`, zero daily
calls/tokens/reservations and revision 2, including the unchanged next-check time.
The unrelated Harmoniarr container was untouched. A settled short sample was
634.5 MiB / 2 GiB and 1.18% CPU; this is not a peak-load performance guarantee.

Browser verification of the rebuilt Settings → AI page confirmed the history
panel, explicit Load latest action and correct gateway-not-configured result.
No provider settings were saved or gateway enabled. Populated/history/error states
were exercised by component and real gateway tests, not production data. The
later documentation/test-fixture commit does not change the packaged runtime source.

## Limits and next step

This is request history, not proof that a queue task succeeded, provider work
stopped, or an installation owns work outside the gateway. No prompts, answers,
fingerprints, credentials or recovery evidence are exposed. A database error
still follows the ledger's existing fail-closed policy. Already executing bounded
reads may finish after a caller disconnects. Pages are not a frozen snapshot.
Pre-admission refusals and read-only provider inspection are not bound compute
work and do not appear in this history.

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
