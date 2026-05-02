# Test Coverage Guide

## Running Tests

### All Tests
```bash
# Root (runs both server + client)
npm test

# Server only
cd server && npm test

# Client only
cd client && npm test
```

### With Coverage
```bash
# Full coverage report
npm run test:coverage

# Server coverage
cd server && npm run test:coverage

# Client coverage
cd client && npm run test:coverage
```

### Unit vs Integration
```bash
# Server unit tests
cd server && npm run test:unit

# Server integration tests
cd server && npm run test:integration

# With coverage
cd server && npm run test:coverage:unit
cd server && npm run test:coverage:integration
```

Integration log interpretation:
- See `docs/testing/integration-log-inventory.md` for the current baseline of
  expected warning/error output from a passing server integration run.
- Do not suppress warning/error lines by default just to make output quieter;
  some of them are the evidence that negative-path integration coverage is
  executing as intended.

## Coverage Thresholds

**Server Jest thresholds (enforced in `server/jest.config.js`):**

| Metric | Threshold |
|--------|-----------|
| Lines | 40% |
| Functions | 58% |
| Branches | 70% |
| Statements | 40% |

These values are intentionally aligned to current reality so CI remains stable.
Coverage improvement is enforced by the ratchet described below.

## CI Integration

Tests run automatically on:
- Pull requests
- Pushes to `main`
- Manual workflow dispatch

**CI Commands:**
```bash
npm run test:ci
```

This now runs:
1. `npm run test:ci:server`
2. `npm run test:ci:client`
3. `npm run coverage:ratchet:check` (fails only on regression)

**Test Guardrails:**
```bash
node scripts/check-test-console-spies.mjs
```

**Coverage Reports:**
- HTML: `server/coverage/index.html`
- LCOV: `server/coverage/lcov.info`
- JSON Summary: `server/coverage/coverage-summary.json`

## Coverage Ratchet (No Regression Guard)

Baseline file:
- `docs/testing/coverage-baseline.json`

Commands:
```bash
# Verify coverage has not regressed vs baseline
npm run coverage:ratchet:check

# Intentionally refresh baseline after approved coverage changes
npm run coverage:ratchet:update
```

If `coverage:ratchet:check` fails and the drop is expected, run
`npm run coverage:ratchet:update` and commit the updated baseline.

In GitHub Actions, the ratchet emits `::error` annotations and writes a
markdown summary table to the workflow step summary.

## Viewing Coverage Locally

```bash
# Generate coverage
cd server && npm run test:coverage

# Open HTML report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## Coverage Delta Check

```bash
# Run before changes
npm run test:coverage
cp server/coverage/coverage-summary.json baseline.json

# Make changes, run again
npm run test:coverage

# Compare
diff baseline.json server/coverage/coverage-summary.json
```

## Writing Tests

### Test Location
- **Unit tests:** `server/src/__tests__/unit/<module>.test.js`
- **Integration tests:** `server/src/__tests__/integration/<feature>.test.js`
- **Frontend tests:** `client/src/__tests__/<component>.test.js`

### Best Practices
1. Mock external dependencies (database, APIs)
2. Use descriptive test names: `it('should return 404 when library not found')`
3. Test happy path + error cases
4. For expected console output, use `consoleHelpers` and assert on messages
5. Only suppress console output when it is not part of test intent
6. Clean up mocks in `afterEach()`

### Example Test Template
```javascript
const { mockLogger, clearLoggerMocks } = require('../setup/mockLogger');
const { withConsoleSpy } = require('../setup/consoleHelpers');

describe('Feature Name', () => {
  beforeEach(() => {
    clearLoggerMocks();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('should handle success case', async () => {
    // Arrange
    const input = { /* ... */ };
    
    // Act
    const result = await myFunction(input);
    
    // Assert
    expect(result).toEqual(expectedOutput);
  });
  
  it('should handle error case gracefully', async () => {
    // Test error handling
  });

  it('should log expected warning', async () => {
    await withConsoleSpy('warn', async ({ getMessages }) => {
      // Act
      await myFunctionThatWarns();

      // Assert
      expect(getMessages()).toContain('Expected warning');
    });
  });
});
```

## Troubleshooting

### Tests Timing Out
```bash
# Increase timeout
jest --testTimeout=10000
```

### Coverage Not Updating
```bash
# Clear Jest cache
cd server && npx jest --clearCache
```

### Logger Noise in Tests
```javascript
// Use mockLogger from setup
const { mockLogger } = require('../setup/mockLogger');
```

If the log output is part of the behavior under test, use:
```javascript
const { withConsoleSpy } = require('../setup/consoleHelpers');
```

### Expected Logs (Integration Tests)
- `LegacyMigration` emits error logs when preset validation fails (missing or unauthorized presets). These are asserted in integration tests and are expected.
- `MigrationRoute` emits error logs for the same preset validation failures (404/403 paths).
- `mediaSync` emits a warning when a library sync is attempted for a missing library ID in negative-path tests.

## References
- Jest Documentation: https://jestjs.io/
- Vitest Documentation: https://vitest.dev/
- Coverage Thresholds: `server/jest.config.js` → `coverageThreshold`
