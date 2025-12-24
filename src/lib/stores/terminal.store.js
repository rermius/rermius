import { writable } from 'svelte/store';

/**
 * Terminal session state
 * @typedef {Object} TerminalSessionState
 * @property {string} id - Session ID
 * @property {string} title - Tab title
 * @property {string} type - 'local' | 'ssh'
 * @property {string} [shell] - Shell path (for local terminals)
 * @property {Object} xterm - xterm.js Terminal instance
 */

/**
 * Creates the terminal store for managing terminal sessions
 * @returns {Object} Store with subscribe method and action methods
 */
function createTerminalStore() {
	const { subscribe, set, update } = writable({
		sessions: [], // Array<TerminalSessionState>
		activeSessionId: null,
		splitView: false, // For future phase
		splitOrientation: 'horizontal' // For future phase
	});

	return {
		subscribe,

		/**
		 * Add a new terminal session
		 * @param {TerminalSessionState} session
		 */
		addSession: session =>
			update(state => ({
				...state,
				sessions: [...state.sessions, session],
				activeSessionId: session.id
			})),

		/**
		 * Remove a terminal session
		 * @param {string} sessionId
		 */
		removeSession: sessionId =>
			update(state => {
				const session = state.sessions.find(s => s.id === sessionId);
				if (session?.xterm) {
					session.xterm = null;
				}

				const sessions = state.sessions.filter(s => s.id !== sessionId);
				const activeSessionId =
					state.activeSessionId === sessionId ? sessions[0]?.id || null : state.activeSessionId;

				return {
					...state,
					sessions,
					activeSessionId
				};
			}),

		/**
		 * Set active session
		 * @param {string} sessionId
		 */
		setActiveSession: sessionId =>
			update(state => ({
				...state,
				activeSessionId: sessionId
			})),

		/**
		 * Update session title
		 * @param {string} sessionId
		 * @param {string} title
		 */
		updateSessionTitle: (sessionId, title) =>
			update(state => ({
				...state,
				sessions: state.sessions.map(s => (s.id === sessionId ? { ...s, title } : s))
			})),

		/**
		 * Get session by ID
		 * @param {string} sessionId
		 * @param {Function} callback - Called with session state
		 */
		getSession: (sessionId, callback) => {
			const unsubscribe = subscribe(state => {
				const session = state.sessions.find(s => s.id === sessionId);
				callback(session);
				if (unsubscribe) unsubscribe();
			});
		},

		/**
		 * Clear all sessions
		 */
		reset: () =>
			set({
				sessions: [],
				activeSessionId: null,
				splitView: false,
				splitOrientation: 'horizontal'
			})
	};
}

export const terminalStore = createTerminalStore();
