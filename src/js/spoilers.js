/**
* (c) 2023 Taemporus
*/

/* global PseudoButtons */
(function() {
	'use strict';
	function Spoiler(element, description) {
		this.element = (element instanceof Element) ? element : void 0;
		this.description = description ? String(description) : (this.element.getAttribute('data-spoiler') || 'spoiler');
		// Default state
		this.shown = void 0;
		this.load() || this.set();
		// State change handlers
		this._changeHandlers = [];
	}
	Spoiler.prototype.set = function(show, save) {
		var elt = this.element;
		// If state is unspecified, use the element's classes to determine it
		show = (typeof show === 'undefined') ? elt.classList.contains('show') : Boolean(show);
		// Save state by default
		save = (typeof save === 'undefined') ? true : Boolean(save);
		// Set new value and save it if requested
		this.shown = show;
		if (save) {
			this.save();
		}
		// Hide content and disable descendant elements when not shown
		if (!show) {
			elt.style.background = 'currentColor';
			Array.prototype.forEach.call(elt.querySelectorAll('*'), function(desc) {
				desc.style.visibility = 'hidden';
			});
		} else {
			elt.style.background = '';
			Array.prototype.forEach.call(elt.querySelectorAll('*'), function(desc) {
				desc.style.visibility = '';
			});
		}
		// Update classes
		if (show) {
			elt.classList.add('show');
		} else {
			elt.classList.remove('show');
		}
		// Execute state change handlers
		this._changeHandlers && this._changeHandlers.forEach(function(entry) {
			this._callEventListener(entry, show);
		}, this);
		// Return new value
		return show;
	};
	Spoiler.prototype.toggle = function(save) {
		return this.set(!this.shown, save);
	};
	Spoiler.prototype.load = function() {
		var key = this._storageKey('show');
		var show = key && localStorage.getItem(key);
		return show ? this.set(show === 'true', false) : void 0;
	};
	Spoiler.prototype.save = function() {
		var key = this._storageKey('show');
		return key ? (localStorage.setItem(key, this.shown), this.shown) : void 0;
	};
	Spoiler.prototype.unsave = function() {
		var key = this._storageKey('show');
		return key ? (localStorage.removeItem(key), this.shown) : void 0;
	};
	Spoiler.prototype._storageKey = function(property) {
		return this.element.id ? ((window.storagePrefix || '') + '/' + property + '/' + this.element.id) : void 0;
	};
	Spoiler.prototype.addChangeListener = function(action, opts) {
		typeof opts === 'object' || (opts = {});
		var entry = {action: action};
		entry.maxCount = parseInt(opts.maxCount, 10);
		entry.maxCount < 0 && (entry.maxCount = NaN);
		entry.count = 0;
		if (entry.maxCount !== 0) {
			this._changeHandlers.push(entry);
			opts.now && this._callEventListener(entry, this.shown);
		}
		return entry;
	};
	Spoiler.prototype.removeChangeListener = function(entry) {
		var idx = this._changeHandlers.indexOf(entry);
		if (idx >= 0) {
			this._changeHandlers.splice(idx, 1);
			return true;
		}
		return false;
	};
	Spoiler.prototype._callEventListener = function(entry) {
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
			selector = '';
		} else if (selector instanceof Element || selector instanceof Spoiler) {
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
			// If selector is a string, match Spoiler entries against it
			Spoilers.data.forEach(function(spoiler, elt) {
				if (selector === '' || elt.matches(selector)) {
					result.set(spoiler, fn.apply(spoiler, args.map(argProc, spoiler)));
				}
			});
		} else {
			// Otherwise assume an array-like object of Element and/or Spoiler entries
			Array.prototype.forEach.call(selector, function(elt) {
				var spoiler = (elt instanceof Spoiler) ? elt : Spoilers.data.get(elt);
				if (spoiler) {
					result.set(spoiler, fn.apply(spoiler, args.map(argProc, spoiler)));
				}
			});
		}
		return result;
	}
	var Spoilers = {
		// Initialize Spoiler objects for the specified elements
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
				Spoilers.toggle(this);
			};
			var createPseudoButtons =
				(typeof PseudoButtons        === 'object'  ) &&
				(typeof PseudoButtons.create === 'function');
			// Process list of elements
			var spoilers = [];
			Array.prototype.forEach.call(elts, function(elt) {
				// Skip already initialized elements
				if (Spoilers.data.has(elt)) {
					return;
				}
				// Filter for Element objects
				if (elt instanceof Element) {
					var spoiler = new Spoiler(elt);
					// Add event handlers
					if (createPseudoButtons) {
						PseudoButtons.create(elt, doToggle);
					} else {
						elt.addEventListener('click', doToggle);
					}
					// Register data for the spoiler
					Spoilers.data.set(elt, spoiler);
					// Add Spoiler object to array of initialized objects
					spoilers.push(spoiler);
				}
			});
			// Return array of initialized objects (may be shorter than an array used as the original argument)
			return spoilers;
		},
		set: function(selector, show, save) {
			return forSelected(selector, Spoiler.prototype.set,
				{value: show, evalFunc: true}, {value: save, evalFunc: true});
		},
		toggle: function(selector, save) {
			return forSelected(selector, Spoiler.prototype.toggle,
				{value: save, evalFunc: true});
		},
		load: function(selector) {
			return forSelected(selector, Spoiler.prototype.load);
		},
		save: function(selector) {
			return forSelected(selector, Spoiler.prototype.save);
		},
		unsave: function(selector) {
			return forSelected(selector, Spoiler.prototype.unsave);
		},
		addChangeListener: function(selector, action, opts) {
			return forSelected(selector, Spoiler.prototype.addChangeListener,
				{value: action}, {value: opts, evalFunc: true});
		},
		removeChangeListener: function(selector, entry) {
			return forSelected(selector, Spoiler.prototype.removeChangeListener,
				{value: entry, evalFunc: true});
		},
		data: new Map()
	};
	window.Spoilers = Spoilers;
})();
