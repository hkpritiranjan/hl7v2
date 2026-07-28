// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefer `const` over `let` wherever possible
      'prefer-const': 'error',
      // Disallow console.log in library code
      'no-console': 'error',
      // TypeScript strictness
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // Disable: '|string' in unions is intentional for HL7 soft-enums (autocomplete + forward compat)
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      // Disable: useless constructors are intentional subclass boilerplate for IDE discoverability
      '@typescript-eslint/no-useless-constructor': 'off',
      // Allow numbers in template literals — `${port}` and `${timeout}ms` are idiomatic
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Disable: declare-interface + class merging is the standard pattern for typed EventEmitter subclasses
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
    },
  },
  {
    // Relax rules in test files — expect().toBe() patterns are idiomatic
    files: ['src/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
);
