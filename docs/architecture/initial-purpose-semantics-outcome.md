# Initial purpose semantics outcome

Date: 2026-11-09 Eastern. Agreed scope:
[design](initial-purpose-semantics-design.md). No release or deployment.

## Result

The shared initial materializer now preserves explicit identity/compatibility
with `rule.semantics ?? 'identity'`. Initial establishment and native create use
this existing leaf. Profile admission delegates native create; its currently
generated identity purpose is unchanged. No new mapper, schema, endpoint, UI or
operator CLI trigger was introduced.

Omission/null still default to identity. Other role mappings, structural parsers,
fingerprints, lock order and receipt recovery are unchanged. Older compatibility
requests that stored identity recover their original receipt before current
materialization, including after a later revision. No history is rewritten or
upgraded to new evidence.

Existing compatibility can contribute neutral 50 beside positive support; it
cannot independently admit a policy or mint specialized identity. Existing
calibration/caps and authorization remain. Fresh explicit compatibility may change
aggregation, eligibility, ranking and threshold bands compared with the accidental
identity mapping. This proves faithful declaration handling, not accuracy.

## Observed verification

Pre-fix production-module tests reproduced 18 failures in 81 cases. After the
one-expression change, the focused initial contract/capability/service/create
run passed 101 cases. The final consumer controls cover all 32 positive
signal/operator/semantics combinations, defaults, fingerprint distinctions,
bound contribution, neutral-50 matching modes, calibration, specialization and
display-name invariance. Three focused consumer suites passed 89 tests.

The new real PostgreSQL suite passes eight tests. Actual HTTP handlers persist
and load identity, compatibility, omission and null; the production active-policy
reader then supplies the typed item to the bound evaluator. Native create/replay
and administrator refusal are exercised. The test injects its actor into Express;
this is not a full authentication-session/browser test.

A seeded pre-fix compatibility request storing identity recovers after a real
native revision, including create recovery, without another version. Changed
semantics under the same key remain a conflict. A second real session waits on
the policy lock before receiving the existing key-reuse refusal. Injected audit
failure rolls back actual writes; real COMMIT followed by synthetic lost
acknowledgement recovers through the exact receipt. The existing failure status
name does not prove rollback after a lost reply.

The combined initial/declaration/purpose-change PostgreSQL run passes three
suites / 28 tests. Only isolated test databases are used; no live configuration
or provider is contacted.

Fresh backend coverage passes 1,933 suites / 62,790 tests with one existing skip
in 757.382 seconds: 89.28% statements/lines, 86.72% branches and 90.81% functions.
All 2,045 frozen service/installed-lock inputs remain unchanged. Final fixture
output/Host controls are separately verified in the passing 11-case patch suite;
fixtures are outside the measured source. The unchanged coverage ratchet passes.
Lint, server/client types, both Knip modes, ownership, ESM, copyright, all four
policy gates, 97 dependency/tooling tests and Markdown checks pass.

The 1,227 qualified client source/configuration/installed-lock/report hashes remain
unchanged. Its previous 484-file / 7,539-test coverage, production build and eight
production-browser controls are reused, not described as rerun. This batch adds
no UI or browser contract. Dependency/maintenance and CI delivery results are
tracked in the separate runtime outcome and final completion message.

## Next recommendation

The next category-neutral runtime step is compatibility-purpose prompt projection:
the current projection omits this supported pair. Define its evidence meaning
without relabeling purpose as a helpful hint or adding specialized identity, then
address remaining category-specific prompt assumptions. Historical data and frozen
captures stay untouched.

Security priority alongside that work: assess a corrected Node/npm toolchain for
Node's bundled Undici and the existing npm/ip-address residual before another
release. See the [runtime dependency outcome](server-runtime-pr-586-outcome.md).
