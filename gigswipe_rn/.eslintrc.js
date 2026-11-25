module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['web/dist/', 'web/scripts/', 'android/', 'ios/'],
  overrides: [
    {
      // Web-only code runs in the browser
      files: ['web/**/*.{ts,tsx,js,mjs}', '**/*.web.{ts,tsx}'],
      env: { browser: true },
    },
    {
      files: ['web/vite.config.ts', 'web/scripts/**/*.mjs'],
      env: { node: true },
    },
  ],
};
