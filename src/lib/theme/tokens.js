/**
 * Design tokens - core design system values
 * These tokens are used to build themes and maintain consistency
 */

export const tokens = {
	/**
	 * Color palette
	 */
	colors: {
		// Dark theme colors (matching current Tailwind config)
		dark: {
			bg: {
				primary: '#1a1d29', // dark-900
				secondary: '#252939', // dark-800
				tertiary: '#2a2f3f', // dark-700
				elevated: '#303545', // dark-600
				surface: '#2a2f3f', // dark-700 - same as tertiary for inputs/surfaces
				hover: '#32364a', // dark-650 - between tertiary and elevated
				active: '#3e4257' // dark-550 - same as elevated, for active states
			},
			text: {
				primary: '#f3f4f6', // gray-100
				secondary: '#9ca3af', // gray-400
				tertiary: '#6b7280', // gray-500
				disabled: '#4b5563' // gray-600
			},
			border: '#374151', // gray-700
			// Terminal colors (matching header bg-primary)
			terminal: {
				background: '#1a1d29', // Same as bg.primary
				foreground: '#cdd6f4',
				cursor: '#f5e0dc',
				cursorAccent: '#1a1d29', // Same as background
				selectionBackground: '#585b7099',
				// ANSI colors
				black: '#45475a',
				red: '#f38ba8',
				green: '#a6e3a1',
				yellow: '#f9e2af',
				blue: '#89b4fa',
				magenta: '#f5c2e7',
				cyan: '#94e2d5',
				white: '#bac2de',
				brightBlack: '#585b70',
				brightRed: '#f38ba8',
				brightGreen: '#a6e3a1',
				brightYellow: '#f9e2af',
				brightBlue: '#89b4fa',
				brightMagenta: '#f5c2e7',
				brightCyan: '#94e2d5',
				brightWhite: '#a6adc8'
			}
		},

		// Light theme colors - với nhiều sắc độ để phân biệt rõ ràng
		light: {
			bg: {
				primary: '#ffffff', // Trắng - background chính
				secondary: '#e9ecef', // gray-200 - sidebar, panels (tối hơn để phân biệt rõ với white)
				tertiary: '#dee2e6', // gray-300 - header, active states
				elevated: '#f8f9fa', // gray-50 - elevated cards với shadow
				surface: '#ffffff', // Trắng - surface elements (inputs, selects)
				hover: '#ced4da' // gray-400 - hover states (tối hơn)
			},
			text: {
				primary: '#212529', // gray-900 - text chính
				secondary: '#495057', // gray-700 - text phụ
				tertiary: '#6c757d', // gray-600 - text nhẹ
				disabled: '#adb5bd' // gray-500 - disabled text
			},
			border: '#ced4da', // gray-400 - borders rõ ràng hơn
			// Terminal colors (Solarized Light for light theme)
			terminal: {
				background: '#fdf6e3',
				foreground: '#657b83',
				cursor: '#657b83',
				cursorAccent: '#fdf6e3',
				selectionBackground: '#eee8d5',
				// ANSI colors
				black: '#073642',
				red: '#dc322f',
				green: '#859900',
				yellow: '#b58900',
				blue: '#268bd2',
				magenta: '#d33682',
				cyan: '#2aa198',
				white: '#eee8d5',
				brightBlack: '#002b36',
				brightRed: '#cb4b16',
				brightGreen: '#586e75',
				brightYellow: '#657b83',
				brightBlue: '#839496',
				brightMagenta: '#6c71c4',
				brightCyan: '#93a1a1',
				brightWhite: '#fdf6e3'
			}
		},

		// Accent colors (theme-independent)
		accent: {
			blue: {
				50: '#eff6ff',
				100: '#dbeafe',
				200: '#bfdbfe',
				300: '#93c5fd',
				400: '#60a5fa',
				500: '#3b82f6', // primary blue
				600: '#2563eb',
				700: '#1d4ed8',
				800: '#1e40af',
				900: '#1e3a8a'
			},
			orange: {
				50: '#fff7ed',
				100: '#ffedd5',
				200: '#fed7aa',
				300: '#fdba74',
				400: '#fb923c',
				500: '#f97316', // primary orange
				600: '#ea580c',
				700: '#c2410c',
				800: '#9a3412',
				900: '#7c2d12'
			},
			green: {
				50: '#f0fdf4',
				100: '#dcfce7',
				200: '#bbf7d0',
				300: '#86efac',
				400: '#4ade80',
				500: '#10b981', // success
				600: '#059669',
				700: '#047857',
				800: '#065f46',
				900: '#064e3b'
			},
			red: {
				50: '#fef2f2',
				100: '#fee2e2',
				200: '#fecaca',
				300: '#fca5a5',
				400: '#f87171',
				500: '#ef4444', // error/danger
				600: '#dc2626',
				700: '#b91c1c',
				800: '#991b1b',
				900: '#7f1d1d'
			},
			yellow: {
				50: '#fefce8',
				100: '#fef9c3',
				200: '#fef08a',
				300: '#fde047',
				400: '#facc15',
				500: '#eab308', // warning
				600: '#ca8a04',
				700: '#a16207',
				800: '#854d0e',
				900: '#713f12'
			}
		},

		// Tab active colors (theme-independent, can be overridden per theme)
		tabActive: {
			bg: '#173636',
			text: '#21b568',
			icon: '#21b568'
		}
	},

	/**
	 * Spacing scale (rem units)
	 */
	spacing: {
		0: '0',
		px: '1px',
		0.5: '0.125rem', // 2px
		1: '0.25rem', // 4px
		1.5: '0.375rem', // 6px
		2: '0.5rem', // 8px
		2.5: '0.625rem', // 10px
		3: '0.75rem', // 12px
		3.5: '0.875rem', // 14px
		4: '1rem', // 16px
		5: '1.25rem', // 20px
		6: '1.5rem', // 24px
		7: '1.75rem', // 28px
		8: '2rem', // 32px
		9: '2.25rem', // 36px
		10: '2.5rem', // 40px
		12: '3rem', // 48px
		16: '4rem', // 64px
		20: '5rem', // 80px
		24: '6rem' // 96px
	},

	/**
	 * Border radius values
	 */
	borderRadius: {
		none: '0',
		sm: '0.125rem', // 2px
		DEFAULT: '0.25rem', // 4px
		md: '0.375rem', // 6px
		lg: '0.5rem', // 8px
		xl: '0.75rem', // 12px - card radius from config
		'2xl': '1rem', // 16px
		'3xl': '1.5rem', // 24px
		full: '9999px'
	},

	/**
	 * Box shadow values
	 */
	boxShadow: {
		sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
		DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
		md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
		lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
		xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
		card: '0 0 0 1px rgba(255, 255, 255, 0.05)' // from config
	},

	/**
	 * Typography scale
	 */
	fontSize: {
		xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
		sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px
		base: ['1rem', { lineHeight: '1.5rem' }], // 16px
		lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
		xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
		'2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
		'3xl': ['1.875rem', { lineHeight: '2.25rem' }] // 30px
	},

	/**
	 * Font weights
	 */
	fontWeight: {
		normal: '400',
		medium: '500',
		semibold: '600',
		bold: '700'
	},

	/**
	 * Z-index scale
	 */
	zIndex: {
		base: 0,
		dropdown: 1000,
		sticky: 1020,
		fixed: 1030,
		modalBackdrop: 1040,
		modal: 1050,
		popover: 1060,
		tooltip: 1070
	},

	/**
	 * Transitions
	 */
	transition: {
		fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
		base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
		slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
		slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)'
	}
};
