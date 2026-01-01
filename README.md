<div align="center">
    <h1>Rermius</h1>
    <p>Modern SSH Terminal Manager</p>
    <img src="https://img.shields.io/github/last-commit/rermius/rermius?style=for-the-badge&color=74c7ec&labelColor=111827" alt="Last Commit">
    <img src="https://img.shields.io/github/stars/rermius/rermius?style=for-the-badge&color=facc15&labelColor=111827" alt="GitHub Stars">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge&color=34d399&labelColor=111827" alt="License">
</div>

<div align="center">
    <img src="static/rermius.gif" alt="Rermius Demo" width="800">
</div>

---

Open-sourced SSH/SFTP/FTP terminal management application built with Tauri 2 + SvelteKit 5 (Linux, macOS, Windows).

A powerful desktop application combining full-featured terminal emulation with advanced SSH connection management, integrated file browser, and workspace organization—all in a beautiful native interface.

## Features

- **Multiple terminal sessions** with tab management (local and SSH)
- **SSH host management** with groups, colors, and quick connections
- **SSH config import** - Auto-scan and import from `~/.ssh/config`
- **Multiple authentication** - Password, SSH keys (RSA/Ed25519/ECDSA), and key passphrase support
- **ProxyJump/Chaining** - Connect through multiple jump hosts
- **File browser integration** - Browse, upload, download files via SFTP/FTP alongside terminals
- **Drag & drop** file transfers with progress tracking
- **SSH keychain** - Import, organize, and manage SSH keys
- **Port forwarding** - Local, remote, and dynamic (SOCKS) forwarding
- **Command snippets** - Save and reuse frequently used commands
- **Multi-workspace** - Organize connections by project
- **Auto-reconnect** with configurable retry settings
- **IME support** - Vietnamese, Chinese, Japanese input methods
- **Theme-aware** - Modern dark theme with customizable colors
- **xterm.js** - WebGL-accelerated terminal with Unicode support
- **Keyboard shortcuts** for power users
- **Security-first** - Encrypted credential storage, no telemetry

## Download

Get the latest version of Rermius:

- **🌐 [Download Page](https://rermius.github.io/page/#download)** - Installation guides for Windows, macOS, and Linux
- **📦 [GitHub Releases](https://github.com/rermius/rermius/releases)** - Direct download links

### Quick Install

**macOS (Homebrew):**

```bash
brew tap rermius/rermius-homebrew
brew install --cask rermius
```

**Windows:** Download and run the `.exe` installer from [releases](https://github.com/rermius/rermius/releases)

**Linux:** Download `.AppImage`, `.deb`, or `.rpm` from [releases](https://github.com/rermius/rermius/releases)

> ⚠️ **Note**: The app is currently unsigned. See the [download page](https://rermius.github.io/page/#download) for platform-specific instructions to bypass security warnings.

## Install

### Prerequisites

- **Node.js** v20 or higher
- **Rust** (latest stable)
- **Tauri CLI** (optional): `cargo install tauri-cli` or `npm install -g @tauri-apps/cli`

### Building from Source

```bash
git clone https://github.com/rermius/rermius.git
cd rermius/app

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run build
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

### Platform-Specific Builds

```bash
# Windows
npm run build:windows

# macOS (ARM)
npm run build:macos-arm

# macOS (Intel)
npm run build:macos-intel

# Linux
npm run build:linux
```

## Upgrade

- **Auto upgrade**: Download latest release and reinstall
- **From source**: Pull latest changes and rebuild: `git pull && npm install && npm run build && npm run tauri build`

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Comprehensive development guide and architecture documentation
- [Issues](https://github.com/rermius/rermius/issues) - Bug reports and feature requests

## Support

We'd love to hear from you! Please:

- [Submit an issue](https://github.com/rermius/rermius/issues) for bugs or feature requests
- [Start a discussion](https://github.com/rermius/rermius/discussions) for questions or ideas
- Create pull requests - contributions welcome!

## Development

```bash
# Prerequisites: Node.js 20+, Rust latest stable

git clone https://github.com/rermius/rermius.git
cd rermius/app
npm install

# Start Vite dev server
npm run dev

# Start full Tauri app with hot reload
npm run tauri dev

# Code quality checks
npm run check          # Type-check Svelte code
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix ESLint errors
npm run format         # Format code with Prettier
npm run format:check   # Check formatting

# Rust backend
cd src-tauri
cargo check            # Check Rust code
cargo build            # Build backend
cargo build --release  # Optimized build
```

## Project Structure

```
app/
├── src/                    # Frontend SvelteKit application
│   ├── lib/
│   │   ├── components/     # Svelte components
│   │   ├── composables/    # Reusable logic hooks
│   │   ├── services/       # Business logic and API
│   │   ├── stores/         # State management
│   │   └── utils/          # Utility functions
│   └── routes/             # SvelteKit routing
├── src-tauri/              # Tauri Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   ├── ssh/            # SSH/terminal logic
│   │   ├── sftp/           # SFTP implementation
│   │   └── managers/       # Session managers
│   └── Cargo.toml
└── static/                 # Static assets
```

## Tech Stack

- **Frontend**: SvelteKit 5, JavaScript, Tailwind CSS 4
- **Backend**: Rust, Tauri 2
- **Terminal**: xterm.js
- **SSH/SFTP**: russh, russh-sftp
- **FTP**: suppaftp
- **PTY**: portable-pty
- **Build**: Vite 6

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Acknowledgments

- **Tauri** - Rust-based desktop framework
- **SvelteKit** - Reactive frontend framework
- **xterm.js** - Terminal emulator
- **russh** - SSH protocol implementation
- **Electerm** - Inspiration for SSH terminal management features

---

<div align="center">
    <p>Made with ❤️ by the Rermius team</p>
    <p>⭐ Star this repository if you find it helpful!</p>
</div>
