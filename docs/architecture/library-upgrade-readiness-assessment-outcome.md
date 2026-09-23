# Installation-specific library upgrade assessment — outcome

## Delivered

An admin-only `GET /api/libraries/upgrade-readiness` returns all-library
counts without media or provider payloads. The Command Center combines it
with the existing bounded detail report, displays source-capture coverage,
and does not claim that a partial assessment is complete. It counts conflicting
and invalid provider IDs and unsupported media types separately. No database schema,
routing policy, background worker, release, or live container was changed.

The API is read-only and no-store. The client validates count consistency and
keeps the aggregate in memory only while mounted. A missing or invalid
aggregate falls back to the existing bounded view.

## Verification and boundary

Focused backend unit and PostgreSQL integration tests cover aggregate
projection, authorization, query rejection, empty and mixed movie/TV
inventories, a current-generation source conflict, and non-disclosure of its
title. Focused client tests cover the API leaf, contract validation, visible
loading, and compact accessible presentation. The full backend run passed
1,394 unit suites (40,862 tests) and 149 PostgreSQL integration suites
(1,716 tests; one suite and one test skipped). The production client build,
server/client lint and typechecks, Markdown lint, copyright, dependency and
ESM checks passed. The complete client run passed 375 files (5,206 tests);
focused tests passed again after the final contract-hardening edit. Fresh
server and client coverage runs passed the repository coverage ratchet with
no regression.

This assessment measures existing installation state but does **not** copy or
modify it. Source conflicts are only counted in recent complete full captures;
uncovered active libraries are reported explicitly.

The [GitHub open-PR search](https://github.com/cloudbyday90/Classifarr/pulls)
returned no open pull requests on 2026-09-23, so no PR was selected or merged.

## Next item

Use these count-only observations to define a controlled, self-healing
release-readiness gate: reconcile why a library remains unverified or waiting
after its expected worker interval, expose a bounded reason code, and retry
only when the existing durable recovery policy permits it. Keep operator
intervention reserved for genuinely unrecoverable source-identity conflicts.
