const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zustand's ESM build (esm/middleware.mjs) uses `import.meta.env.MODE`
// which is a Vite-only convention. Browsers throw:
//   "Uncaught SyntaxError: import.meta may only appear in a module"
//
// Metro resolves package.json "exports" using `unstable_conditionNames`.
// Adding "react-native" makes zustand resolve to its CJS build (which
// doesn't use import.meta), because zustand maps the "react-native"
// condition to its CJS files. Other packages without a "react-native"
// condition are unaffected — they fall through to "require"/"import".
config.resolver.unstable_conditionNames = [
  'react-native',
  'require',
  'import',
];

module.exports = config;
