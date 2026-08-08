# Policy Storage Implementation Readiness

## Intent

Policy storage evidence has two different decisions that must not be conflated:

1. **Implementation readiness** asks whether the checked-out Classifarr source
   has the required design, contract, test, roadmap, changelog, and validation
   evidence. It is repository-scoped and does not inspect any user's database.
2. **Instance cutover readiness** asks whether one active installation has
   safely completed its compatibility-removal audit. It is installation-scoped
   because it must inspect the policy state and deletion evidence of that
   installation.

`policyStorageImplementationReadiness.mjs` owns the first decision. The
existing completion checkpoint composes it with the second decision only when
reporting final storage closure. A blocked local cutover must never be reported
as an incomplete platform implementation.

## Official-Source Research

- NIST SSDF calls for defining and maintaining repeatable software-development
  practices with verifiable evidence. Repository-scoped readiness supplies that
  repeatable software evidence independently from a deployment's data state.
- NIST SP 800-128 treats operational changes as controlled and traceable.
  Compatibility deletion remains an installation-specific control because its
  correctness depends on the installation that will actually be changed.
- OWASP recommends enforcing security controls at the trust boundary. The
  source-evidence evaluator remains pure, while the destructive cutover gate
  retains its separate, fail-closed installation evidence.
- PostgreSQL documents transaction and lock semantics for state-changing work.
  This supports keeping the database-bound cutover verification near the target
  installation instead of attempting to infer it from source code alone.

Sources:

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)

## Options Considered

### One Combined Closure Status

Pros:

- one value is easy to read.

Cons:

- a local policy inventory can make the repository appear unimplemented,
- release engineering cannot distinguish source work from a customer's safe
  migration state,
- operators receive an inaccurate explanation for a blocked deletion.

Decision: rejected.

### Infer Installation Completion From Source Evidence

Pros:

- no installation query would be needed.

Cons:

- source code cannot prove a particular database's conversion, backup, or
  compatibility-removal state,
- would weaken the destructive-operation safety boundary.

Decision: rejected.

### Separate Repository And Installation Decisions

Pros:

- CI and release assessment are portable and environment-agnostic,
- deployment-specific deletion safeguards remain strict,
- outputs explain exactly whether to fix source evidence or establish a local
  policy state.

Cons:

- closure output contains two explicit readiness fields instead of one.

Decision: selected.

## Final Recommendation Stack

1. Evaluate implementation readiness from only expected component evidence,
   roadmap coverage, release-note coverage, and fingerprint-valid validation
   evidence.
2. Keep the evaluator pure: no filesystem reads, commands, Git operations,
   database access, or writes.
3. Report active-installation cutover evidence separately in closure output.
4. Require both only for final compatibility-path deletion and storage closure.
5. Keep blocked local cutovers fail-closed; do not use repository readiness as
   deletion authority.

## Implementation Outcome

Implemented:

- Added `policyStorageImplementationReadiness.mjs` as a modular, pure source
  readiness evaluator.
- Refactored the storage completion checkpoint to compose repository readiness
  with the existing compatibility-removal completion audit rather than treating
  either as the other.
- Added explicit `implementationReadiness` and `instanceCutover` projections to
  closure evidence output.
- Preserved the existing final-closure requirement that an active installation
  complete its fingerprint-valid compatibility-removal audit before deletion can
  proceed.
- Added focused tests proving a blocked installation audit leaves source
  implementation readiness ready when repository evidence is complete.
- Reconciled the closure component catalog so active-installation
  compatibility-removal identifiers cannot enter the repository implementation
  evaluator, including through a custom artifact map. The final closure
  requirement remains unchanged. See [Policy Closure-Map
  Reconciliation](policy-closure-map-reconciliation.md).

Not implemented:

- no automatic compatibility deletion,
- no database migration or storage mutation,
- no relaxation of approval, backup, rollback, or instance cutover gates.
