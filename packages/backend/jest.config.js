/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transformIgnorePatterns: ['/node_modules/(?!(.*@scure.*|.*otplib.*|.*@otplib.*|.*@noble.*)/)'],
};
