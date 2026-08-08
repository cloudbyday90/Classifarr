# Policy CI-Only Retirement Command Contract

Status: 8R.37.3 complete. Classifarr has no generic repository-mutation
command. CI validates reviewed source changes; it does not modify the checkout.

## Decision

No approved compatibility-removal target currently requires an executor. The
former generic `--apply-files` command and its filesystem adapter were therefore
retired rather than given CI credentials.

Repository retirement is a normal reviewed source change: the intended deletion
is present in the commit before CI starts. CI checks that immutable checkout with
the fixed `test:ci` validation suite and emits read-only audit output. It has no
application route, scheduler, browser input, persisted policy setting, npm
command, or repository-write permission that can mutate source.

Pure compatibility-removal evidence builders remain available as read-only
inputs to closure evidence. They cannot change a file without a concrete adapter,
and the only concrete adapter has been removed.

## Research Basis

- OWASP recommends deny-by-default, least-privilege access for pipeline
  identities, secrets, platform resources, and operating-system accounts. A
  generic write-capable executor has no justified current privilege. [OWASP
  CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- GitHub recommends full commit-SHA action pinning and minimum `GITHUB_TOKEN`
  permissions. It identifies a full SHA as the immutable action reference.
  [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- GitHub creates a repository-scoped `GITHUB_TOKEN` per job and expires it at
  job completion. Eliminating `contents: write` removes the authorization a
  self-mutating command would need. [GitHub `GITHUB_TOKEN`
  guidance](https://docs.github.com/en/actions/concepts/security/github_token)
- Node's `spawn` defaults to `shell: false`, but argument arrays do not make an
  unnecessary destructive capability safe. The selected design removes the
  executor instead. [Node.js child-process documentation](https://nodejs.org/api/child_process.html)
- NIST SSDF calls for secure development practices across the life cycle. A
  reviewed source change plus deterministic CI validation gives retirement an
  auditable SDLC boundary without expanding the production platform. [NIST SP
  800-218](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Retain A Generic CI Executor

Pros: could automate a future file deletion from structured evidence.

Cons: needs a write-capable checkout and credential boundary, retains
speculative destructive code, and makes a future workflow permission error more
consequential.

Decision: rejected.

### Gate The Existing Executor On A CI Environment Variable

Pros: small implementation change.

Cons: environment markers are not an authorization boundary, and the command
would still be capable of source mutation in any checkout with the flag.

Decision: rejected.

### Validate Reviewed Source Changes In Read-Only CI

Pros: uses the normal pull-request and commit review model, requires no source
write permission, removes dormant mutator code, and keeps test output
deterministic.

Cons: a future approved retirement is expressed as a normal source change
instead of a self-modifying CI job.

Decision: selected.

## Enforced Contract

- `npm run test:ci` validates the reviewed checkout and includes the runtime
  release-maintenance audit.
- The audit fails if a retired source-mutation module, the retired generator
  script, or the retired npm command is restored.
- The audit scans workflow YAML and fails when it finds `contents: write` or
  `permissions: write-all`.
- The current workflow set uses full-SHA action pins and has no repository
  contents write permission. `pull-requests: write` remains permitted only for
  bounded review comments and cannot modify repository contents.
- No application process, browser request, scheduler, or runtime setting can
  start repository retirement.

## Implementation Outcome

- Removed `scripts/generate-policy-controlled-removal-apply.mjs` and
  `server/src/services/policyControlledRemovalFileApplyAdapter.mjs`.
- Removed the public `policy:controlled-removal-apply` npm script and the two
  focused suites that exercised the now-retired mutable boundary.
- Added a modular retirement-contract inventory to the existing read-only audit.
  It records only repository-relative module, command, entry-script, workflow,
  and line identifiers.
- Added regression cases for module, route, npm-command, entry-script, and
  workflow-permission reintroduction.

## Final Recommendation Stack

1. Keep repository source mutation out of Classifarr and out of CI jobs.
2. Express a future deletion as a reviewed commit, then validate it with the
   fixed CI suite in a read-only checkout.
3. Keep full-SHA workflow action pins and least-privilege permissions.
4. Maintain the fail-closed audit as the enforcement point for this contract.

## Next Step

Proceed with **8R.37.4 Closure-Map Reconciliation**. It must ensure closure
evidence reports repository implementation readiness separately from any
installation's native-intent cutover state.
