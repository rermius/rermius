# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rermius is a modern SSH terminal management application built with Tauri 2 (Rust backend) + SvelteKit 5 (JavaScript frontend). It provides terminal emulation, SSH connection management, SFTP/FTP file transfers, and workspace organization.

## Essential Commands

### Development
```bash
npm run dev              # Start Vite dev server (frontend only)
npm run tauri dev        # Start full Tauri app with hot reload
```

### Building
```bash
npm run build            # Build frontend for production
npm run tauri build      # Build full desktop application
```

### Code Quality
```bash
npm run check            # Type-check Svelte code with svelte-check
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint errors
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
```

### Platform-Specific Builds
```bash
npm run build:windows    # Build for Windows (x86_64-pc-windows-msvc)
npm run build:macos-arm  # Build for macOS ARM (aarch64-apple-darwin)
npm run build:macos-intel # Build for macOS Intel (x86_64-apple-darwin)
npm run build:linux      # Build for Linux (x86_64-unknown-linux-gnu)
```

### Rust Backend
```bash
cd src-tauri
cargo check              # Check Rust code for errors
cargo build              # Build Rust backend
cargo build --release    # Build optimized release
```

## Architecture Overview

### Frontend-Backend Communication

**Tauri Command Pattern (Request/Response):**
- Frontend calls Rust via `@tauri-apps/api/core::invoke('command_name', params)`
- Backend functions marked with `#[tauri::command]` in `src-tauri/src/commands/`
- All commands registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]`

**Event Pattern (Pub/Sub for Streaming):**
- Backend emits events: `app_handle.emit(event_name, payload)`
- Frontend subscribes: `@tauri-apps/api/event::listen(event_name, handler)`
- Used for terminal output streaming, file transfer progress, SSH chain status

**Critical Pattern - Two-Phase SSH Initialization:**
1. Frontend calls `create_ssh_session()` → returns `session_id` immediately
2. Backend buffers output in `pending_buffer`
3. Frontend sets up event listener for `terminal-output:{session_id}`
4. Frontend calls `start_terminal_streaming(session_id)` → backend flushes buffer
5. This prevents race condition where SSH data arrives before listener is ready

Local PTY sessions auto-stream because listener is set up before spawn.

### State Management

**Svelte Stores Architecture:**
- `stores/terminal.store.js` - Terminal sessions, xterm.js instances, active session
- `stores/tabs.store.js` - UI tabs, connection states (IDLE → CONNECTING → CONNECTED), auto-reconnect tracking
- `stores/status-bar.js` - File transfer progress, network status

**Service Layer:**
- `services/` contains all backend interaction logic (Facade pattern)
- `terminalCommands.js` - Terminal session operations
- `ssh-connection.js` - SSH connection establishment and chaining
- `file-browser.js` - File transfer operations
- Services abstract Tauri `invoke()` calls for cleaner, testable APIs

**Data Flow:**
```
User Action → Service → Tauri Command → Rust Backend
                ↓
         Store Update (optimistic)
                ↓
         Backend Event → Store Update (confirmation)
                ↓
         UI Re-render (reactive)
