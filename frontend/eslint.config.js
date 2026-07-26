const tsParser = require('@typescript-eslint/parser');
const nextConfig = require('eslint-config-next/core-web-vitals');

const REACT_VERSION = '18.3.1';

// Replace the babel parser (element 0) with @typescript-eslint/parser which is
// compatible with ESLint v10's scopeManager.addGlobals API requirement.
const patchedNextConfig = nextConfig.map((entry, index) => {
  if (index === 0) {
    return {
      ...entry,
      languageOptions: {
        ...entry.languageOptions,
        parser: tsParser,
        parserOptions: {
          sourceType: 'module',
          ecmaFeatures: { jsx: true },
          project: false,
        },
      },
      settings: {
        ...entry.settings,
        react: { version: REACT_VERSION },
      },
    };
  }
  return entry;
});

// React Compiler-specific rules from react-hooks v7 that apply only to projects
// using the React Compiler. This project does not use the React Compiler, so
// these rules are disabled to match the original pre-v10 lint behaviour.
const reactCompilerRulesOff = {
  'react-hooks/config': 'off',
  'react-hooks/error-boundaries': 'off',
  'react-hooks/gating': 'off',
  'react-hooks/globals': 'off',
  'react-hooks/immutability': 'off',
  'react-hooks/incompatible-library': 'off',
  'react-hooks/preserve-manual-memoization': 'off',
  'react-hooks/purity': 'off',
  'react-hooks/refs': 'off',
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/set-state-in-render': 'off',
  'react-hooks/static-components': 'off',
  'react-hooks/unsupported-syntax': 'off',
  'react-hooks/use-memo': 'off',
};

module.exports = [
  { ignores: ['.next/**', 'node_modules/**', 'node_modules_stale_*/**'] },
  ...patchedNextConfig,
  {
    settings: {
      react: { version: REACT_VERSION },
    },
    rules: {
      ...reactCompilerRulesOff,
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react/no-unescaped-entities': 'error',
      '@next/next/no-img-element': 'warn',
      'import/no-anonymous-default-export': 'warn',
    },
  },
];
