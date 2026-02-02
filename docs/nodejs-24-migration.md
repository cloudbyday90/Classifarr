# Migrating to Node.js 24.11.0 LTS

This guide helps developers upgrade their local environment to Node.js 24.11.0 LTS.

## Why Upgrade?

- **Production Consistency**: Our Docker containers are standardized on Node.js 24.11.0
- **CI/CD Alignment**: GitHub Actions now requires Node.js 24.11.0+
- **Modern Features**: Leverage stability improvements and new APIs
- **Test Compatibility**: Our test runners use Node.js 24+ flags

## Upgrade Steps

### 1. Install Node.js 24.11.0

**Using nvm (recommended):**
```bash
nvm install 24.11.0
nvm use 24.11.0
nvm alias default 24.11.0  # Set as default
```

**Using official installer:**
- Download from [nodejs.org](https://nodejs.org/en/download/)
- Install Node.js 24.11.0 LTS

### 2. Verify Installation

```bash
node --version  # Should show v24.11.0 or higher
npm --version   # Should show v10.0.0 or higher
```

### 3. Clean and Reinstall Dependencies

```bash
# Server dependencies
cd server
rm -rf node_modules package-lock.json
npm install

# Rebuild native modules (important for bcrypt, etc.)
npm rebuild bcrypt

# Client dependencies
cd ../client
rm -rf node_modules package-lock.json
npm install
```

### 4. Run Tests

```bash
# From repo root
npm --prefix server test
npm --prefix client test
npm --prefix server run test:integration
```

### 5. Verify Development Environment

```bash
# Start dev servers
npm --prefix server run dev
npm --prefix client run dev
```

## Troubleshooting

### Native Module Build Errors

If you encounter errors building native modules (especially bcrypt):

```bash
cd server
npm rebuild bcrypt --build-from-source
```

### Test Failures

If tests fail with "unknown option" errors:
- Ensure you're running Node.js 24.11.0+ (`node --version`)
- Clear node_modules and reinstall

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

- [Node.js 24.11.0 Release Notes](https://nodejs.org/en/blog/release/v24.11.0)
- [Node.js v22 → v24 Migration Guide](https://nodejs.org/en/blog/migrations/v22-to-v24)
- [PR #293: Node.js v20 compatibility fix](https://github.com/cloudbyday90/Classifarr/pull/293)
