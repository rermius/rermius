/**
 * Avatar cache module
 * Persistent cache for workspace avatars across component re-renders
 */

const avatarCache = new Map();

export function getAvatar(workspaceId) {
	return avatarCache.get(workspaceId);
}

export function setAvatar(workspaceId, url) {
	avatarCache.set(workspaceId, url);
}

export function hasAvatar(workspaceId) {
	return avatarCache.has(workspaceId);
}

export function deleteAvatar(workspaceId) {
	avatarCache.delete(workspaceId);
}

export function clearCache() {
	avatarCache.clear();
}

export function getCacheSize() {
	return avatarCache.size;
}

export function getCacheKeys() {
	return Array.from(avatarCache.keys());
}
