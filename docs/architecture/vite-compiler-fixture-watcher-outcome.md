# Vue compiler fixture watcher outcome

November 21, 2026 Eastern. Implemented the
[approved watcher design](vite-compiler-fixture-watcher-design.md) on main.

The compiler helper and Vite configuration now use the same absolute
fixture prefix. The watcher filters paths relative to the client scratch
root. Compiler projects keep their existing location, installed module
resolution, exact diagnostic assertions and per-project cleanup. The
change uses the existing Vite watcher controls.

The new regression failed on the previous configuration because Vite
watched the generated directory. It passes with the narrow rule. The
test adds an external synthetic config with the same fixture directory
name to its own watcher. It confirms that Vite still sends a full reload
for that watched config. The control cannot reload another server that
watches the client tree.

In a real Chromium session, creating, editing and removing a generated
`tsconfig.json` preserved the same document, synthetic draft and focus.
Creating the separate watched config reloaded the fixture and cleared the
draft as expected. All 19 shared-form and pgvector checks passed with
client coverage running. The five existing Vite file-serving boundary
checks also passed. [Vite watcher guidance](https://vite.dev/config/server-options#server-watch)

## Verification

- Fresh client coverage passed 7,594 tests in 490 files. The production
  build and all eight production Chromium checks passed. Client lint,
  type checks, and 13 configuration tests passed.
- The coverage ratchet used the fresh client report and the existing
  backend report. The backend source and lockfile diff was empty, and the
  installed server tree and coverage summary matched the previous hashes.
  The cross-workspace code-health and security workflow suites passed
  38,268 tests. Copyright, npm flag, ESM and Markdown checks passed.
- Astra reviewed the final implementation. The watcher regression waits
  for the control directory to appear in the watcher inventory, so
  startup cannot make it miss a one-time ready event. Both focused
  suites passed again after that test refinement.

GitHub listed zero open pull requests. This batch has no PR adoption or
Dependabot rebase. The separate OSV retirement draft remains available
for its own review.

Local maintenance removed two stale generated compiler projects after
verifying their ownership, age and resolved paths. The running Classifarr
container retained its image, start time and health.

## Next recommended item

Retire the expired server-only OSV exception for the withdrawn deepmerge
advisory after the existing proposal is confirmed. The existing scan
gates and active-advisory control define the acceptance checks.
