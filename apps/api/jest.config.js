const base = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // jose v6 is ESM-only. Node >= 22.12 loads it natively at runtime, but Jest's
  // module runtime cannot, so it is transpiled to CommonJS for tests.
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }] },
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
  testEnvironment: 'node',
};

module.exports = {
  projects: [
    // Pure unit tests: no database required.
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    // Integration tests against a real PostgreSQL (TEST_DATABASE_URL).
    {
      ...base,
      displayName: 'db',
      testMatch: ['<rootDir>/test/db/**/*.spec.ts'],
      globalSetup: '<rootDir>/test/db/global-setup.ts',
      // Booting the full Nest app (and generating RSA keys) can exceed Jest's
      // 5 s default on a cold ts-jest cache.
      testTimeout: 60000,
    },
  ],
};
