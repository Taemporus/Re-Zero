/**
* (c) 2021 Taemporus
*/
(function() {
	'use strict';
	function Collapsible(container) {
		this.container = (container instanceof Element) ? container : void 0;
		// Identify toggle and content elements among the container's children
		this.toggle = [];
		this.content = [];
		var neither = [];
		Array.prototype.forEach.call(this.container.children, function(child) {
			if (['script', 'style'].indexOf(child.tagName.toLowerCase()) >= 0) {
				return;
			} else if (child.classList.contains("collapse-toggle")) {
				this.toggle.push(child);
			} else if (child.classList.contains("collapse-content")) {
				this.content.push(child);
			} else {
				neither.push(child);
			}
		}, this);
		if (neither.length > 0) {
			if (this.toggle.length === 0) {
				this.toggle.push(neither.shift());
			}
			this.content = this.content.concat(neither);
		}
		// Add classes
		this.toggle.forEach(function(toggle) {
			if (!toggle.classList.contains("collapse-toggle"))
				toggle.classList.addClass("collapse-toggle");
		});
		this.content.forEach(function(content) {
			if (!content.classList.contains("collapse-content"))
				content.classList.addClass("collapse-content");
		});
		// Make toggle(s) focusable
		this.toggle.forEach(function(toggle) {
			toggle.setAttribute('tabindex', 0);
		});
		// Create header overlay for *first* toggle when the container has '[data-retain-head]'
		this.toggleOverlay = void 0;
		if (HeaderOverlays && this.container.hasAttribute("data-retain-head") && this.container.getAttribute("data-retain-head").toLowerCase() !== "false" && this.toggle.length) {
			var toggle = this.toggle[0];
			this.toggleOverlay = HeaderOverlays.create(toggle.parentNode, toggle, function(container, tuple) {
				tuple.main.parentNode.insertBefore(tuple.bottom, tuple.main.nextSibling);
				tuple.main.parentNode.insertBefore(tuple.fixed, tuple.bottom);
			}, (function() {
				if (!this.shown)
					return false;
			}).bind(this), true)[0];
		}
		// Default state
		this.shown = void 0;
		this.load() || this.set();
		// State change handlers
		this._changeHandlers = [];
	}
	Collapsible.prototype.set = function(show, save) {
		var elt = this.container;
		// If state is unspecified, use the element's classes to determine it
		show = (typeof show === 'undefined') ? elt.classList.contains("show") : Boolean(show);
		// Save state by default
		save = (typeof save === 'undefined') ? true : Boolean(save);
		// Set new value and save it if requested
		show = Boolean(show);
		this.shown = show;
		if (save) {
			this.save();
		}
		// Set content visibility
		this.content.forEach(function(elt) {
			elt.style.display = show ? '' : 'none';
		});
		// Update classes
		if (show) {
			elt.classList.add("show");
		} else {
			elt.classList.remove("show");
		}
		// Execute state change handlers
		this._changeHandlers && this._changeHandlers.forEach(function(entry) {
			this._callEventListener(entry, show);
		}, this);
		// Return new value
		return show;
	};
	Collapsible.prototype.toggle = function(save) {
		return this.set(!this.shown, save);
	};
	Collapsible.prototype.load = function() {
		var key = this._storageKey("show");
		var show = key && localStorage.getItem(key);
		return show ? this.set(show === "true", false) : void 0;
	};
	Collapsible.prototype.save = function() {
		var key = this._storageKey("show");
		return key ? (localStorage.setItem(key, this.shown), this.shown) : void 0;
	};
	Collapsible.prototype.unsave = function() {
		var key = this._storageKey("show");
		return key ? (localStorage.removeItem(key), this.shown) : void 0;
	};
	Collapsible.prototype._storageKey = function(property) {
		return this.container.id ? ((window.storagePrefix || "") + "/" + property + "/" + this.container.id) : void 0;
	};
	Collapsible.prototype.addChangeListener = function(action, opts) {
		typeof opts === 'object' || (opts = {});
		var entry = {action: action};
		entry.maxCount = parseInt(opts.maxCount);
		entry.maxCount < 0 && (entry.maxCount = NaN);
		entry.count = 0;
		if (entry.maxCount !== 0) {
			this._changeHandlers.push(entry);
			opts.now && this._callEventListener(entry, this.shown);
		}
		return entry;
	};
	Collapsible.prototype.removeChangeListener = function(entry) {
		var idx = this._changeHandlers.indexOf(entry);
		if (idx >= 0) {
			this._changeHandlers.splice(idx, 1);
			return true;
		}
		return false;
	};
	Collapsible.prototype._callEventListener = function(entry) {
		try {
			entry.action.apply(this, Array.prototype.slice.call(arguments, 1));
			entry.count++;
			if (entry.count >= entry.maxCount) {
				this.removeChangeListener(entry);
			}
		} catch (err) {
			try {window.console.error(err);} catch (e) {}
		}
	};
	function forSelected(selector, fn) {
		// Process selector argument
		if (!selector) {
			selector = "";
		} else if (selector instanceof Element || selector instanceof Collapsible) {
			selector = [selector];
		}
		// Prepare arguments
		var args = Array.prototype.slice.call(arguments, 2);
		var argProc = function(arg) {
			return (arg.evalFunc && typeof arg.value === 'function') ? arg.value(this) : arg.value;
		};
		// Process matching elements
		var result = new Map();
		if (typeof selector === 'string') {
			// If selector is a string, match Collapsible entries against it
			Collapsibles.data.forEach(function(collapsible, elt) {
				if (selector === "" || elt.matches(selector)) {
					result.set(collapsible, fn.apply(collapsible, args.map(argProc, collapsible)));
				}
			});
		} else {
			// Otherwise assume an array-like object of Element and/or Collapsible entries
			Array.prototype.forEach.call(selector, function(elt) {
				var collapsible = (elt instanceof Collapsible) ? elt : Collapsibles.data.get(elt);
				if (collapsible) {
					result.set(collapsible, fn.apply(collapsible, args.map(argProc, collapsible)));
				}
			});
		}
		return result;
	}
	var Collapsibles = {
		// Initialize Collapsible objects for the specified elements
		init: function(selector) {
			// Get matching elements
			var elts;
			if (!selector) {
				elts = [];
			} else if (typeof selector === 'string') {
				elts = document.querySelectorAll(selector);
			} else if (selector instanceof Element) {
				elts = [selector];
			} else {
				elts = selector;
			}
			// Event handling
			var doToggle = function() {
				var scrollData = GoTo.scrollTo(this, null, {target: "nearest", force: false, duration: 0});
				Collapsibles.toggle(this.parentNode);
				scrollData.container.scrollTop = scrollData.scroll;
				this.focus();
			};
			var createPseudoButtons = PseudoButtons && typeof PseudoButtons.create === 'function';
			// Process list of elements
			var collapsibles = [];
			Array.prototype.forEach.call(elts, function(elt) {
				// Skip already initialized elements
				if (Collapsibles.data.has(elt)) {
					return;
				}
				// Filter for Element objects
				if (elt instanceof Element) {
					var collapsible = new Collapsible(elt);
					// Add event handlers
					collapsible.toggle.forEach(function(toggle) {
						if (createPseudoButtons) {
							PseudoButtons.create(toggle, doToggle);
						} else {
							toggle.addEventListener('click', doToggle);
						}
					});
					// Register data for the collapsible container
					Collapsibles.data.set(elt, collapsible);
					// Add Collapsible object to array of initialized objects
					collapsibles.push(collapsible);
				}
			});
			// Initialize overlay for all headers where applicable
			if (HeaderOverlays) {
				var overlays = [];
				collapsibles.forEach(function(collapsible) {
					var overlay = collapsible.toggleOverlay;
					if (overlay) {
						overlay.redirectEvents('click');
						overlays.push(overlay);
					}
				});
				HeaderOverlays.mount(overlays);
			}
			// Return array of initialized objects (may be shorter than an array used as the original argument)
			return collapsibles;
		},
		set: function(selector, show, save) {
			return forSelected(selector, Collapsible.prototype.set, {value: show, evalFunc: true}, {value: save, evalFunc: true});
		},
		toggle: function(selector, save) {
			return forSelected(selector, Collapsible.prototype.toggle, {value: save, evalFunc: true});
		},
		load: function(selector) {
			return forSelected(selector, Collapsible.prototype.load);
		},
		save: function(selector) {
			return forSelected(selector, Collapsible.prototype.save);
		},
		unsave: function(selector) {
			return forSelected(selector, Collapsible.prototype.unsave);
		},
		addChangeListener: function(selector, action, opts) {
			return forSelected(selector, Collapsible.prototype.addChangeListener, {value: action}, {value: opts, evalFunc: true});
		},
		removeChangeListener: function(selector, entry) {
			return forSelected(selector, Collapsible.prototype.removeChangeListener, {value: entry, evalFunc: true});
		},
		data: new Map()
	};
	window.Collapsibles = Collapsibles;
})();
