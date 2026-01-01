# Changelog

All notable changes to Rermius will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-01

### Added
- **Context Menu System**: New reusable context menu component system
  - `ContextMenu` component with viewport overflow detection and smart positioning
  - `ContextMenuItem` with icon, label, shortcut, and submenu support
  - `ContextMenuSubmenu` for nested menu structures
  - `ContextMenuDivider` for visual separation
  - Automatic viewport boundary detection and position adjustment
  - Keyboard navigation support (Arrow keys, Enter, Escape)
  - Click outside to close functionality

- **Context Menu Integration**: Context menus added to key management areas
  - **Host Management**: Right-click context menu on host items
    - Quick Connect action
    - Duplicate Host functionality
    - Edit, Delete, and other host operations
  - **Snippet Management**: Right-click context menu on snippet items
    - Export snippet functionality
    - Run, Paste, Edit, Delete actions
  - **Keychain**: Context menu integration for key management
    - Enhanced key operations with right-click access

- **Host Duplication**: New feature to duplicate existing hosts
  - Accessible via context menu or action buttons
  - Creates a copy of host configuration for quick setup
  - Integrated with host management services

- **Snippet Export**: New feature to export snippets
  - Export individual snippets via context menu
  - Useful for backup and sharing snippet configurations

### Changed
- **Code Quality Improvements**: Enhanced code quality and maintainability
  - Changed `let` to `const` for props that are never reassigned across multiple components
  - Improved code clarity and consistency
  - Better adherence to JavaScript best practices
  - Affected components:
    - File browser components (AddressBar, FileContextMenu, FileListHeader, EmptyAreaContextMenu)
    - Settings components (SettingsModal, ShellPreferencesPanel, ShortcutsPanel)
    - Snippet components (SnippetItem, SnippetPageList, SnippetSidebarList, SnippetToggleBar)
    - Terminal components (RemoteTerminalContainer)
    - Layout components (AppLayout)
    - Keychain components (KeyScanFileItem, KeyScanProgress)
    - Host components (ImportHostItem)

- **Group Management Refactoring**: Streamlined group management
  - Removed color property from GroupPanel and related services
  - Simplified group form handling and auto-save logic
  - Cleaner group management interface

- **Svelte 5 Compliance**: Full compliance with Svelte 5 requirements
  - Added missing keys to all `{#each}` blocks for better reactivity
  - Improved performance when lists change
  - Better component lifecycle management
  - Fixed Svelte 5 warnings across the codebase

### Fixed
- **Svelte 5 Warnings**: Fixed all Svelte 5 warnings about missing keys in iteration blocks
  - `FileListHeader.svelte` - Added keys for column iteration
  - `ShortcutInput.svelte` - Added keys for key parts display
  - `ShellSelect.svelte` - Added keys for options list
  - `ShortcutsPanel.svelte` - Added keys for categories and actions
  - `SettingsModal.svelte` - Added keys for panels list
  - `ShellPreferencesPanel.svelte` - Added keys for shells list
  - `FileContextMenu.svelte` - Added keys for menu items
  - `AddressBar.svelte` - Added keys for history items
  - And other components throughout the codebase

- **ESLint Warnings**: Fixed ESLint warnings about variable declarations
  - Changed unnecessary `let` declarations to `const` where appropriate
  - Improved code consistency across components

### Technical
- Enhanced Svelte 5 compatibility and best practices
- Improved component reactivity and performance with proper key usage
- Better code maintainability with proper const usage
- New reusable context menu system for consistent UI patterns
- Improved user interaction patterns with context menus
- Better service layer organization for host and snippet operations

### Statistics
- **36 files changed**
- **859 insertions(+), 107 deletions(-)**
- **4 new component files** (ContextMenu system)
- **Multiple service enhancements** (hosts.js, keychain.js, snippets.js)

---

## [1.0.9] - Previous Release

### Features
- Multiple terminal sessions with tab management
- SSH host management with groups and colors
- SSH config import functionality
- Multiple authentication methods
- File browser integration
- Command snippets
- Multi-workspace support
- Auto-reconnect with configurable retry settings
- IME support for Vietnamese, Chinese, Japanese input methods
- Theme-aware modern dark theme
- xterm.js with WebGL-accelerated terminal
- Security-first encrypted credential storage

