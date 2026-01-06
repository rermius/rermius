/**
 * Terminal Components - Main Barrel Export
 *
 * Organized terminal components for managing local and remote terminal sessions.
 *
 * Structure:
 * - core/        - Unified terminal component (TerminalComponent)
 * - containers/  - Connection/tab orchestration (RemoteTerminalContainer)
 * - connection/  - Connection status and edit wrappers
 *
 * @example
 * ```js
 * import { TerminalComponent } from '$lib/components/features/terminal';
 * import { RemoteTerminalContainer } from '$lib/components/features/terminal';
 * import { ConnectionStatusCard } from '$lib/components/features/terminal';
 * ```
 */

// Core terminal components
export { TerminalComponent } from './core';

// Container components
export { RemoteTerminalContainer } from './containers';

// Connection components
export {
	ConnectionStatusCard,
	ConnectionEditWrapper,
	ConnectionProgressBar,
	ConnectionLogViewer
} from './connection';
