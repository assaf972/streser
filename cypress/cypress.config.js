const { defineConfig } = require('cypress');

module.exports = defineConfig({
    e2e: {
        baseUrl: process.env.CYPRESS_BASE_URL || process.env.BASE_URL || 'https://perf.labguru.com',
        specPattern: 'e2e/**/*.cy.js',
        fixturesFolder: 'fixtures',
        supportFile: 'support/e2e.js',
        video: true,
        screenshotOnRunFailure: true,
        defaultCommandTimeout: 30000,
        pageLoadTimeout: 60000,
        responseTimeout: 120000,
        viewportWidth: 1440,
        viewportHeight: 900,
        retries: {
            runMode: 2,
            openMode: 0,
        },
    },
});
