# Server Node declaration trial outcome

Date: 2026-10-06. [Design and recommendation](node-types-pr556-design.md).

Applied the reviewed #556 manifest/lockfile diff on the local checkout, without
merging the PR or creating a branch. The existing gate
`node --test scripts/__tests__/container-runtime-baseline.test.mjs` passed seven
checks and rejected the server declaration check: expected Node 24 declarations,
received `^26.6.4`.

Removed only the trial edits and verified both package files match the starting
revision. No installation or lifecycle scripts ran. This is a tested, rejected
local implementation, not a retained dependency upgrade. Keep Node 24 type
alignment; evaluate a runtime-major upgrade separately. No PR was changed.
