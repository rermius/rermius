/**
 * Terminal Utilities - Barrel Export
 * Pure utility functions for terminal operations (theme, events, exit handlers)
 *
 * Note: These are NOT composables (no Svelte runes/reactive state)
 * For terminal composable, see: $lib/composables/useXtermTerminal.svelte.js
 */

export * from './theme-and-events.js';
export * from './exit-handlers.js';
