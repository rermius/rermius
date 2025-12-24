/**
 * Terminal Components - Main Barrel Export
 *
 * Organized terminal components for managing local and remote terminal sessions.
 *
 * Structure:
 * - core/        - Base terminal components (LocalTerminal, RemoteTerminal)
 * - views/       - High-level views and layouts (LocalTerminalView)
 * - containers/  - Connection/tab orchestration (RemoteTerminalContainer)
 * - tabs/        - Tab UI components (TerminalTabBar, TerminalTabItem)
 * - connection/  - Connection status and edit wrappers
 *
 * @example
 * ```js
 * import { LocalTerminal, RemoteTerminal } from '$lib/components/features/terminal';
 * import { LocalTerminalView } from '$lib/components/features/terminal';
 * import { RemoteTerminalContainer } from '$lib/components/features/terminal';
 * import { TerminalTabBar, TerminalTabItem } from '$lib/components/features/terminal';
 * import { ConnectionStatusCard } from '$lib/components/features/terminal';
 * ```
 */

// Core terminal components
export { LocalTerminal, RemoteTerminal } from './core';

// View components
export { LocalTerminalView } from './views';

// Container components
export { RemoteTerminalContainer } from './containers';

// Tab components
export { TerminalTabBar, TerminalTabItem } from './tabs';

// Connection components
export {
	ConnectionStatusCard,
	ConnectionEditWrapper,
	ConnectionProgressBar,
	ConnectionLogViewer
} from './connection';
