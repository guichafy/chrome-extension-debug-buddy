import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'vite.config.mts', 'jest.config.cjs', 'postcss.config.cjs', 'tailwind.config.cjs', 'eslint.config.js', 'jest.setup.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
      },
    },
    rules: {
       'no-unused-vars': 'off',
       '@typescript-eslint/no-unused-vars': 'off',
       '@typescript-eslint/no-explicit-any': 'off',
       'no-undef': 'error',
       'require-jsdoc': 'off'
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
