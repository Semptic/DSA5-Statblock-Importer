import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Foundry VTT globals
        game: 'readonly',
        ui: 'readonly',
        Hooks: 'readonly',
        Actor: 'readonly',
        Dialog: 'readonly',
        FormApplication: 'readonly',
        $: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
]
