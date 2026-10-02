# Development Tooling Deprecations

## Windows ESLint DEP0190

**Cause:** VS Code ESLint 3.0.34 launches `npm.cmd` with both an argument array
and `shell: true` while finding npm's global prefix. Node 24 warns about that
deprecated combination. It occurs before the project's local ESLint loads.

**Impact:** an editor tooling warning, not evidence that the Classifarr server
failed. The reproduced run still loaded the local ESLint. The observed arguments
are fixed; no exploitable command injection is claimed by this diagnosis.

**Next step:** track [upstream issue #2237](https://github.com/microsoft/vscode-eslint/issues/2237)
and retest the extension release containing its fix. npm 12.2.0 does not repair
the installed extension's bundled resolver.

### Evidence

Confirmed on 2026-10-02 with Windows x64, VS Code 1.140.0, extension 3.0.34,
external Node 24.18.1 and npm 12.0.2 on PATH. A separate, bounded LSP probe
started the installed language server with `--trace-deprecation`, initialized
it and requested JavaScript diagnostics. No vendor or workspace source was
modified by that probe.

Sanitized stack excerpt:

```text
[DEP0190] DeprecationWarning: Passing args to a child process with shell option true ...
    at normalizeSpawnArguments (node:child_process:644:15)
    at spawnSync (node:child_process:870:8)
    at Object.h [as resolveGlobalNodePath] (<extensions>/dbaeumer.vscode-eslint-3.0.34/server/out/eslintServer.js:1:221363)
ESLint library loaded from: <workspace>/server/node_modules/eslint/lib/api.js
```

Inspection of that installed bundle confirms the Windows `npm.cmd` branch and
`['config', 'get', 'prefix']` arguments. Searches of first-party source found no
matching `shell: true` invocation. Current lockfiles contain no npm `deprecated`
package metadata; that alone cannot prove all runtime APIs are current.

### Recheck Without Hiding The Warning

1. Keep the supported Node version and latest stable ESLint extension.
2. Temporarily add `"eslint.execArgv": ["--trace-deprecation"]` to VS Code
   settings; retain the existing `"eslint.runtime": "node"`.
3. Restart the ESLint server, open a JavaScript file and inspect ESLint Output.
4. Remove the temporary tracing setting after collecting the stack.
5. Run the repository lint commands to distinguish an editor warning from a
   project lint failure.

Do not disable warnings, downgrade Node, hand-edit the extension bundle, or use
the deprecated `eslint.packageManager` setting as a workaround. `eslint.nodePath`
is for module resolution problems and does not remove this earlier global lookup.

For new first-party process launchers, prefer a native executable with explicit
arguments and `shell: false` (for a JS CLI, `process.execPath` plus its path).
Do not pass untrusted values through a command shell or presume quoting fixes
every Windows shell case. Existing fixed-command wrappers remain separately
reviewable; this report is not a repository-wide security audit.

### References

- [Node.js deprecated APIs](https://nodejs.org/download/release/latest/docs/api/deprecations.html)
- [VS Code ESLint settings](https://github.com/microsoft/vscode-eslint/blob/main/README.md?plain=1)
- [ESLint extension 3.0.34 release](https://github.com/microsoft/vscode-eslint/releases/tag/release/3.0.34)
