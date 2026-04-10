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
        Application: 'readonly',
        Dialog: 'readonly',
        FormApplication: 'readonly',
        foundry: 'readonly',
        fromUuid: 'readonly',
        $: 'readonly',
        // Browser globals
        HTMLElement: 'readonly',
        document: 'readonly',
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
