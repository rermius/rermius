import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	// Base configs
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],

	// Global settings
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2021
			},
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: 'module'
			}
		}
	},

	// Rules for all files
	{
		files: ['**/*.{js,mjs,cjs,ts,svelte}'],
		rules: {
			// General best practices
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'no-unused-vars': 'off', // Use TypeScript version instead
			'no-undef': 'off', // TypeScript handles this
			'prefer-const': 'error',
			'no-var': 'error',

			// TypeScript rules
			'@typescript-eslint/no-unused-vars': 'off', // Disabled - too many false positives
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',

			// Svelte-specific rules (only valid rules from recommended config)
			'svelte/no-at-html-tags': 'error',
			'svelte/no-unused-svelte-ignore': 'error',
			'svelte/valid-compile': ['error', { ignoreWarnings: true }], // Ignore custom_element_props_identifier warnings
			'svelte/no-reactive-reassign': 'warn',
			'svelte/require-each-key': 'error',
			'svelte/no-reactive-functions': 'warn',
			'svelte/no-reactive-literals': 'warn',
			'svelte/no-useless-mustaches': 'warn',
			'svelte/no-dom-manipulating': 'warn',
			'svelte/no-dupe-style-properties': 'error',
			'svelte/no-dynamic-slot-name': 'error',
			'svelte/no-inner-declarations': 'error',
			'svelte/no-not-function-handler': 'error',
			'svelte/no-shorthand-style-property-overrides': 'error',
			'svelte/no-unknown-style-directive-property': 'error',
			'svelte/no-unused-class-name': 'off', // Too many false positives with Tailwind JIT
			'svelte/valid-each-key': 'error'
		}
	},

	// JavaScript/TypeScript files only
	{
		files: ['**/*.{js,mjs,cjs,ts}'],
		rules: {
			'@typescript-eslint/no-var-requires': 'off' // Allow require in JS files
		}
	},

	// Svelte files only
	{
		files: ['**/*.svelte'],
		rules: {
			// Disable some rules that don't work well with Svelte
			'no-inner-declarations': 'off',
			'@typescript-eslint/no-unused-vars': 'off', // Svelte handles this differently
			// Allow 'let' for props with $bindable() - they need to be mutable for binding
			'prefer-const': ['error', { destructuring: 'all', ignoreReadBeforeAssign: false }]
		}
	},

	// Ignore patterns
	{
		ignores: [
			'**/build/**',
			'**/.svelte-kit/**',
			'**/node_modules/**',
			'**/dist/**',
			'**/target/**',
			'**/.tauri/**',
			'**/gen/**',
			'**/*.config.js',
			'**/vite.config.js',
			'**/postcss.config.js',
			'**/tailwind.config.js'
		]
	},

	// Prettier config (must be last to override other configs)
	prettier,
	...svelte.configs['flat/prettier']
];
