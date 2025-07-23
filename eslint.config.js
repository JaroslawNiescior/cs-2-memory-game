import antfu from '@antfu/eslint-config'

export default antfu({
  // Enable stylistic formatting rules
  // Anthony Fu's config includes prettier-like formatting
  stylistic: {
    indent: 2, // 2 spaces
    quotes: 'single', // single quotes
    semi: false, // no semicolons
  },

  // TypeScript and Vue are auto-detected based on your dependencies
  typescript: true,
  vue: true,

  // Disable some opinionated rules that might be too strict
  rules: {
    // Allow console.log in development
    'no-console': 'warn',

    // Vue specific rules
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'warn',

    // TypeScript rules
    '@typescript-eslint/no-unused-vars': 'warn',

    // Allow any type in some cases
    '@typescript-eslint/no-explicit-any': 'warn',
  },

  // Ignore patterns
  ignores: ['dist', 'node_modules', '.output', '.nuxt', '.nitro', 'coverage'],
})
