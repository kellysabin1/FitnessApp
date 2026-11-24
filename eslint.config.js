// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig, // formatting is Prettier's job; ESLint only catches real problems
  {
    // Playwright fixtures call a function named `use`; it isn't a React hook
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    ignores: [
      'dist-e2e/*',
      'dist/*',
      'server/dist/*',
      'node_modules/*',
      'server/node_modules/*',
      '.expo/*',
      'expo-env.d.ts',
      'test-results/*',
      'playwright-report/*',
    ],
  },
]);
