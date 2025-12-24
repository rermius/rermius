# CLAUDE.md

This document provides context and guidelines for working with the rerminus codebase.

## Project Overview

**rerminus** is a desktop SSH terminal management application built with:

- **Frontend**: SvelteKit 5 + Tailwind CSS 4
- **Backend**: Tauri 2 (Rust)
- **Terminal**: xterm.js
- **Build Tool**: Vite

## Project Structure

```
rerminus/
├── src/                    # Frontend SvelteKit application
│   ├── lib/
│   │   ├── components/     # Reusable Svelte components
│   │   │   ├── features/   # Feature-specific components
│   │   │   ├── forms/      # Form components
│   │   │   ├── layout/     # Layout components
│   │   │   └── ui/         # Base UI components
│   │   ├── composables/    # Svelte composables (hooks)
│   │   ├── constants/      # Constants and configuration
│   │   ├── services/       # Business logic and API services
│   │   ├── stores/         # Svelte stores (state management)
│   │   ├── theme/          # Theme configuration
│   │   └── utils/          # Utility functions
│   └── routes/             # SvelteKit file-based routing
├── src-tauri/              # Tauri Rust backend
│   ├── src/
│   │   ├── ssh/            # SSH connection handling
│   │   └── terminal/       # Terminal session management
│   └── tauri.conf.json     # Tauri configuration
└── static/                 # Static assets (icons, images)
```

## Key Technologies & Patterns

### Frontend Stack

- **Svelte 5**: Using runes and modern Svelte patterns
- **SvelteKit**: File-based routing, server-side capabilities
- **Tailwind CSS 4**: Utility-first CSS framework
- **xterm.js**: Terminal emulator for web

### Backend Stack

- **Tauri 2**: Desktop app framework
- **Rust**: Backend language for SSH and terminal operations

### State Management

- **Svelte Stores**: For global state (app, hosts, terminal, theme, etc.)
- **Composables**: Reusable reactive logic (useForm, useModal, useToast, etc.)

## Code Organization Patterns

### Components

- **Feature Components** (`src/lib/components/features/`): Organized by feature domain
  - `hosts/`: Host management UI
  - `keychain/`: SSH key management
  - `terminal/`: Terminal interface
  - `port-forwarding/`: Port forwarding UI
  - `snippets/`: Code snippets
  - `sync/`: Sync settings
  - `logs/`: Log viewing

- **UI Components** (`src/lib/components/ui/`): Reusable base components
  - Each component has its own directory with `index.js` for exports
  - Components follow a consistent naming pattern (e.g., `Button.svelte`, `Modal.svelte`)

- **Layout Components** (`src/lib/components/layout/`): App structure components
  - `AppLayout.svelte`: Main app layout
  - `Sidebar.svelte`: Navigation sidebar
  - `Header.svelte`: App header

### Services

Services handle business logic and Tauri command invocations:

- `hosts.js`: Host management operations
- `keychain.js`: SSH key operations
- `ssh-connection.js`: SSH connection handling
- `storage/`: Storage abstraction (local storage, file storage)
- `tauri/`: Tauri API wrappers

### Composables

Reusable reactive logic following the `use*` naming pattern:

- `useForm.svelte.js`: Form state and validation
- `useModal.svelte.js`: Modal state management
- `useToast.svelte.js`: Toast notifications
- `useTerminal.svelte.js`: Terminal operations
- `useHostConnection.svelte.js`: Host connection logic
- `useTauri.svelte.js`: Tauri API utilities

### Stores

Svelte stores for global state:

- `app.store.js`: Application-wide state
- `host-draft.store.js`: Host draft state
- `tabs.store.js`: Tab management
- `terminal.store.js`: Terminal state
- `theme.store.js`: Theme preferences
- `toast.store.js`: Toast notifications
- `sync-settings.store.js`: Sync configuration

## Naming Conventions

- **Components**: PascalCase (e.g., `HostManagementLayout.svelte`)
- **Files**: kebab-case for utilities, PascalCase for components
- **Composables**: camelCase with `use` prefix (e.g., `useForm.svelte.js`)
- **Stores**: kebab-case with `.store.js` suffix
- **Services**: kebab-case (e.g., `ssh-connection.js`)

## Important Files

### Configuration

