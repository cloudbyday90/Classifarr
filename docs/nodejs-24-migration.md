# Node.js 24.18.1 And npm 12.2.0 Baseline

Classifarr supports Node.js `>=24.18.1 <25` and npm `>=12.2.0 <13` in local
development, CI, and production. The exact Node baseline is stored in
[`.nvmrc`](../.nvmrc). Docker uses the official `node:24.18.1-alpine3.24`
image and installs npm 12.2.0; GitHub Actions reads the same Node version file
and installs the same npm release. `npx` is installed with npm, so its expected
version is also 12.2.0.

## Decision

Node.js recommends production applications use Active or Maintenance LTS
releases. Node 24.18.1 is the selected LTS baseline. Node 25 is end-of-life,
and Node 26 remains a Current release rather than a production runtime
contract. We can evaluate Node 26 after it reaches LTS in a dedicated upgrade.

npm recommends installing its latest stable release explicitly because its
release cadence is independent of Node.js. npm 12.2.0 supports Node 24.18.1;
we pin that version instead of using the moving `latest` tag.

This is the repository baseline, not a claim that Node 24.18.1 is the newest
LTS patch. Node 24.21.0 and Alpine 3.24.2 are the next separate runtime update.
See the [npm update design](architecture/npm-12-2-design.md) and
[validation outcome](architecture/npm-12-2-outcome.md).

## Benefits And Tradeoffs

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Node 24.18.1 LTS | Supported production line; stable ecosystem support; matches the current jsdom 30 declared support range | Requires periodic LTS patch updates | Adopt |
| Node 26 Current | Newest runtime features | Not yet LTS; raises upgrade churn and compatibility risk | Defer |
| Node 25 | None over the supported alternatives | End-of-life and unsupported by current jsdom 30 engines | Do not use |

| Package manager option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| npm 12.2.0 with bundled npx | Current stable npm release; Node 24-compatible; one managed source for npm and npx | Installer policy requires explicit review and clean-install validation | Adopt |
| Bundled npm 11.16.0 | Already shipped with the Node base image | Not the current stable npm release | Do not use as the baseline |
| `npm@latest` | Automatically follows new releases | Non-reproducible builds and unreviewed behavior changes | Do not use |

## Upgrade Steps

### 1. Install Node.js 24.18.1

**Using nvm (recommended):**
```bash
nvm install
nvm use
```

**Using official installer:**
- Download from [nodejs.org](https://nodejs.org/en/download/)
- Install Node.js 24.18.1 LTS

### 2. Install npm And npx

```bash
npm install --global npm@12.2.0
npm --version   # Should show 12.2.0
npx --version   # Should show 12.2.0
```

Do not install `npx` separately. npm owns and installs the matching `npx`
binary.

### 3. Verify Installation

```bash
node --version  # Should show v24.18.1
npm --version   # Should show 12.2.0
npx --version   # Should show 12.2.0
```

### 4. Install Locked Dependencies

```bash
# Repository tooling
npm ci

# Server dependencies
npm --prefix server ci

# Client dependencies
npm --prefix client ci
```

Do not delete committed lockfiles during a runtime upgrade. `npm ci` installs
the reviewed dependency graph exactly and fails if a lockfile is inconsistent
with its package manifest.

Each workspace enforces `strict-allow-scripts=true`. The server permits the
reviewed `bcrypt@6.0.0` installer; other current dependency installers are
explicitly denied. A new installer/version requires review rather than a
blanket bypass. See the [install-script policy](maintenance.md#dependency-install-scripts).

### 5. Run Tests

```bash
# From the repository root
npm test
npm run lint
npm run typecheck
npm --prefix server run test:integration
```

### 6. Verify Development Environment

```bash
# Start dev servers
npm --prefix server run dev
npm --prefix client run dev
```

## Troubleshooting

### Native Module Build Errors

If you encounter errors building native modules (especially bcrypt):

```bash
npm --prefix server rebuild bcrypt
```

The reviewed installer selects a compatible prebuilt binding or falls back to
a native build. Install the platform's Python/C++ build prerequisites if a
fallback is required. Do not pass `--build-from-source` to npm 12: npm rejects
unknown configuration flags. Do not bypass the install-script policy.

### VS Code ESLint DEP0190

The Windows extension's global npm lookup can emit this warning even when
project linting succeeds. See the [confirmed cause and upstream report](development-tooling-deprecations.md).
Changing Classifarr's npm pin does not repair the extension's bundled code.

### Test Failures

If tests fail with "unknown option" errors:
- Ensure you're running Node.js 24.18.1 and npm/npx 12.2.0
- Run `npm ci` in the affected workspace

### macOS Issues

Node.js 24 requires macOS 13.5 or newer. If on older macOS:
- Upgrade your OS, or
- Use Docker for development

## Breaking Changes from Node.js 20/22

See the [official migration guide](https://nodejs.org/en/blog/migrations/v22-to-v24) for details:

- Stricter crypto policies (OpenSSL 3.5)
- Enhanced API validation
- Platform support changes

## References

- [Node.js Release Schedule](https://nodejs.org/en/about/previous-releases)
- [Node.js Downloads](https://nodejs.org/en/download/)
- [Node.js v22 → v24 Migration Guide](https://nodejs.org/en/blog/migrations/v22-to-v24)
- [npm CLI version policy](https://docs.npmjs.com/about-npm-versions/)
- [npm package engines documentation](https://docs.npmjs.com/cli/configuring-npm/package-json/)
- [GitHub Actions Node.js CI guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [PR #293: Node.js v20 compatibility fix](https://github.com/cloudbyday90/Classifarr/pull/293)
