# Isolate Vue compiler fixtures from the Vite watcher

November 21, 2026 Eastern. This change concerns the client development
server and its test fixtures.

## Reproduced behavior

The compiler tests create a temporary project under
`client/.tmp/vue-typecheck-*` for each compiler invocation. Vite 8.3.6
watches the client root, including this generated path. Creating its
`tsconfig.json` made Vite reload a real Chromium page and clear a synthetic
form draft on Node 24.22.1 and 24.22.3. The parallel validation run also
showed unexpected reloads. Its traces do not identify the triggering
file. [Runtime qualification outcome](node-24-22-3-runtime-outcome.md)

Vite exposes Chokidar's path filtering through `server.watch` and keeps
watching non-module files such as configuration. Disable watching only
for the compiler-owned path, with the watcher still active elsewhere.
[Vite watcher guidance](https://vite.dev/config/server-options#server-watch)
· [Chokidar path filtering](https://github.com/paulmillr/chokidar#path-filtering)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Ignore only the reserved fixture paths | Keeps compiler resolution and normal application reloads | Keeps the watcher rule coupled to the fixture path |
| Rename only the fixture tsconfig | Small producer change | Depends on Vite's current filename check and keeps other fixture files under watch |
| Move fixtures outside the client root | Keeps fixture writes outside the watcher by location | Changes ancestry for Vue and TypeScript module resolution |
| Always run browser and compiler suites serially | Works with current configuration | Slows independent validation and leaves the reload possible during other development |

## Recommendation

1. Anchor an absolute, separator-normalized watch exclusion to
   `client/.tmp/vue-typecheck-*` and its contents. Share the fixture path
   definition with the producer. Keep the existing temp directory
   layout, compiler command, options, diagnostics and cleanup.
2. Keep normal Vite watching, HMR, file-serving boundaries, browser
   assertions, timeouts and workflow permissions. The watcher filter
   determines which file changes Vite observes.
3. Exercise the installed Vite server on loopback with generated
   fixture creation, edits and removal. Require a watched config outside
   the reserved path to trigger an actual reload. Keep the positive
   fixture outside the client tree and add it only to the test's
   watcher to avoid reloading concurrent servers. Use a Chromium form
   draft to check that the generated activity preserves the document
   and the draft. Use a fresh local server and browser context.
   [Playwright isolation](https://playwright.dev/docs/browser-contexts)
4. Run the real compiler contracts, fresh client coverage, build and
   normal browser gates. Verify the current backend inputs and report
   before using prior coverage for the ratchet. Record observed results
   separately and add an Unreleased entry.

Astra reviewed the narrow path rule and the two-sided reload control.
W3C's guidance on predictable changes of context supports checking the
draft and focus state in the existing browser fixture. This change
applies to development and test tooling.
[W3C On Input guidance](https://www.w3.org/WAI/WCAG22/Understanding/on-input)