```

### Terminal Architecture

**Backend Trait Polymorphism:**
```rust
trait TerminalSession {
    fn id(&self) -> &str;
    fn session_type(&self) -> SessionType;
    async fn write(&self, data: &[u8]) -> Result<()>;
    async fn resize(&self, cols: u16, rows: u16) -> Result<()>;
    fn start_streaming(&self) {}  // SSH-specific buffering control
    async fn execute_command(&self, command: &str) -> Result<String>;
}
```

**Two Implementations:**

1. **LocalPtySession** (`pty/session.rs`):
   - Uses `portable-pty` crate for native shell (bash/zsh/powershell)
   - Background tokio task: `Read::read()` → `app_handle.emit()` loop
   - Auto-streams immediately (no buffering needed)

2. **SshTerminalSession** (`ssh/terminal.rs`):
   - Uses `russh` crate for SSH protocol
   - Opens PTY channel: `channel_open_session()` → `request_pty()` → `request_shell()`
   - Buffering architecture: stores output in `pending_buffer` until `start_streaming()` called
   - Channel I/O loop uses `tokio::select!` for concurrent operations:
     - `write_rx.recv()` → `channel.data()` (user keyboard input)
     - `resize_rx.recv()` → `channel.window_change()` (terminal resize)
     - `channel.wait()` → match ChannelMsg variants (server output)

**Session Management:**
- `TerminalManager` singleton (via Tauri state management)
- Sessions stored in `Arc<RwLock<HashMap<String, Box<dyn TerminalSession>>>>`
- UUIDs generated server-side for session IDs

**Frontend Integration:**
- `composables/useXtermTerminal.svelte.js` - xterm.js wrapper with FitAddon
- ResizeObserver for automatic PTY resize on DOM changes
- Theme-aware: reads CSS variables (`--terminal-bg`, `--terminal-fg`, etc.)
- **IME Support**: Special handling for Vietnamese/Chinese/Japanese input via textarea monitoring

### SSH Connection Flow

**Direct Connection:**
```
1. Frontend: connectSSH(host) → prepares auth (loads SSH key to temp file)
2. invoke('create_ssh_session', { hostname, port, username, authMethod, keyPath })
3. Backend: client::connect_direct() → TCP via russh
4. client::authenticate() → password/publickey auth
5. channel_open_session() → request_pty() → request_shell()
6. Spawn channel_io_loop (tokio::spawn with select! for I/O)
7. Return session_id (output buffering active)
8. Frontend: start_terminal_streaming(session_id) → flush buffer
```

**Chained Connection (ProxyJump):**
- Uses Chain of Responsibility pattern (`ssh/chain.rs`)
- Each `HopHandler` contains config + optional next handler
- Recursive `execute()` with tunnel forwarding between hops
- **TCP Bridge Pattern**: For SSH-over-SSH, spawns local TCP listener, bridges to SSH channel, connects through localhost
- Allows reusing standard `russh::client::connect()` for all hops
- Emits `ssh-chain-progress` events for UI feedback at each hop

### File Browser/SFTP Architecture

**Backend Trait:**
```rust
trait FileTransferSession {
    async fn list_directory(&self, path: &str) -> Result<Vec<FileInfo>>;
    async fn download_file_with_progress(&self, remote, local, progress) -> Result<()>;
    async fn upload_file_with_progress(&self, local, remote, progress) -> Result<()>;
    async fn create_directory(&self, path: &str) -> Result<()>;
    async fn delete(&self, path: &str, is_directory: bool) -> Result<()>;
    async fn chmod(&self, path: &str, mode: u32) -> Result<()>; // SFTP only
}
```

**Three Implementations:**
1. **SftpSession** (`sftp/session.rs`) - Uses `russh-sftp`, shares SSH handle with terminal
2. **FtpSession** (`ftp/session.rs`) - Uses `suppaftp` with async-rustls for FTPS
3. **Local filesystem** - Via Tauri `plugin-fs` with Windows drive enumeration

**Lock-Free Transfer Pattern:**
```rust
// Get file handle (brief SFTP lock)
let file_handle = sftp.open(...).await?;
// Release lock - stream without blocking other operations
drop(sftp_guard);
// Stream data with progress callbacks
while let Ok(bytes_read) = file_handle.read().await {
    progress_callback(bytes_transferred, total_bytes);
}
```

**Progress Reporting:**
- Backend emits `file-transfer-progress` events with `transferId` (UUID from frontend)
- Frontend `statusBarStore` shows progress bars with cancel capability
- **Duplicate handling**: Auto-renames files with " (N)" suffix

**Frontend Dual-Panel:**
- Left: Local filesystem | Right: Remote (SFTP/FTP)
- Drag-and-drop for uploads/downloads
- Context menus for operations (chmod, delete, rename, properties)

## Key Patterns & Best Practices

### Dependency Injection via Tauri State
```rust
// In lib.rs
.manage(TerminalManager::new())
.manage(FileTransferManager::new())

