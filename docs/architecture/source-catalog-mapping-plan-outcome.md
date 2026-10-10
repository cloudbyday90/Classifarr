# Library-agnostic mapping-plan outcome

## Delivered

An offline ESM validator and existing-CLI mode now review explicit proposals for
whole movies/TV series or source-season to TMDb-series/season relationships.
There are no library names, genres, destinations or Plex-specific ID rules in
the contract. The operator's source grouping stays intact. Library membership
is still a future access/freshness check, not identity authority.

All results say `canApply: false` and `verification: structure_only`. The command
does not connect to the database, call a provider, persist a proposal, change
recovery state, or route media. Valid drafts are not verified identities. Real
mapping activation remains deferred until fresh source-layout evidence, typed
catalog verification, authenticated review and scope-aware consumers exist.

The reusable service is under 100 lines; stdin handling is a separate small
module that reuses the existing bounded JSON reader. Plans reject unknown keys,
unsupported scopes, duplicate source/target edges, invalid typed IDs, mismatched
coverage and excessive input. Season zero is explicit. Array order does not
change the canonical fingerprint; changes to source/evidence/scope do. The
fingerprint is not an authorization token. Output contains aggregates, not IDs
or submitted text. No schema, runtime, dependency or policy baseline changed.

The [design, examples and tradeoffs](source-catalog-mapping-plan-design.md)
document the cross-component work required. This is a mapping-contract foundation,
not a completed operator-facing mapping feature.

## Unresolved items

A fresh bounded read-only cross-reference run on 2026-10-10 still found eleven
local items: ten with agreement plus missing catalog mappings and one with no
typed match. It completed 31 lookups: IMDb 10 matched/1 not found and TVDB
9 matched/11 not found. These are catalog lookup counts, not additional items.
The earlier private per-item investigation established artwork/descriptions on
all eleven, real alternate catalog records for eight extra TVDB IDs, and two
multi-TMDb groupings. Neither metadata presence nor a missing cross-link resolves
the scope question.

No actual mapping was selected or applied to these items. The former twelfth
item recovered in the earlier exact-alias round. Unraid's last verified count was
twelve at 09:20:27 Eastern on 10 October; this round did not independently re-query
its catalog evidence or modify production. Shared Plex and Ollama were untouched.

## Independent PR trial

Randomly selected open [#556](https://github.com/cloudbyday90/Classifarr/pull/556),
head `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`, was applied locally:
server Node declarations 24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0.
The exact patch matched registry integrity metadata and introduced no install
scripts. Scripts-disabled and reviewed installs passed, `npm ls --all` passed,
and the full server npm audit reported zero advisories, including development
dependencies, on 10 October.

The trial failed server typechecking in `discordDeliveryWriter.mjs`: Discord's
Undici `BodyInit`/`FormData` declarations were incompatible with the Node 26
declarations. The runtime-major gate also failed (39/40 tooling tests passed).
After reverting the exact trial and reinstalling Node 24 declarations, server
typechecking and all 40 tooling tests passed. This is a demonstrated regression,
not merely an outdated-package warning. No PR was merged; no trial dependency
changes remain. Express 5.3.0 and Knip 6.41.0 are separate future update batches.

## Verification

The new tests first failed because the new module did not exist. The initial
combined run then exposed two incorrectly parameterized test rows; correcting
the test table produced six passing suites and 129 tests. These exercise the
new contract/input boundary and existing replay/cross-reference behavior.

Real subprocess tests use unusable database configuration and verify successful
offline review, nonzero invalid-input exits and no private-input echo. Stream
tests cover stalled input, invalid UTF-8/JSON, chunked byte limits and exact
32 KiB acceptance. Contract tests cover both media types, opaque source IDs,
specials, partial scope, duplicate edges, canonical fingerprints, 256-season and
64-work boundaries, unknown keys and attempted actor/library authority.

Final quality gates and exact-image evaluation are recorded after completion.
No production recovery or release-readiness claim is implied.

## Next recommendation

Build an adapter-neutral source-layout snapshot and read-only catalog preview.
It must establish episode/season boundaries, order and source/configuration
revisions before asking an administrator to approve a mapping. Do not activate
many-to-many links through existing scalar consumers or count a season mapping
as possession of a whole series. Prefer explicit scope with review over silently
discarding inconvenient IDs; the cost is additional implementation, the benefit
is preserving both organization and correct classification.
