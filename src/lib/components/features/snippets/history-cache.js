/**
 * History cache - persists across component mounts
 * Key: sessionId, Value: { lastFetchTime, historyData }
 */
const historyCache = new Map();
const DEBOUNCE_TIME = 60000; // 1 minute

/**
 * Check if we should fetch history for a session
 */
export function shouldFetchHistory(sessionId) {
	const cached = historyCache.get(sessionId);

	if (!cached) {
		return { shouldFetch: true, showLoading: true, cachedData: null };
	}

	const timeSinceLastFetch = Date.now() - cached.lastFetchTime;
	const isFresh = timeSinceLastFetch < DEBOUNCE_TIME;

	return {
		shouldFetch: !isFresh,
		showLoading: false,
		cachedData: cached.historyData
	};
}

/**
 * Update cache with new history data
 */
export function updateHistoryCache(sessionId, historyData) {
	historyCache.set(sessionId, {
		lastFetchTime: Date.now(),
		historyData
	});
}
