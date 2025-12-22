module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/integration/**/*.test.js'],
    setupFilesAfterEnv: ['./src/__tests__/integration/setup.js'],
    verbose: true,
    // Ensure we don't automatically mock everything if verify is used elsewhere
    automock: false,
};
