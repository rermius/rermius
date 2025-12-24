/**
 * Application route constants
 * Use these constants instead of hardcoded strings for type safety
 */

export const ROUTES = {
	HOME: '/',
	HOSTS: '/hosts',
	HOST_DETAIL: id => `/hosts/${id}`,
	KEYCHAIN: '/keychain',
	PORT_FORWARDING: '/port-forwarding',
	SNIPPETS: '/snippets',
	SNIPPET_DETAIL: id => `/snippets/${id}`,
	KNOWN_HOSTS: '/known-hosts',
	LOGS: '/logs',
	SETTINGS: '/settings'
};

/**
 * Navigation items configuration
 */
export const NAV_ITEMS = [
	{
		label: 'Hosts',
		path: ROUTES.HOSTS,
		icon: 'server'
	},
	{
		label: 'Keychain',
		path: ROUTES.KEYCHAIN,
		icon: 'key'
	},
	{
		label: 'Port Forwarding',
		path: ROUTES.PORT_FORWARDING,
		icon: 'forward'
	},
	{
		label: 'Snippets',
		path: ROUTES.SNIPPETS,
		icon: 'code'
	},
	{
		label: 'Known Hosts',
		path: ROUTES.KNOWN_HOSTS,
		icon: 'check-circle'
	},
	{
		label: 'Logs',
		path: ROUTES.LOGS,
		icon: 'file-text'
	}
];
