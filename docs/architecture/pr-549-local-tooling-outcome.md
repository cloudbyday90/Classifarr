# PR 549 local frontend tooling evaluation

## Selection and design

The GitHub MCP open-PR query returned PRs 552 and 549. PR 552 was already applied
locally; the random draw from the remaining eligible set selected its sole member,
[PR 549](https://github.com/cloudbyday90/Classifarr/pull/549), at head
`296b60ad02a325689773ef85344f1a3d2dd09008`.

Apply its client-only patch updates: Vite 8.3.0 to 8.3.1 and eslint-plugin-vue
10.11.0 to 10.11.1, including the lockfile. Do not merge or close the PR.

Official release notes reviewed on 28 September 2026:

- [Vite 8.3.1](https://github.com/vitejs/vite/releases/tag/v8.3.1): includes
  WebSocket configuration merging and optimizer/watcher lifecycle fixes.
- [eslint-plugin-vue 10.11.1](https://github.com/vuejs/eslint-plugin-vue/releases/tag/v10.11.1):
  includes Vue rule false-positive fixes, including a defined model default.

## Tradeoff and outcome

Patch updates provide upstream correctness fixes without changing application
APIs. The cost is rebuilding and validating the bundler/linter dependency graph.
Client coverage passed 5,652 tests across 402 files. Client lint, type checks and
the production Vite build passed. New regressions exercise disabled WebSocket
configuration merging and Vue model-default validation, including a negative
optional-prop case. Retain these patch updates. The PR is not merged and no
release is created.
