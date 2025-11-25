import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'public/**',
  ]),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      prettier: prettier,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'warn',

      // TypeScript rules - override Next.js defaults
      '@typescript-eslint/no-explicit-any': [
        'warn',
        {
          ignoreRestArgs: true,
          fixToUnknown: false,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-object-type': [
        'warn',
        {
          allowInterfaces: 'always',
        },
      ],

      // React rules - override Next.js defaults
      'react/no-unescaped-entities': [
        'warn',
        {
          forbid: ['>', '}'],
        },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      // Disable setState in effect rule - valid for initialization patterns (mounted state, localStorage sync, etc.)
      'react-hooks/set-state-in-effect': 'off',

      // Next.js specific
      '@next/next/no-img-element': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Prettier config must be last to override other formatting rules
  prettierConfig,
])

export default eslintConfig
