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

## Coverage Thresholds

**Current Baselines (v0.41.0-alpha):**

| Metric | Server | Client | Target |
|--------|--------|--------|--------|
| Lines | 80% | 75% | 80% |
| Functions | 75% | 70% | 75% |
| Branches | 70% | 65% | 70% |
| Statements | 80% | 75% | 80% |

## CI Integration

Tests run automatically on:
- Pull requests
- Pushes to `main`
- Manual workflow dispatch

**CI Commands:**
```bash
npm run test:ci
```

**Coverage Reports:**
- HTML: `server/coverage/index.html`
- LCOV: `server/coverage/lcov.info`
- JSON Summary: `server/coverage/coverage-summary.json`

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
4. Suppress expected error logs using `mockLogger`
5. Clean up mocks in `afterEach()`

### Example Test Template
```javascript
const { mockLogger, clearLoggerMocks } = require('../setup/mockLogger');

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

## References
- Jest Documentation: https://jestjs.io/
- Vitest Documentation: https://vitest.dev/
- Coverage Thresholds: `server/jest.config.js` → `coverageThreshold`
