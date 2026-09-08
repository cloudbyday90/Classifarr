# Backend Test Runner Memory Outcome

Status: implemented locally on 2026-09-08; unreleased.

## Incident

Before the fix, `npm test` reproduced an out-of-memory failure in the server
unit phase after about 379 seconds. The process reported ineffective mark-
compacts near the heap limit and exited with code 134. The full client suite
still passed afterward: 344 files and 4,818 tests.

## Delivered change

`server/package.json` now makes the full `test` command use two Jest workers
with a 512 MB idle-worker recycling limit for the unit phase. Its PostgreSQL
integration phase remains `--runInBand`. This matches the existing bounded
`test:unit` configuration and leaves all application code unchanged.

## Verification

The revised server suite completed without raising Node's global heap limit:

- unit phase: 1,121 suites and 32,115 tests passed in 115.537 seconds;
- serial PostgreSQL integration phase: 132 of 133 suites and 1,580 of 1,581
  tests passed, with one intentional skip, in 353.581 seconds; and
- the final full client suite passed: 344 files and 4,819 tests.

The same run initially exposed three stale PostgreSQL test fixtures. They did
not model the source-identity guard's columns/table or the current
configuration primary key. The fixtures now mirror the production contract,
and the full server verification above includes those repairs. A subsequent
no-cache Compose build validates that this test-only script change does not
affect the production image.

## Next item

Keep the memory bound under normal CI observation. If the bounded runner again
recycles workers excessively or fails, collect a scoped heap profile and locate
the retaining suite before changing Node memory limits or relaxing test
isolation.