// In commands
#[tauri::command]
async fn create_terminal(
    state: State<'_, TerminalManager>,
    // ...
) -> Result<String, String> {
    state.create_session(config, app_handle).await
}
```

### Error Handling
- Custom error types: `SessionError`, `ConnectionError`, `SshError` (using `thiserror`)
- All Tauri commands return `Result<T, String>` (errors serialized to strings)
- Frontend displays errors via toast notifications

### Async Runtime
- Backend uses Tokio for all async operations
- Long-running I/O loops spawned with `tokio::spawn(async move { ... })`
- mpsc channels for thread-safe communication between command handlers and I/O loops
- Use unbounded channels with clone-able senders (avoid Arc<Mutex> on channels)

### Session Lifecycle
- Sessions stored in `Arc<RwLock<HashMap>>` for thread-safe concurrent access
- Cleanup on drop: terminal processes killed, SSH connections closed
- Frontend tracks sessions separately for UI state

### Authentication & Key Management
- SSH keys stored encrypted in frontend LocalStorage keychain
- Keys written to temporary files before passing to backend
- Auto-cleanup after 2s delay to avoid race conditions
- Supports: password, SSH key (RSA/Ed25519/ECDSA)

### Connection Heartbeat & Auto-Reconnect
- Frontend pings SSH sessions periodically: `terminalCommands.ping(sessionId)`
- On failure: triggers auto-reconnect with exponential backoff
- Max retries configurable, user can cancel
- Network state monitoring pauses reconnect if offline

## Common Development Patterns

### Adding a New Tauri Command

1. **Define command in Rust** (`src-tauri/src/commands/`):
```rust
#[tauri::command]
async fn my_command(
    param: String,
    state: State<'_, MyManager>,
    app_handle: AppHandle,
) -> Result<MyResponse, String> {
    state.do_something(param)
        .await
        .map_err(|e| e.to_string())
}
```

2. **Register in `lib.rs`**:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::my_command,
])
```

3. **Call from frontend** (`src/lib/services/`):
```javascript
import { invoke } from '@tauri-apps/api/core';

export async function myCommand(param) {
    return await invoke('my_command', { param });
}
```

### Adding Event Streaming

1. **Backend emits**:
```rust
app_handle.emit(&format!("my-event:{}", id), MyEventPayload { ... })?;
```

2. **Frontend listens**:
```javascript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen(`my-event:${id}`, (event) => {
    console.log('Received:', event.payload);
});
// Call unlisten() when done
```

### Adding a New Store

1. **Create store** (`src/lib/stores/my-feature.store.js`):
```javascript
import { writable } from 'svelte/store';

function createMyStore() {
    const { subscribe, set, update } = writable({
        items: [],
        activeId: null
    });

    return {
        subscribe,
        addItem: (item) => update(state => ({
            ...state,
            items: [...state.items, item]
        })),
        setActive: (id) => update(state => ({ ...state, activeId: id })),
        reset: () => set({ items: [], activeId: null })
    };
}

export const myStore = createMyStore();
```

2. **Use in components**:
```svelte
<script>
    import { myStore } from '$lib/stores/my-feature.store.js';

    const items = $derived($myStore.items);
</script>
```

## Important File Paths

**Rust Backend Core:**
- `src-tauri/src/lib.rs` - Main entry, command registration, manager initialization
- `src-tauri/src/commands/` - All Tauri command definitions
- `src-tauri/src/managers/terminal.rs` - Terminal session manager (singleton)
- `src-tauri/src/managers/transfer.rs` - File transfer session manager
- `src-tauri/src/pty/session.rs` - Local PTY implementation
- `src-tauri/src/ssh/terminal.rs` - SSH terminal session implementation
- `src-tauri/src/ssh/chain.rs` - ProxyJump/chain connection logic
- `src-tauri/src/sftp/session.rs` - SFTP file transfer implementation
- `src-tauri/Cargo.toml` - Rust dependencies and build config

**Frontend Core:**
- `src/lib/composables/useXtermTerminal.svelte.js` - xterm.js integration
- `src/lib/services/ssh-connection.js` - SSH connection establishment
- `src/lib/services/file-connection.js` - File transfer operations
- `src/lib/stores/tabs.store.js` - UI tabs and connection state
- `src/lib/stores/terminal.store.js` - Terminal sessions and xterm instances
- `src/lib/components/features/` - Feature-specific components (hosts, terminal, file-browser, etc.)

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | SvelteKit | 5.x |
| Language | JavaScript | ES2022+ |
| State Management | Svelte Stores | Built-in |
| Desktop Runtime | Tauri | 2.x |
| Backend Language | Rust | 2021 Edition |
| Terminal Emulator | xterm.js | 6.x |
| Styling | Tailwind CSS | 4.x |
| Build Tool | Vite | 6.x |
| SSH Library | russh | 0.55 |
| PTY Library | portable-pty | 0.8 |
| SFTP Library | russh-sftp | 2.0 |
| FTP Library | suppaftp | 6.x |
| Async Runtime | Tokio | 1.x |

