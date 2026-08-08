# Policy Native Storage Runtime And Release-Maintenance Boundary

Status: 8R.37.3 complete. The repository now has a read-only import-reachability
audit, no server-resident source-mutation subsystem, and no generic
repository-mutation command. 8R.37.4 will reconcile closure evidence without
changing normal policy automation.

## Problem

Phase 8R correctly owns native-intent schema, conversion, runtime authority,
rollback, backup/restore, and evidence that an installation has cut over. Its
later compatibility-removal work, however, currently includes services that
prepare or apply repository source changes. Extending a running application
with a server review-context registry would turn repository mutation into a
platform capability.

That boundary is inappropriate for the policy product:

- Application containers may not contain the checked-out source or Git history.
- A policy operator should not be able to cause source mutation through a
  browser, route, scheduled task, or persisted policy configuration.
- A source-removal operation requires a reviewed change set and CI validation,
  not a library-specific policy decision or a local machine assumption.

## Research Basis

- NIST SSDF recommends integrating secure practices throughout the development
  life cycle. Repository retirement should therefore retain source, review, and
  validation evidence as a release-engineering concern, instead of becoming a
  mutable production application feature. [NIST SP
  800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- OWASP recommends server-side authorization, least privilege, deny-by-default
  behavior, and safe failure. A running policy service does not need the
  privilege to write its own source in order to perform normal policy
  automation. [OWASP Authorization Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- PostgreSQL transactions and transaction-scoped locks are appropriate for
  native policy conversion, rollback, and retention because those are database
  state changes. They do not make repository mutation an application runtime
  responsibility. [PostgreSQL SET
  TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html),
  [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/16/explicit-locking.html)
- OWASP recommends applying least privilege and separation of duties to CI/CD
  identities, with no broad credentials shared across jobs. That supports a
  distinct release-maintenance command rather than repository write authority
  in the application process. [OWASP CI/CD Security Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
- GitHub recommends setting `GITHUB_TOKEN` permissions explicitly and only at
  the job that needs them. Its default recommendation is read-only repository
  access, which matches read-only audit jobs and narrowly scoped release jobs.
  [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- GitHub notes that a compromised runner can use every credential granted to
  its job. Source-write permissions therefore belong only in a narrowly scoped
  release job, not in the long-lived application runtime. [GitHub Actions
  runner security](https://docs.github.com/en/actions/concepts/security/compromised-runners)
- CISA's software supply-chain guidance names default deny, least privilege,
  separation of privileges, and total mediation as defensive principles. A
  static reachability audit gives those principles a repeatable repository
  control instead of relying on a deployment convention. [CISA Securing the
  Software Supply Chain: Recommended Practices for Developers](https://www.cisa.gov/sites/default/files/2023-12/ESF_SECURING_THE_SOFTWARE_SUPPLY_CHAIN_DEVELOPERS.pdf)

## Recommended Delivery Model

### Lane A: Native Intent Runtime Lifecycle

Owns 8R.1 through 8R.13 and remains part of the platform.

- Native schema, authority selection, conversion, rollback, retention,
  backup/restore, post-upgrade gating, and runtime reads are server-owned.
- Automatic reconciliation may run only under the existing bounded scheduler
  and transaction contracts.
- The behavior is installation-agnostic: it derives from each installation's
  actual policy, library, and native-intent state rather than policy names,
  local paths, or a maintainer's setup.

### Lane B: Installation Cutover Evidence

Owns read-only, instance-specific confirmation that native intent is active and
safe for an installation.

- Evidence must be derived from current database and runtime state.
- It can report ready, blocked, or remediation-needed outcomes with fixed IDs.
- It cannot delete source, write repository files, invoke Git, or create a
  policy-management dialog.

### Lane C: Repository Retirement

Owns compatibility-code removal as release maintenance, not platform runtime.

- A reviewed pull request or CI-maintenance job may use deterministic
  repository tools and validation evidence.
- It receives no HTTP route, application scheduler registration, client API,
  browser control, or persisted policy setting.
- Existing read-only evidence contracts may remain as release inputs, but the
  production-admission/source-writer path must not be extended or promoted.

### Lane D: Closure Evidence

Owns 8R.22 through 8R.36. It reports two independent results:

- `implementationReadiness`: whether the repository supplies the native intent
  contracts and evidence.
- `instanceCutover`: whether one installation has current evidence that it can
  retire compatibility behavior.

Neither result may claim the other. A pending instance cutover cannot turn a
complete implementation into an incomplete one, and repository completion does
not authorize a destructive operation in an installation.

## Options Considered

### Continue The Production Review-Context Registry

Pros: Reuses the existing controlled-removal modules.

Cons: Gives a running application a pathway toward source mutation, ties a
release operation to application deployment topology, expands privileged state,
and creates a maintenance UI/API pressure that the policy engine does not need.

Decision: Rejected.

### Leave Phase 8R As One Linear Chain

Pros: No documentation reshaping.

Cons: Blurs automated policy migration with conditional repository retirement;
obscures which work is installation-specific; and makes Phase 4R appear blocked
by a release-maintenance concern.

Decision: Rejected.

### Split Runtime, Instance Evidence, Repository Retirement, And Closure

Pros: Maintains least privilege, preserves automatic platform migration,
separates platform-agnostic behavior from release tooling, and gives each
remaining task a bounded owner and acceptance criterion.

Cons: Requires the roadmap and current controlled-removal direction to be
reconciled before further implementation.

Decision: Selected.

## Task 8R.37: Runtime And Release-Maintenance Boundary

### 8R.37.1 Runtime Capability Inventory And Isolation Decision

Inventory every route, scheduler registration, bootstrap import, client API,
environment entry point, and production service that reaches the controlled
compatibility-removal chain. Classify each as:

- native runtime lifecycle,
- read-only instance evidence,
- CI/release-maintenance tool, or
- remove/decommission.

Acceptance criteria:

- No normal policy route, browser action, client API leaf, or scheduler can
  issue a source-removal authorization or invoke a source writer.
- Every existing source-mutating module has an explicit release-maintenance
  owner or an explicit decommission decision.
- The inventory records only durable source paths and tests, never local
  checkout paths, policy names, library names, credentials, or source text.

Implementation outcome:

- `npm run policy:runtime-release-maintenance-audit` statically traces normal
  server bootstrap, route, scheduler, configuration, client bootstrap, and
  client API roots. It is now part of root `test:ci` and fails closed when a
  normal runtime surface reaches a catalogued source-mutating module.
- At the 8R.37.1 inventory point, the audit catalogued two source-mutation
  capabilities with durable relative paths: a generic file adapter behind a
  local script and the named-scope source writer. 8R.37.3 later removed the
  generic adapter and script; the named-scope writer is separately retired.
- The named-scope production-admission composer is also a decommission
  candidate because it creates that source writer. Neither it nor the writer is
  presently reachable from a normal runtime surface.
- Focused fixture tests cover route reachability, a missing release-maintenance
  owner, comment-safe static import parsing, and the current repository result.

### 8R.37.2 Runtime Reachability Removal

Remove any production bootstrap, route, scheduler, or client reachability found
by 8R.37.1. Retain no compatibility alias that makes source removal callable
from the policy platform.

Acceptance criteria:

- Repository searches and focused tests prove no production runtime path can
  reach a source writer.
- Normal policy automation and native-intent conversion remain unaffected.

Implementation outcome: complete.

- Removed the full closed named-scope compatibility subsystem: 19 server
  modules plus its dedicated tests and fixture. The subsystem had no route,
  scheduler, bootstrap, configuration, client, production-service, or
  release-maintenance consumer.
- Version 2 of `policy:runtime-release-maintenance-audit` declares those 19
  repository-relative service paths retired and fails closed when any one is
  reintroduced. It separately reports runtime reachability, so restoring the
  retired source writer through a route yields both violations.
- At this historical point, the generic file adapter remained outside
  application reachability and was owned only by a local script. 8R.37.3
  subsequently removed both rather than retaining a generic source-mutation
  capability.
- Focused tests cover the removed repository state, a reintroduced support
  module, a route-reachable reintroduced source writer, a missing
  release-maintenance owner, and comment-safe import parsing.

### 8R.37.3 CI-Only Retirement Command Contract

If compatibility code is still ready to retire, create or retain a
deterministic CI/release-maintenance command with explicit checked-out source,
approved change input, fixed validation commands, and an auditable result. It
must not call the running application or accept browser-supplied input.

Acceptance criteria:

- The command is non-interactive, uses argument arrays without a shell, and
  fails closed on dirty, mismatched, or incomplete evidence.
- Source mutation occurs only in the reviewed repository checkout and only
  after CI prerequisites pass.

Implementation outcome: complete.

- No approved target justified retaining a generic source-mutating executor.
  The former CLI, its filesystem adapter, public npm command, and dedicated
  mutable-boundary tests were removed.
- CI validates reviewed source changes in a read-only checkout rather than
  applying a deletion. The runtime release-maintenance audit rejects restored
  mutator modules, command entry points, npm commands, and repository workflow
  contents-write permissions.
- Pure removal-evidence builders remain read-only closure inputs; no concrete
  filesystem adapter remains in the repository.
- See [Policy CI-Only Retirement Command Contract](policy-ci-only-retirement-command-contract.md).

### 8R.37.4 Closure-Map Reconciliation

Update 8R.14 through 8R.36 evidence maps so repository retirement contributes
only to `instanceCutover` where appropriate and never blocks normal native
policy automation.

Acceptance criteria:

- Current closure output preserves `implementationReadiness` and
  `instanceCutover` independently.
- Phase 4R can rely on the native server projection without waiting for source
  retirement.

## Outcome

The next Phase 8R implementation task is **8R.37.4 Closure-Map Reconciliation**.
It must preserve the distinction between repository implementation readiness and
installation cutover evidence. Normal native policy conversion, runtime
authority, and policy automation remain independent of this work.
