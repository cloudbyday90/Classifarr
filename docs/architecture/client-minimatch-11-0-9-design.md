# Client minimatch 11.0.9 qualification

November 21, 2026 Eastern. Approved design assessed at `774c9ef68`.

The client currently pins minimatch 11.0.4. Its exact override is shared by
EditorConfig 3.0.2, ESLint 10.14.0, ESLint config-array 0.23.5 and glob 14.0.3.
The first three declare 10.x ranges, which the existing override already
replaces. Successful installation alone gives limited compatibility evidence.
Vite and Vitest use picomatch and tinyglobby directly. Run their usual commands
to check the client tooling as a whole. Astra reviewed these boundaries.

Pin exact client minimatch 11.0.9 and review the new nonrecursive matcher
lock record. Preserve the other overrides, Vue compiler patch and install
script policy. Test the documented refusal when level-two optimization
exceeds the configured expansion budget. Keep the admitted budget and
exact-match tests in both module formats. Exercise the real EditorConfig,
beautifier and glob consumers and add a small actual ESLint fixture for
flat-config file inclusion and ignores.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Qualify the exact client update | Shares the server's verified matcher version and refusal behavior | Requires testing consumers whose declared ranges still target 10.x |
| Stay on 11.0.4 | Preserves the current installed graph | Retains partial matching in the tested over-budget case |
| Remove the override | Delegates the ranges to each consumer | Reopens earlier compatibility and scanner decisions across multiple versions |

Run a strict install, full tree and development-inclusive audit, dependency
tests, client lint and types, fresh client coverage, production build and
browser checks. Reuse existing accessibility-related browser checks where
they observe rendered interactions. This tooling update has no independent
accessibility conformance claim. Keep the candidate only after the consumer
and repository gates pass.

## Official references

- [Pinned minimatch 11.0.9 source](https://github.com/isaacs/minimatch/blob/e89926755f3f79cf79f1087bd5730ed4d7eba60e/src/index.ts)
- [ESLint file and ignore patterns](https://eslint.org/docs/latest/use/configure/configuration-files)
- [npm clean install](https://docs.npmjs.com/cli/commands/npm-ci/)
- [W3C accessibility evaluation](https://www.w3.org/WAI/test-evaluate/)
