# Validation and navigation dependency outcome

Date: 2026-10-12. Main development only; no release, version bump or PR merge.
See the [design, official research and tradeoffs](validation-router-dependency-design.md).

## Implemented

- Pin server Zod to exact 4.6.6 from 4.6.5; no other server lockfile packages change.
- Apply the manifest/lockfile changes from randomly selected
  [PR #559](https://github.com/cloudbyday90/Classifarr/pull/559), immutable head
  `3045aaf124525e1db6611d64950740bc8177c693`: Vue Router 5.4.0.
- Extend existing ESM tests for bounded policy-list rejection, valid-limit inputs,
  element validation, HTTP rejection before database work, repeated/bare/empty
  queries, legacy redirects and encoded authentication return links.
- Bound the test-only CSRF source reader after phase diagnostics identified
  blocking filesystem latency; preserve the original security scan and deadline.
- Preserve the existing service architecture, schemas, authorization, body limits,
  memory safeguards, strict install policy and security overrides.

No new singleton, schema migration, catalog approval or live recovery was needed.
The exact Router PR patch is retained; the PR itself was not merged.

## Artifact review

Fetched the Zod tarball with scripts disabled before importing it. Its 840-file
manifest has no `meta.mjs` loader or install hooks. SHA-512 recomputation matches
the registry/lockfile integrity:

```text
sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA==
```

The complete published-package diff against 4.6.5 matches the upstream net change:
size gates, record declarations, tests and version metadata. The earlier removed
loader commits listed in the upstream release history are not present in this
net artifact diff. No removed upstream candidate version or loader was executed.
This review does not establish that the user's system was compromised, or prove
the absence of every possible supply-chain risk.

Normal `npm ci` passed in both workspaces without relaxing script policy or peers.
Complete `npm ls --all` trees passed. Full-scope npm audits reported zero known
vulnerabilities: 631 server / 296 client packages audited during install.
`npm audit signatures` verified 630 server / 295 client registry signatures,
including 114 / 122 available attestations. These checks establish registry
integrity/provenance, not an independent code-security certification.

## Local verification

On baseline Zod 4.6.5, the two new early-size-rejection tests failed while the
other ten validator tests passed: oversized presets were inspected and invalid
nested elements produced many issues before the size error. On 4.6.6, all 237
targeted tests in eight suites passed, including the HTTP boundary. A first
draft of the HTTP test incorrectly expected an `issues` response field; corrected
the test to the existing bounded summary contract without changing the API.

Router baseline 5.3.1 passed all 17 navigation tests including the new cases.
Server/client lint and typechecks, server knip in both modes, all 41 dependency
policy checks, and all 12 client runner/configuration checks passed.

Full backend unit/HTTP coverage passed: 1,801 suites, 56,339 tests and one existing
Linux-only directory-fsync skip on Windows in 866.227 seconds (89.71%
statements/lines, 86.14% branches, 91.14% functions).
The database integration project is separate and was not run for this dependency
batch; the exact-image fresh database/schema check remains required below.
The production client build and all eight loopback Chromium browser checks passed,
including lazy navigation, browser history, chunk budgets and blocked mutations.
The combined coverage ratchet passed with both newly generated reports. The
image evidence below is tied to the clean implementation commit, not a dirty
checkout or an earlier successful build.
The first frontend coverage run passed 6,891 tests and failed only the unchanged
CSRF source check: 7.064 seconds against its five-second deadline. It ran alongside
backend coverage and other host checks; the earlier tooling design already advised
serial large suites. This was a scheduling mistake in this validation attempt,
not evidence of a Router regression. Rerun the complete frontend suite without
competing verification jobs, with existing phase diagnostics and unchanged
deadlines/assertions. That serial attempt reproduced the timeout at 7.078 seconds.
Diagnostics measured 7,013.8 ms in 584 reads, 9.8 ms matching rules, and 141 ms CPU
overall. This localizes the delay to blocking file reads rather than rule logic;
it does not identify the underlying OS/antivirus cause. Scheduling alone was not
a sufficient fix.

Replace only the source-reading loop with a bounded asynchronous ESM helper:
16-file batches, ordered results, all admitted reads settled before propagating
an error, and no next-batch prefetch. Source discovery, allowlist, regex rules,
assertion and the five-second deadline remain unchanged. The five new reader
tests plus the actual CSRF contract and eight diagnostic tests passed (14 total).
An actual forbidden-mutation source fixture caused the expected assertion
failure, not a timeout; removed that temporary file immediately afterward.
The clean scan then passed in 63.9 ms, including 38.2 ms across 38 batch-next waits
and the same 581 non-allowlisted match calls. These are measured runs, not a
universal latency guarantee. Client lint, documentation and copyright checks also
passed after the helper was added. Final complete client coverage passed all
6,898 tests in 459 files (387.72 seconds), with 87.34% statements, 81.08% branches, 87.07%
functions and 89.09% lines. Both earlier frontend attempts are retained as
failures (6,891 passed / one timeout each), not relabeled as successful runs.

## Local safety baseline

Before replacement, the local image was
`sha256:4292b08b40d5c42f40468892baa58e579fb7ba03f78fcf3c75f5e3aec2ccf1b2`.
A 75,892,424-byte custom-format database backup was checksum-verified and readable
by `pg_restore --list`; its private file and exact rollback tag remain under local
control, outside git.

The read-only pre-rebuild probe at 12:23:02 UTC reported 10 active/covered libraries,
6,836 classifications, four unresolved identities (two source-review, two waiting
for retry), zero pending text embeddings and 6,814 pending image embeddings.
The bounded pending batch contained ten unique rows. The probe made zero writes
or provider calls and found no startup WARN/ERROR records for that container run.
These counts are observations, not permission to approve or clear identity issues.

## Exact-image evaluation

The no-cache provenance-required Compose build passed from clean implementation
commit `497186ba91547ab5aa39ab238a1a61fd0cb6e977`.

| Identity | Value |
| --- | --- |
| Local Docker image/index ID | `sha256:feb100764ff2990d220075425bad84a92d0a0fa80f328815d6bfc46ebb97e6e1` |
| Exported image manifest | `sha256:85cb06d664d373d83b56022eaf35860ec9c50751d06beeaea918ab34de9a38ca` |
| Exported image configuration | `sha256:4797cd0041d577a79bf5f5c30bbb65d946de5c2ea52c21fdcfa65b3a4f905294` |

These are local build identities, not published registry or signed release claims.
The OCI revision matched the implementation commit. A documentation-only followup
records this outcome; no runtime code changed after the tested image was built.

Ran `dumpSchema` from `scripts/dump-schema.mjs` after the no-cache build using that
exact image, normal entrypoint and a disposable network-isolated database limited
to 1 GiB, two CPUs and 256 PIDs. The dump covers migrations through
`20261010_220000_source_catalog_mappings.sql` and 22 seed migrations.
`database/schema/current.sql` is unchanged. The fresh database consumer probe
confirmed zero classifications, pending embeddings and unresolved identities.
The owned fixture container and its generated data directory were confirmed absent
after cleanup.

Recreated only local Classifarr with `--no-build --pull never --no-deps`; its running
image ID matched the evaluated image. Docker health and HTTP `/health` passed
(200), with zero restarts and no OOM flag. UID/GID 1000:1000, read-only root,
no-new-privileges and the 2,147,483,648-byte memory limit remain intact. An in-image
ESM check confirmed Node 24.21.0, Zod 4.6.6 and zero item parses when an array
exceeded its bound.

At 12:58:16 UTC the read-only post-rebuild probe matched the baseline: ten
active/covered libraries, 6,836 classifications, four unresolved identities with
the same recovery split, zero pending text and 6,814 pending image embeddings.
The ten-row pending batch remained unique (7 ms); no startup WARN/ERROR records
were present at that observation. The probe made zero writes/provider calls.
This short observation is not a long-duration memory or recovery soak.

Unraid, shared Plex/Ollama, unrelated Docker containers and identity approvals
were unchanged. No release, tag, registry publication or PR merge was performed.

## Next bounded item

Review the held client TypeScript 7 transition against Vue's compiler-API consumers
before considering adoption. The outdated report still lists client 7.0.2 versus
pinned 6.0.3; prior repository work observed missing legacy compiler APIs in the
new major. Keep Node declarations on the supported 24.x runtime line despite the
registry's newer 26.x major. Neither major belongs in this patch batch.
