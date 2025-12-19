module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/**/__tests__/**'
  ],
  testMatch: [
    '**/src/**/__tests__/**/*.test.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
  verbose: true
};