- `jsconfig.json`: JavaScript/TypeScript configuration
- `vite.config.js`: Vite build configuration
- `svelte.config.js`: SvelteKit configuration
- `tailwind.config.js`: Tailwind CSS configuration
- `src-tauri/tauri.conf.json`: Tauri app configuration

### Constants

- `src/lib/constants/routes.js`: Route definitions
- `src/lib/constants/storage-keys.js`: LocalStorage key constants
- `src/lib/constants/validation-rules.js`: Form validation rules
- `src/lib/constants/ssh-config.js`: SSH configuration constants

## Development Workflow

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run check`: Type-check Svelte code
- `npm run tauri`: Tauri CLI commands (dev, build, etc.)

### Tauri Development

- Frontend runs on Vite dev server
- Tauri backend runs Rust code
- Use Tauri commands to bridge frontend/backend

## Code Style Guidelines

1. **Svelte Components**: Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
2. **Imports**: Use barrel exports via `index.js` files
3. **Styling**: Use Tailwind utility classes, avoid inline styles
4. **State**: Prefer stores for global state, local state for component-specific
5. **Error Handling**: Use error handler utilities from `src/lib/utils/error-handler.js`
6. **Form Validation**: Use validation utilities from `src/lib/utils/validators.js`

## Feature Areas

### Host Management

- Add, edit, remove SSH hosts
- Group hosts
- Connection management

### Keychain

- SSH key management
- Key selection for connections

### Terminal

- Multiple terminal sessions
- Tab management
- xterm.js integration

### Port Forwarding

- Local/remote port forwarding configuration

### Snippets

- Code snippet management

### Sync

- Settings synchronization

## Tauri Integration

- Tauri commands are defined in `src-tauri/src/`
- Frontend invokes commands via `src/lib/services/tauri/commands.js`
- File system operations use `@tauri-apps/plugin-fs`
- Dialogs use `@tauri-apps/plugin-dialog`

## Feature Development Rules - Avoid Common Mistakes

### ⚠️ Critical Rules

1. **Svelte 5 Syntax - NEVER Use Deprecated Patterns**
   - ❌ **NEVER** use `on:click` on native HTML elements - use `onclick` instead
   - ❌ **NEVER** use `let:` for two-way binding - use `bind:` instead
   - ❌ **NEVER** use `$:` reactive statements for simple state - use `$state()` runes
   - ✅ **ALWAYS** use `$state()`, `$derived()`, `$effect()` for reactive state
   - ✅ **ALWAYS** use `onclick`, `oninput`, `onchange` for native element events
   - ✅ **ALWAYS** use `bind:value` for two-way data binding

2. **Accessibility Requirements**
   - ❌ **NEVER** use `on:click` on non-interactive elements without keyboard handlers
   - ✅ **ALWAYS** add `onkeydown` handler when using clickable divs/spans
   - ✅ **ALWAYS** use proper semantic HTML (`<button>`, `<label>`, etc.)
   - ✅ **ALWAYS** associate labels with form controls using `for` attribute or wrap input in label
   - ✅ **ALWAYS** add `role="button"` and `tabindex="0"` for clickable non-button elements
   - ✅ **ALWAYS** handle Enter and Space keys for keyboard accessibility

3. **Component Organization**
   - ❌ **NEVER** create new UI components without checking `components/ui/` first
   - ❌ **NEVER** put feature-specific components in `components/ui/`
   - ❌ **NEVER** create duplicate functionality - check existing components/services first
   - ✅ **ALWAYS** place feature components in `components/features/[feature-name]/`
   - ✅ **ALWAYS** use existing UI components from `components/ui/` when possible
   - ✅ **ALWAYS** create `index.js` barrel exports for component directories

4. **State Management**
   - ❌ **NEVER** create new stores without checking if similar store exists
   - ❌ **NEVER** use local component state for data that should be global
   - ❌ **NEVER** mutate store values directly - use store methods
   - ✅ **ALWAYS** use stores for cross-component state
   - ✅ **ALWAYS** use `$store` syntax to subscribe to stores
   - ✅ **ALWAYS** use store update methods instead of direct mutation

5. **Error Handling**
   - ❌ **NEVER** silently swallow errors - always log or show user feedback
   - ❌ **NEVER** use `console.error` without user-facing error message
   - ✅ **ALWAYS** use `toast.error()` for user-facing errors
   - ✅ **ALWAYS** wrap async operations in try-catch blocks
   - ✅ **ALWAYS** use error handler utilities from `src/lib/utils/error-handler.js`

6. **Form Validation**
   - ❌ **NEVER** skip client-side validation
   - ❌ **NEVER** hardcode validation rules - use constants/utilities
   - ✅ **ALWAYS** validate forms before submission
   - ✅ **ALWAYS** show inline error messages using `FieldError` component
   - ✅ **ALWAYS** use validation utilities from `src/lib/utils/validators.js`
   - ✅ **ALWAYS** use `useForm` composable for form state management

7. **Styling Guidelines**
   - ❌ **NEVER** use inline styles - use Tailwind classes
   - ❌ **NEVER** create custom CSS files without checking Tailwind config
   - ❌ **NEVER** use hardcoded colors - use theme tokens
   - ✅ **ALWAYS** use Tailwind utility classes
   - ✅ **ALWAYS** use theme colors from `src/lib/theme/tokens.js`
   - ✅ **ALWAYS** maintain consistent spacing using Tailwind scale

8. **File Organization**
   - ❌ **NEVER** create files in wrong directories
   - ❌ **NEVER** skip creating `index.js` for component directories
   - ❌ **NEVER** use inconsistent naming conventions
   - ✅ **ALWAYS** follow the existing directory structure
   - ✅ **ALWAYS** use PascalCase for component files
   - ✅ **ALWAYS** use kebab-case for utility/service files
   - ✅ **ALWAYS** create barrel exports (`index.js`) for directories

9. **Constants and Configuration**
   - ❌ **NEVER** hardcode strings/numbers that should be constants
   - ❌ **NEVER** create new constant files without checking existing ones
   - ✅ **ALWAYS** use constants from `src/lib/constants/` files
   - ✅ **ALWAYS** add new constants to appropriate existing files
   - ✅ **ALWAYS** use `storage-keys.js` for LocalStorage keys

10. **Tauri Integration**
    - ❌ **NEVER** call Tauri APIs directly - use service wrappers
    - ❌ **NEVER** skip error handling for Tauri commands
    - ✅ **ALWAYS** use Tauri services from `src/lib/services/tauri/`
    - ✅ **ALWAYS** handle async Tauri operations with try-catch
    - ✅ **ALWAYS** check if Tauri command exists before using

11. **Code Quality Checks**
    - ❌ **NEVER** commit code with linter warnings
    - ❌ **NEVER** ignore Svelte compiler warnings
    - ✅ **ALWAYS** run `npm run check` before committing
    - ✅ **ALWAYS** fix all accessibility warnings
    - ✅ **ALWAYS** fix all deprecation warnings

### ✅ Best Practices Checklist

Before submitting any feature code, verify:

- [ ] All Svelte 5 syntax is correct (no deprecated patterns)
- [ ] All accessibility requirements are met (keyboard handlers, semantic HTML)
- [ ] Components are in correct directories (features vs ui vs layout)
- [ ] State management uses appropriate stores/composables
- [ ] Error handling is implemented with user feedback
- [ ] Form validation is complete with inline errors
- [ ] Styling uses Tailwind classes and theme tokens
- [ ] File naming follows conventions
- [ ] Constants are used instead of magic strings/numbers
- [ ] Tauri operations use service wrappers
- [ ] No linter warnings or errors
- [ ] Code follows existing patterns in similar features

### 🔍 Before Starting a Feature

1. **Search existing codebase** for similar functionality
2. **Check existing components** in `components/ui/` and `components/features/`
3. **Review similar features** to understand patterns
4. **Check stores** to see if state management already exists
5. **Check services** to see if API/service layer exists
6. **Check constants** to see if configuration exists

### 📝 Code Review Checklist

When reviewing or writing feature code, ensure:

- Follows Svelte 5 patterns (runes, not reactive statements)
- Accessible (keyboard navigation, semantic HTML, ARIA)
- Uses existing components/services/stores when possible
- Error handling with user feedback
- Consistent with codebase patterns
- No hardcoded values (use constants)
- Proper file organization and naming
- No linter warnings

## Notes for AI Assistants

- When adding new features, follow existing patterns in the `features/` directory
- Use existing UI components from `components/ui/` when possible
- Leverage composables for reusable logic
- Store global state in appropriate stores
- Use constants files for magic strings/numbers
- Follow the existing file organization structure
- Check `src/lib/utils/` for existing utility functions before creating new ones
- **ALWAYS** refer to the "Feature Development Rules" section above before making changes
