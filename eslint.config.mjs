import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import unusedImports from 'eslint-plugin-unused-imports'

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
      'unused-imports': unusedImports,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'warn',

      // Unused imports - AUTO-FIXABLE via eslint --fix
      // Turn off the base rule as it conflicts with unused-imports
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      // Use unused-imports plugin which can auto-fix unused imports
      'unused-imports/no-unused-imports': 'warn',
      // Disable unused vars check - can't be safely auto-fixed (variables might have side effects)
      'unused-imports/no-unused-vars': 'off',

      // TypeScript rules - override Next.js defaults
      // Disabled - can't be auto-fixed (requires manual type annotations)
      '@typescript-eslint/no-explicit-any': 'off',
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
      // Disabled - can't be auto-fixed (requires changing <a> to <Link />)
      '@next/next/no-html-link-for-pages': 'off',

      // General
      // Disabled - can't be auto-fixed (requires manual removal)
      'no-console': 'off',
    },
  },
  // Prettier config must be last to override other formatting rules
  prettierConfig,
])

export default eslintConfig
