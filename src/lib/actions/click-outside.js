/**
 * Click outside action
 * Calls the callback when user clicks outside the element
 *
 * Usage:
 * <div use:clickOutside={handleClickOutside}>
 *   ...
 * </div>
 */
export function clickOutside(node, callback) {
	function handleClick(event) {
		if (node && !node.contains(event.target) && !event.defaultPrevented) {
			if (callback && typeof callback === 'function') {
				callback();
			}
		}
	}

	document.addEventListener('click', handleClick, true);

	return {
		destroy() {
			document.removeEventListener('click', handleClick, true);
		}
	};
}
