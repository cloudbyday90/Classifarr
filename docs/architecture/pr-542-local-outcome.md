# PR #542 local outcome

Date: 2026-09-22. [Open PR #542](https://github.com/cloudbyday90/Classifarr/pull/542)
was randomly selected from currently open, not-yet-locally-applied PRs. Its
two-file patch was applied locally; the PR was not merged or closed.

The patch updates server `dotenv` 17.4.2 → 18.0.0 and `js-yaml` 5.2.3 → 5.4.2,
including the lockfile and aligned existing `js-yaml` override. The server uses
ESM imports and `dotenv.config({ path, quiet: true })`; no application code uses
dotenv preloading or `.env.vault`. The project uses `js-yaml`'s public `load`
API, not low-level AST nodes. `npm ci --ignore-scripts` resolved the exact
locked versions with zero reported vulnerabilities. ESM import smoke, server
typecheck and lint passed. The complete backend test result belongs to this
commit's final verification, not to the upstream PR's checks.

[dotenv's upstream changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)
documents removal of preloading and vault support in the new line;
[js-yaml's upstream changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md)
documents the 5.4.x fixes and 5.4.0 low-level AST change. The local runtime API
smoke is important because dotenv is a major update. The focused env/YAML,
package metadata, Code Health and workflow test selection passed 26,648 tests;
the complete backend unit and PostgreSQL integration suites also passed.
The benefit is current parser fixes and dependency hygiene; the cost is
major-version compatibility risk. Recommendation: retain the local patch with
the passing ESM smoke and backend regression results, then let hosted CI check
the container startup path. No release is created here.
