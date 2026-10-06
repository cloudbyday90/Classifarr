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

The normalization-reuse round repeated the randomly selected immutable diff:
seven gate checks passed and the server type-major check failed. After reverting
only the trial, all eight checks passed and both package files matched HEAD.
No installation, lifecycle execution or retained dependency change. Read-only
`npm outdated` also listed express-rate-limit 8.7.1 and js-yaml 5.4.3 as patch
candidates; review those separately rather than expanding this memory change.

The natural-recovery round freshly selected #556 again from the two open PRs
at the same head. Applying its exact two-file diff again produced seven passes
and the Node-major failure. Only those trial edits were reverted before install;
the recovery work retains no dependency change and leaves the PR open.
