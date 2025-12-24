/**
 * Host chaining utilities
 * proxyJump is stored as a JSON string of host IDs:
 *   proxyJump = JSON.stringify(['hostId1', 'hostId2'])
 * The current host (being created/edited) is NOT included in this array.
 */

/**
 * Parse proxyJump JSON string into an array of host IDs.
 * @param {string|null} proxyJump
 * @returns {string[]}
 */
export function parseChain(proxyJump) {
	if (!proxyJump || typeof proxyJump !== 'string') return [];

	try {
		const parsed = JSON.parse(proxyJump);
		return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
	} catch {
		return [];
	}
}

/**
 * Serialize an array of host IDs into proxyJump string.
 * Returns null when there is no chain.
 * @param {string[]} ids
 * @returns {string|null}
 */
export function serializeChain(ids) {
	if (!Array.isArray(ids) || ids.length === 0) return null;
	return JSON.stringify(ids);
}

/**
 * Build a human‑readable summary string for a chain.
 * Example: "jump1 -> jump2 -> currentHost".
 *
 * @param {Array<{id:string,label?:string,hostname?:string}>} hosts
 * @param {string[]} chainIds
 * @param {string} currentHostLabel
 * @param {number} maxLength
 * @returns {string}
 */
export function getChainSummary(hosts, chainIds, currentHostLabel = '', maxLength = 32) {
	const byId = new Map(
		(hosts || []).map(host => [host.id, host.label || host.hostname || '(unnamed host)'])
	);

	const labels = [];

	for (const id of chainIds || []) {
		const label = byId.get(id);
		if (label) {
			labels.push(label);
		}
	}

	if (currentHostLabel) {
		labels.push(currentHostLabel);
	}

	if (labels.length === 0) return 'Host Chaining';

	const full = labels.join(' -> ');
	if (full.length <= maxLength) return full;

	return `${full.slice(0, maxLength - 3)}...`;
}
