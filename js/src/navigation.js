/**
* (c) 2021 Taemporus
*/
(function() {
	'use strict';
	function NavigationData(link, target, index) {
		this.link = (link instanceof Element) ? link : void 0;
		this.target = (target instanceof Element) ? target : void 0;
		this.index = parseInt(index);
		this.relPos = void 0;
		this.rect = void 0;
	}
	var Navigation = {
		/**
		 * Abstract "navigation bar" element: select changes in the items will be registered on this
		 * Currently has no functionality
		 */
		navBar: void 0,
		/**
		 * Direct parent of the navigation items
		 */
		navParent: void 0,
		/**
		 * Array containing the navigation items
		 */
		navItems: [],
		/**
		 * Key-value pairs for sections of the documents and the corresponding NavigationData objects
		 */
		data: new Map(),
		current: void 0,
		init: function(navBar, sections, tooltips) {
			// Process arguments
			if (!navBar) {
				return;
			} else if (navBar instanceof Element) {
				navBar = {outer: navBar, inner: navBar};
			} else if (typeof navBar !== 'object') {
				return;
			}
			if (typeof tooltips !== 'object' || tooltips === null) {
				tooltips = {text: tooltips};
			}
			// Initialize static variables
			Navigation.navBar = navBar.outer;
			Navigation.navParent = navBar.inner;
			// Create navigation buttons
			Array.prototype.forEach.call(sections, function(section, i) {
				var navItem = document.createElement('a');
				var navData = new NavigationData(navItem, section, i);
				var content;
				if (content = section.getAttribute("data-navtext")) {
					content = "<div class=\"navtext\">" + content + "</div>";
				} else if (content = section.getAttribute("data-navicon")) {
					content = "<div id=\"" + content + "\" class=\"navicon\"></div>";
				} else {
					content = "?";
				}
				var tooltipText = (typeof tooltips.text === 'function') ? tooltips.text(section, navItem) : (tooltips.text || "");
				
				navItem.classList.add("navitem");
				navItem.style.cssText = "-ms-grid-row: " + (i + 1);
				navItem.setAttribute("data-goto", section.id);
				navItem.setAttribute('aria-label', tooltipText);
				navItem.setAttribute("data-tippy-content", tooltipText);
				navItem.setAttribute("data-tippy-placement", (typeof tooltips.placement === 'function') ? tooltips.placement(section, navItem) : (tooltips.placement || ""));
				navItem.setAttribute("data-tippy-sticky", (typeof tooltips.sticky === 'function') ? tooltips.sticky(section, navItem) : (tooltips.sticky || ""));
				navItem.setAttribute("data-tippy-animation", (typeof tooltips.animation === 'function') ? tooltips.animation(section, navItem) : (tooltips.animation || ""));
				navItem.setAttribute("data-tooltip-touch", "");
				navItem.setAttribute("data-tooltip-parent", (typeof tooltips.parent === 'function') ? tooltips.parent(section, navItem) : (tooltips.parent || ""));
				
				navItem.innerHTML = content;
				
				Navigation.navItems.push(navItem);
				Navigation.data.set(section, navData);
			});
			// Monitor topmost section on screen
			if (typeof IntersectionObserver !== 'undefined') {
				var observer = new IntersectionObserver(function(entries, observer) {
					entries.forEach(function(entry) {
						var navData = Navigation.data.get(entry.target);
						if (navData) {
							var rect = navData.rect = entry.boundingClientRect;
							if (entry.isIntersecting) {
								navData.relPos = 0;
							} else if (rect.bottom < 1) {
								navData.relPos = -1;
							} else {
								navData.relPos = 1;
							}
						}
					});
					Navigation._updateCurrent();
				}, {rootMargin: "-1px", threshold: 0});
				Navigation.data.forEach(function(navData, section) {
					observer.observe(section);
				});
			}
			// Lock automatic scrolling of navigation menu while scrolling after being clicked
			if (GoTo) {
				GoTo.globalCallbacks["beforeScroll"].push(function(link, target) {
					if (Navigation.navItems.indexOf(link) >= 0) {
						Navigation.autoScrollLock++;
						return {
							type: "afterScroll",
							action: function() {Navigation.autoScrollLock--;}
						};
					}
				});
			}
			// Add buttons to navigation menu
			Navigation.navItems.forEach(function(navItem) {
				navBar.inner.appendChild(navItem);
			});
			// Return array of buttons
			return Navigation.navItems;
		},
		/**
		 * Select the section associated with the current position in the document (set 'current' class)
		 */
		_updateCurrent: function() {
			var closest = {};
			Navigation.data.forEach(function(navData, section) {
				var relPos = navData.relPos;
				var found = closest[relPos];
				if (relPos < 0) {
					if (!found || found.index < navData.index) {
						closest[relPos] = navData;
					}
				} else {
					if (!found || found.index > navData.index) {
						closest[relPos] = navData;
					}
				}
			});
			var newCurrent = closest[0] || closest[-1] || closest[1];
			if (newCurrent !== Navigation.current) {
				// Scroll navigation menu if necessary so the current item is visible
				if (!Navigation.autoScrollLock && typeof GoTo !== 'undefined') {
					GoTo.scrollTo(newCurrent.link, Navigation.navParent, {target: "farthest", force: false, duration: 0});
				}
				// Update classes
				if (Navigation.current) {
					Navigation.current.link.classList.remove("current");
				}
				newCurrent.link.classList.add("current");
				Navigation.current = newCurrent;
			}
		},
		/**
		 * If positive, locks automatic scrolling of the navigation bar when the current item changes
		 */
		autoScrollLock: 0
	};
	window.Navigation = Navigation;
})();
