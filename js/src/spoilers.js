/**
* (c) 2021 Taemporus
*/
(function() {
	'use strict';
	function Spoiler(element, description) {
		this.element = (element instanceof Element) ? element : void 0;
		// Set tooltip value
		this.description = description ? String(description) : (this.element.getAttribute("data-spoiler") || "spoiler");
		// Set tooltip properties
		this.element.setAttribute("data-tooltip-touch", "");
		this.element.setAttribute("data-tippy-hideonclick", false);
		this.element.setAttribute("data-tippy-animation", 'shift-toward');
		// Default state
		this.shown = void 0;
		this.load() || this.set();
		// State change handlers
		this._changeHandlers = [];
	}
	Spoiler.prototype.set = function(show, save) {
		var elt = this.element;
		// If state is unspecified, use the element's classes to determine it
		show = (typeof show === 'undefined') ? elt.classList.contains("show") : Boolean(show);
		// Save state by default
		save = (typeof save === 'undefined') ? true : Boolean(save);
		// Set new value and save it if requested
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
		// Update tooltip
		this._updateTooltip();
		// Execute state change handlers
		this._changeHandlers && this._changeHandlers.forEach(function(action) {
			try {
				action.call(this, show);
			} catch (err) {
				try {window.console.error(err);} catch (e) {}
			}
		}, this);
	};
	Spoiler.prototype.toggle = function(save) {
		this.set(!this.shown, save);
	};
	Spoiler.prototype._updateTooltip = function() {
		var elt = this.element;
		var content =
			(elt.classList.contains("noprefix") ? "" : (elt.classList.contains("show") ? "Hide " : "Show ")) +
			this.description;
		elt.setAttribute("data-tippy-content", content);
		if (elt._tippy) {
			elt._tippy.setContent(content);
		}
	};
	Spoiler.prototype.load = function() {
		var key = this._storageKey("show");
		var show = key && localStorage.getItem(key);
		return show ? (this.set(show === "true", false), true) : false;
	};
	Spoiler.prototype.save = function() {
		var key = this._storageKey("show");
		return key ? (localStorage.setItem(key, this.shown), true) : false;
	};
	Spoiler.prototype.unsave = function() {
		var key = this._storageKey("show");
		return key ? (localStorage.removeItem(key), true) : false;
	};
	Spoiler.prototype._storageKey = function(property) {
		return this.element.id ? ((window.storagePrefix || "") + "/" + property + "/" + this.element.id) : void 0;
	};
	Spoiler.prototype.addChangeListener = function(action) {
		this._changeHandlers.push(action);
	};
	Spoiler.prototype.removeChangeListener = function(action) {
		var idx = this._changeHandlers.indexOf(action);
		if (idx >= 0) {
			this._changeHandlers.splice(idx, 1);
		}
	};
	var Spoilers = {
		// Initialize each '.inline-spoiler' element
		init: function() {
			var elts = document.querySelectorAll(".inline-spoiler");
			// Event handling
			var doToggle = function() {
				Spoilers.toggle(this);
			};
			var createPseudoButtons = PseudoButtons && typeof PseudoButtons.create === 'function';
			// Process matching elements
			Array.prototype.forEach.call(elts, function(elt) {
				var spoiler = new Spoiler(elt);
				// Add event handlers
				if (createPseudoButtons) {
					PseudoButtons.create(elt, doToggle);
				} else {
					elt.addEventListener('click', doToggle);
				}
				// Register data for the spoiler
				Spoilers.data.set(elt, spoiler);
			});
		},
		set: function(selector, show, save) {
			// Process selector argument
			if (!selector) {
				selector = "";
			} else if (selector instanceof Element || selector instanceof Spoiler) {
				selector = [selector];
			}
			// Process matching elements
			if (typeof selector === 'string') {
				// If selector is a string, match Spoiler entries against it
				Spoilers.data.forEach(function(spoiler, elt) {
					if (selector === "" || elt.matches(selector)) {
						spoiler.set(
							(typeof show === 'function') ? show(spoiler) : show,
							(typeof save === 'function') ? save(spoiler) : save
						);
					}
				});
			} else {
				// Otherwise assume an array-like object of Element and/or Spoiler entries
				Array.prototype.forEach.call(selector, function(elt) {
					var spoiler = (elt instanceof Spoiler) ? elt : Spoilers.data.get(elt);
					if (spoiler) {
						spoiler.set(
							(typeof show === 'function') ? show(spoiler) : show,
							(typeof save === 'function') ? save(spoiler) : save
						);
					}
				});
			}
		},
		toggle: function(selector, save) {
			Spoilers.set(selector, function(spoiler) {return !spoiler.shown;}, save);
		},
		unsave: function() {
			Spoilers.data.forEach(function(spoiler) {
				spoiler.unsave();
			});
		},
		data: new Map()
	};
	window.Spoilers = Spoilers;
})();
