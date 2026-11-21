# Stable code-health JSON inputs

November 21, 2026 Eastern. Approved design assessed at `1b86aa04d`.

The client code-health suite registers a test at collection time for each JSON
file it discovers. Playwright owns both `client/test-results` and
`client/playwright-report`. Its configured output directory is cleaned before
a run and repopulated during or after execution. The previous client dependency
assessment found two generated `.last-run.json` cases in paired runs. A run
that overlapped with Playwright counted one fewer test overall, and its
per-case inventory was unavailable. [Observed outcome](client-minimatch-11-0-9-outcome.md)

Extract the existing JSON walk into a small test helper. Prune the two exact
repository-relative Playwright directories before descent. Preserve the
current depth bound, other exclusions, authored files outside those paths,
and the existing parser, lockfile, package and web manifest checks. Sort
paths so enumeration order does not depend on the filesystem. Astra
confirmed the output paths from both configurations and CI artifact scope.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Prune the exact generated roots | Stable input scope with a narrow change | New output roots would need a matching update |
| Skip every directory with either basename | Simple rule | Could skip authored JSON in separate directories |
| Use only Git-tracked files | Stable tracked inventory | Misses new authored files before staging and depends on Git checkout metadata |

Use a small temporary fixture to compare the inventory before and after
adding malformed browser output and HTML report data. Check that malformed
authored JSON remains discoverable even under a similarly named directory.
Run the actual suite around real Playwright output and verify the case lists
match. Keep normal client coverage and browser checks. The project still
parses the authored web manifest and checks its product field contract.
The W3C Web Application Manifest working draft describes the JSON format.
The existing browser checks provide separate scoped interaction evidence.

## Official references

- [Playwright output directory behavior](https://playwright.dev/docs/api/class-testconfig#test-config-output-dir)
- [Node filesystem directory entries](https://nodejs.org/api/fs.html#class-fsdirent)
- [W3C Web Application Manifest working draft](https://www.w3.org/TR/appmanifest/)
- [W3C accessibility evaluation guidance](https://www.w3.org/WAI/test-evaluate/)
