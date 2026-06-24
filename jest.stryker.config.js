// Jest config used exclusively by Stryker mutation runs.
// Mirrors the main config but removes the jest-html-reporters reporter
// so Stryker does not generate a test report on every mutant execution.
const { jest: base } = require('./package.json');

module.exports = {
  ...base,
  reporters: ['default'],
};
