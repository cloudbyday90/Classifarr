# Local Docker Build Provenance

## Intent

The compatibility-evidence maintenance runner accepts an application image only
when its OCI revision label exactly matches the clean reviewed checkout. Local
Compose source builds previously required an operator to calculate and pass
`VCS_REF` manually. That creates an avoidable error path: an omitted argument
produces an `unknown` label, while a manually copied revision can be wrong.

This component extends the existing smart Compose wrapper. When its command
builds Classifarr, it resolves the exact revision only from a clean checkout
and passes it through Compose as a Docker build argument. It never labels a
dirty checkout as its `HEAD` revision. A normal local build stays available
with an explicit `unknown` label, while the evidence-specific rebuild command
fails before it starts if provenance cannot be verified.

## Official-Source Research

- Docker documents Compose build arguments and the `--no-cache` control. The
  wrapper supplies a version as a build argument rather than treating a
  runtime environment value as proof of the built source.
- Docker documents that `docker compose up --force-recreate --wait` recreates
  services and waits for healthy/running state. The rebuild command performs a
  verified build first, then explicitly recreates and waits for Classifarr.
- NIST SSDF calls for protecting software from tampering and providing
  provenance information. A clean-worktree check ensures the label represents
  the source actually supplied to Docker rather than only its nearest commit.
- OWASP supply-chain guidance recommends immutable artifacts and verifiable
  provenance. The wrapper treats an unavailable or dirty checkout as
  unverified instead of silently asserting a revision.

Sources:

- [Docker Compose build reference](https://docs.docker.com/reference/cli/docker/compose/build/)
- [Docker Compose build specification](https://docs.docker.com/reference/compose-file/build/)
- [Docker Compose up reference](https://docs.docker.com/reference/cli/docker/compose/up/)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Software Supply Chain Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html)

## Options Considered

### Keep a Manual `VCS_REF` Command

Pros:

- no wrapper change.

Cons:

- easy to omit or copy the wrong revision,
- each host needs shell-specific Git variable syntax,
- does not verify that the checkout was clean before the label is asserted.

Decision: rejected.

### Label Every Local Build With `HEAD`

Pros:

- no build interruption while editing source.

Cons:

- a dirty checkout can produce image contents that do not match the label,
- makes the maintenance runner's revision check misleading rather than useful.

Decision: rejected.

### Extend Smart Compose With Clean-Checkout Provenance

Pros:

- uses one existing cross-platform Node and Docker Compose entry point,
- provides exact provenance automatically for clean source builds,
- preserves ordinary dirty-checkout development builds without overstating
  their identity,
- offers one noninteractive no-cache rebuild command for evidence collection.

Cons:

- provenance-verified builds require Git and a clean checkout,
- a published image still needs its release revision to match the reviewed
  checkout before maintenance evidence can run.

Decision: selected.

## Final Recommendation Stack

1. Treat the source revision as build provenance, not as an operator-provided
   runtime setting.
2. Resolve it only after `git status --porcelain=v1 --untracked-files=all`
   confirms a clean checkout and `git rev-parse HEAD` returns a full hash.
3. Pass the verified value to the Dockerfile through Compose `build.args`.
4. Set `VCS_REF=unknown` for ordinary builds whose checkout cannot be
   verified; later evidence collection then fails closed before database use.
5. Require provenance for the evidence-specific rebuild path and do so before
   any build or container recreation.
6. Build without cache, recreate only Classifarr, and wait for its health check
   before collecting maintenance evidence.

## Operational Contract

For a clean local checkout, the normal smart build and start flow labels the
image automatically:

```powershell
npm run docker:smart:up
```

For maintenance evidence, use the strict, noninteractive path:

```powershell
npm run docker:smart:provenance-rebuild
```

It first validates Git provenance, builds `classifarr` with `--no-cache`, then
runs `docker compose up -d --no-build --force-recreate --wait`. It does not
publish an image, alter source, approve evidence, or perform compatibility
removal. A dirty or unverifiable checkout exits before Docker is asked to
build or recreate the service.

## Implementation Outcome

Implemented:

- `scripts/lib/localDockerBuildProvenance.mjs` isolates clean-checkout and
  full-revision verification with a fail-closed result model.
- `scripts/docker-compose-smart.mjs` uses that module only for build-producing
  Compose commands. It supplies the verified `VCS_REF`, otherwise logs why the
  build is deliberately labeled `unknown`.
- `--require-provenance` removes the fallback and rejects non-build commands
  or unverifiable source before Docker executes.
- `docker-compose.yml` explicitly maps `VCS_REF` into the Dockerfile build
  arguments.
- `docker:smart:provenance-rebuild` creates a no-cache, provenance-verified,
  recreated, health-checked local image for the existing maintenance runner.
- Focused Jest coverage proves that clean, dirty, unavailable, and malformed
  Git revision states produce the correct bounded result.

The compatibility-evidence runner remains separately responsible for checking
that the running image label exactly matches its reviewed checkout. This build
helper supplies a reliable local path to meet that prerequisite; it does not
weaken it.
