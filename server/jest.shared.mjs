export const baseJestConfig = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  silent: process.env.CLASSIFARR_TEST_VERBOSE === '1' ? false : true,
  verbose: true,
};

export default baseJestConfig;
