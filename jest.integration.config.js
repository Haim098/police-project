const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.js'],
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.{ts,js}',
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testTimeout: 30000, // 30 seconds for integration tests
  collectCoverageFrom: [
    'server/**/*.{ts,js}',
    'lib/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage/integration',
  verbose: true,
}

module.exports = config 