## Svelte 5 Development Rules

### Critical Syntax Requirements

1. **Event Handlers (NEVER use deprecated `on:` syntax)**:
   - ❌ **NEVER** use `on:click` on native HTML elements
   - ✅ **ALWAYS** use `onclick`, `oninput`, `onchange` for native elements
   - Example: `<button onclick={handleClick}>` not `<button on:click={handleClick}>`

2. **Reactive State (Use runes, not reactive statements)**:
   - ❌ **NEVER** use `$:` reactive statements for simple state
   - ✅ **ALWAYS** use `$state()`, `$derived()`, `$effect()` runes
   - Example: `let count = $state(0)` not `let count = 0; $: doubled = count * 2`

3. **Two-Way Binding**:
   - ❌ **NEVER** use `let:` for two-way binding
   - ✅ **ALWAYS** use `bind:value` for form inputs
   - Example: `<input bind:value={name}>` not `<Input let:value={name}>`

### Accessibility Requirements

- ✅ **ALWAYS** use semantic HTML (`<button>`, `<label>`, `<input>`)
- ✅ **ALWAYS** add `onkeydown` handler when using clickable divs/spans
- ✅ **ALWAYS** associate labels with inputs using `for` attribute
- ✅ **ALWAYS** add `role="button"` and `tabindex="0"` for clickable non-button elements
- ✅ **ALWAYS** handle Enter and Space keys for keyboard accessibility

### Component Organization

- Feature components → `components/features/[feature-name]/`
- Reusable UI components → `components/ui/`
- Layout components → `components/layout/`
- ✅ **ALWAYS** create `index.js` barrel exports for component directories
- ✅ **ALWAYS** check existing components before creating new ones

### State Management

- ✅ **ALWAYS** use stores for cross-component state
- ✅ **ALWAYS** use `$store` syntax to subscribe to stores
- ❌ **NEVER** mutate store values directly - use store methods

### Error Handling

- ✅ **ALWAYS** wrap async operations in try-catch blocks
- ✅ **ALWAYS** use `toast.error()` for user-facing errors
- ✅ **ALWAYS** use error handler utilities from `src/lib/utils/error-handler.js`
- ❌ **NEVER** silently swallow errors

### Form Validation

- ✅ **ALWAYS** validate forms before submission
- ✅ **ALWAYS** show inline error messages using `FieldError` component
- ✅ **ALWAYS** use validation utilities from `src/lib/utils/validators.js`
- ✅ **ALWAYS** use `useForm` composable for form state management

### Styling

- ✅ **ALWAYS** use Tailwind utility classes
- ✅ **ALWAYS** use theme colors from `src/lib/theme/tokens.js`
- ❌ **NEVER** use inline styles or custom CSS without checking Tailwind config

### Naming Conventions

- Components: PascalCase (e.g., `HostManagementLayout.svelte`)
- Composables: camelCase with `use` prefix (e.g., `useForm.svelte.js`)
- Stores: kebab-case with `.store.js` suffix (e.g., `terminal.store.js`)
- Services: kebab-case (e.g., `ssh-connection.js`)
- Files: kebab-case for utilities, PascalCase for components

### Code Quality

- ✅ **ALWAYS** run `npm run check` before committing
- ✅ **ALWAYS** fix all linter warnings
- ✅ **ALWAYS** fix all accessibility warnings
- ❌ **NEVER** commit code with deprecation warnings

## Security Considerations

- **Encrypted storage**: SSH keys and passwords encrypted in LocalStorage
- **Temporary file cleanup**: SSH keys written to temp files, auto-deleted after use
- **No plain text secrets**: Never store credentials in plain text
- **Local-first**: All data stored locally by default, sync is opt-in
- **Connection security**: All SSH/SFTP connections use industry-standard encryption
- **No telemetry**: Privacy-focused, no data collection
