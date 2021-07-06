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
		// Update classes
		if (show) {
			elt.classList.add("show");
		} else {
			elt.classList.remove("show");
		}
		// Execute state change handlers
		this._changeHandlers && this._changeHandlers.forEach(function(action) {
			try {
				action.call(this, show);
			} catch (err) {
				try {window.console.error(err);} catch (e) {}
			}
		}, this);
	};
	Collapsible.prototype.toggle = function(save) {
		this.set(!this.shown, save);
	};
	Collapsible.prototype.load = function() {
		var key = this._storageKey("show");
		var show = key && localStorage.getItem(key);
		return show ? (this.set(show === "true", false), true) : false;
	};
	Collapsible.prototype.save = function() {
		var key = this._storageKey("show");
		return key ? (localStorage.setItem(key, this.shown), true) : false;
	};
	Collapsible.prototype.unsave = function() {
		var key = this._storageKey("show");
		return key ? (localStorage.removeItem(key), true) : false;
	};
	Collapsible.prototype._storageKey = function(property) {
		return this.container.id ? ((window.storagePrefix || "") + "/" + property + "/" + this.container.id) : void 0;
	};
	Collapsible.prototype.addChangeListener = function(action) {
		this._changeHandlers.push(action);
	};
	Collapsible.prototype.removeChangeListener = function(action) {
		var idx = this._changeHandlers.indexOf(action);
		if (idx >= 0) {
			this._changeHandlers.splice(idx, 1);
		}
	};
	var Collapsibles = {
		// Initialize each '.collapsible' element
		init: function() {
			var elts = document.querySelectorAll(".collapsible");
			// Event handling
			var doToggle = function() {
				var scrollData = GoTo.scrollTo(this, null, {target: "nearest", force: false, duration: 0});
				Collapsibles.toggle(this.parentNode);
				scrollData.container.scrollTop = scrollData.scroll;
				this.focus();
			};
			var createPseudoButtons = PseudoButtons && typeof PseudoButtons.create === 'function';
			// Process matching elements
			Array.prototype.forEach.call(elts, function(elt) {
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
			});
			// Initialize overlay for all headers where applicable
			if (HeaderOverlays) {
				var overlays = [];
				Collapsibles.data.forEach(function(collapsible) {
					var overlay = collapsible.toggleOverlay;
					if (overlay) {
						overlay.redirectEvents('click');
						overlays.push(overlay);
					}
				});
				HeaderOverlays.mount(overlays);
			}
		},
		set: function(selector, show, save) {
			// Process selector argument
			if (!selector) {
				selector = "";
			} else if (selector instanceof Element || selector instanceof Collapsible) {
				selector = [selector];
			}
			// Process matching elements
			if (typeof selector === 'string') {
				// If selector is a string, match Collapsible entries against it
				Collapsibles.data.forEach(function(collapsible, elt) {
					if (selector === "" || elt.matches(selector)) {
						collapsible.set(
							(typeof show === 'function') ? show(collapsible) : show,
							(typeof save === 'function') ? save(collapsible) : save
						);
					}
				});
			} else {
				// Otherwise assume an array-like object of Element and/or Collapsible entries
				Array.prototype.forEach.call(selector, function(elt) {
					var collapsible = (elt instanceof Collapsible) ? elt : Collapsibles.data.get(elt);
					if (collapsible) {
						collapsible.set(
							(typeof show === 'function') ? show(collapsible) : show,
							(typeof save === 'function') ? save(collapsible) : save
						);
					}
				});
			}
		},
		toggle: function(selector, save) {
			Collapsibles.set(selector, function(collapsible) {return !collapsible.shown;}, save);
		},
		unsave: function() {
			Collapsibles.data.forEach(function(collapsible) {
				collapsible.unsave();
			});
		},
		data: new Map()
	};
	window.Collapsibles = Collapsibles;
})();
