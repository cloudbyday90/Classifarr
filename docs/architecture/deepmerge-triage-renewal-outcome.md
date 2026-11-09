# Rejected deepmerge advisory: bounded renewal outcome

Date: 2026-11-08 Eastern / 2026-11-09 UTC. Status: locally verified under the
operator's confirmed one-week scope. No release or deployment. See the
[design and alternatives](deepmerge-triage-renewal-design.md).

## Trigger and decision

The review-reference implementation was committed and pushed on main as
2245535c9d89ae6a8ab8e5bd3461690a6da76b4e. Its final local full suites and
coverage ratchet passed; its separate remote OSV gate failed.

[OSV run 42545540311](https://github.com/cloudbyday90/Classifarr/actions/runs/42545540311),
attempt 1, targets that exact commit. It reports one affected development
package, deepmerge 4.3.1, and only GHSA-gcqx-w48m-w2h4, medium/CVSS 5.3, with no
patched version. The prior server-only date expired November 9 UTC. GitHub
alert 126 remains open and labels the same advisory low.

Fresh official current and immutable CVE records retain the CNA rejection.
The GitHub advisory remains unwithdrawn and predates that rejection; npm still
publishes deepmerge 4.3.1. The server graph marks it development-only through
jest-config 30.5.2. This is advisory-data triage, not package remediation or a
claim about every production image.

The operator confirmed one exact server-local renewal to November 16 UTC.
Only the existing ID's date and reason changed. No other ID, severity, scanner
version, permission, workflow, application dependency or runtime source changed.
There is no automatic renewal or advisory dismissal.

## Actual scanner controls

Reused the existing OSV action image, index digest
sha256:d54770fe0b09493894e76a02aaed9f51a0513fa57c5186452a755d257b0068a6,
native AMD64 config
sha256:9b83615736eba33d105821197ba4b4fce2cd4b53dc89e02a9c1ee6d60c36afa4.
Its executable identifies 2.7.0_GHAction, commit
bfe2f84abd2f09fe0b83ba7f6dad40d296762f40. Invoked the real binary directly,
with bounded disposable containers and read-only synthetic fixture mounts.
No appdata, repository lockfile or host clock was changed for a control.

| Control | Actual result |
| --- | --- |
| Original expired server entry | Exit 1; exact deepmerge GHSA remains visible |
| Renewed entry with copies of all three current locks | Exit 0; all three locks scanned; no unfiltered finding |
| Same server lock at root and client beside the configured server copy | Exit 1; both outside-server paths retain the finding |
| Independent published ws 8.17.0 fixture in server scope | Exit 1; three unrelated advisories remain visible while only deepmerge is filtered |
| Renewed reason with its disposable date re-expired | Exit 1; deepmerge finding returns |

The independent control includes the published
[ws header-denial-of-service advisory](https://github.com/advisories/GHSA-3h5v-q93c-6h6q)
and two further current ws advisories. Actual application locks retain their
patched ws version; no vulnerable package was installed or executed for this
scan. An initial glob fixture returned no finding and was not accepted as a
negative control. Its result is retained privately; the verified ws control
supplies the independent-finding evidence.

## Integrity and delivery boundary

All eleven runtime-file hashes and all nine manifest/lock/installed-lock hashes
match the qualified application inputs. Existing full application coverage is
reused on that unchanged graph: 62,464 backend tests, 7,537 client tests,
43 PostgreSQL controls, nine browser checks and the coverage ratchet passed.
The scope/expiry controls above are fresh; no application-test baseline or
scanner threshold was relaxed.

The configuration and separate design/outcome records are delivered together
on main with an Unreleased note. The new push's own OSV check is the remote
receipt for the policy change; the earlier failed run remains a failure.
No release or production deployment is authorized or performed. The existing
npm/ip-address remediation requirement before another release is unchanged.
