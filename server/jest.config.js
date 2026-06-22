module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/jest.setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js"],
  coveragePathIgnorePatterns: ["/node_modules/", "src/server.js"],
  verbose: true,
};
