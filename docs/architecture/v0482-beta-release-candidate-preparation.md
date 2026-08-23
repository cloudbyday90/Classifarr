# v0.48.2-beta Release-Candidate Preparation

Status: prepared in source. No `v0.48.2-beta` tag, GitHub release, package
publication, or container publication is created by this change.

## Outcome

The repository now presents one prepared source version for the next planned
tag: `v0.48.2-beta` / `0.48.2-beta`. Root, client, server, and all three
lockfile roots agree with the UI label. The README clearly distinguishes the
prepared source version from a published release, and the first release-notes
entry describes this candidate.

The existing ESM `release:check-candidate-version` command now also validates
the public version surfaces. It fails closed when any one of these differs from
the supplied tag:

- package and lockfile root versions;
- in-app `APP_DISPLAY_VERSION`;
- README version badge and source-version marker; or
- the first `RELEASE_NOTES.md` release heading.

The new `scripts/lib/releaseCandidateDocumentation.mjs` module owns only the
three public-document checks. The existing version module remains responsible
for package/tag SemVer mapping, keeping source parsing and pure validation
separate.

## Design

```text
selected tag: v0.48.2-beta
          |
          +--> 0.48.2-beta in root/client/server package + lockfile roots
          +--> v0.48.2-beta in the app display constant
          +--> README badge + transparent source-version marker
          +--> first release-notes heading
          |
          v
release:check-candidate-version
          |
          v
tag workflow may begin its independent evidence gates
```

The README does not claim an untagged build is published. It says the source
version becomes public only after the tag pipeline succeeds, preventing a
documentation update from being mistaken for a release announcement.

## Research Basis — August 2026

- npm's [`npm version` documentation](https://docs.npmjs.com/cli/v11/commands/npm-version/)
  confirms that a release version is valid SemVer metadata and that npm normally
  writes package and lockfile version data together. Classifarr deliberately
  avoids `npm version` here because that command can create a Git commit and tag;
  this preparation task must not publish a release.
- npm documents [`--package-lock-only`](https://docs.npmjs.com/cli/install/)
  as updating only the lockfile while ignoring `node_modules`. The release
  procedure adds `--ignore-scripts` for metadata-only refreshes so dependency
  lifecycle code does not run during this operation.
- GitHub's [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
  recommends full-SHA action pinning and least-privilege permissions. The
  version guard is a local deterministic check; it does not add an action,
  secret, network call, write token, or release authority.
- GitHub's [release guidance](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
  distinguishes prereleases as GitHub release records. Source preparation alone
  therefore must not be described as a published prerelease.

## Options Considered

### Change package versions only

Pros:

- Smallest diff.
- Existing package consistency tests catch package and lockfile mismatches.

Cons:

- The UI, README badge, or release notes can still advertise an old release.
- A tag can pass package-only validation while public release metadata is stale.

Decision: rejected.

### Use `npm version` for each package

Pros:

- npm has a built-in version update command.
- It can synchronize a package's lockfile metadata.

Cons:

- Its default Git behavior can create commits and tags, which exceeds
  release-preparation authority.
- It does not coordinate the three independent packages or public documents.

Decision: rejected.

### Selected: coordinated metadata update plus deterministic document guard

Pros:

- Preserves an explicit reviewable commit and creates no tag or release.
- Detects the public-facing version drift that package-only checks miss.
- Uses small ESM modules with fixed local paths and no remote authority.
- Keeps the current public release truthful until the tag pipeline completes.

Cons:

- Adds three exact documentation markers that must be kept intentionally in
  sync for each planned tag.
- The candidate is still not release-ready until the full Docker, security,
  test, and tag-evidence procedures complete.

Decision: selected.

## Final Recommendation Stack

1. Prepare package, lockfile, UI, README, and release-notes version surfaces in
   one reviewed source change.
2. Refresh only lockfile metadata with `--package-lock-only --ignore-scripts`.
3. Run the deterministic version/document guard before every tag attempt.
4. Complete the full local release-readiness suite and security checklist.
5. Create `v0.48.2-beta` only after those checks pass; let the protected tag
   workflow produce and verify release evidence, rather than using local
   publication commands.

## Next Recommended Item

Run the documented release-readiness suite against the prepared
`v0.48.2-beta` source: build the local verification image, run the fresh
schema and Docker smoke checks, then complete the required test, coverage, and
security gates. Do not create the tag until the evidence is green.
