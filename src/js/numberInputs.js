/**
* (c) 2023 Taemporus
*/
(function() {
	'use strict';
	function NumberInput(element, type) {
		this.element = (element instanceof Element) ? element : void 0;
		this.type = type ? String(type) : '';
		// Default state
		this.value = void 0;
		this.load() || this.set();
		// Enforce restrictions on manual change
		this.element.addEventListener('change', (function() {
			this.set();
		}).bind(this));
		// State change handlers
		this._changeHandlers = [];
	}
	NumberInput.prototype.set = function(value, save) {
		var elt = this.element;
		// If value is unspecified, use the element's attribute
		value = (typeof value === 'undefined') ? elt.value : String(value);
		// Save value by default
		save = (typeof save === 'undefined') ? true : Boolean(save);
		// Choose parse method
		var parse;
		switch (this.type) {
			case 'int'  : parse = parseInt;   break;
			case 'float': parse = parseFloat; break;
			default: parse = parseFloat;
		}
		// Parse value and bounds
		value = parse(value, 10);
		var min = (elt.min === '') ? Number.NaN : parse(elt.min, 10);
		var max = (elt.max === '') ? Number.NaN : parse(elt.max, 10);
		// Clamp to bounds (prefer minimum if max < min)
		if (isNaN(value)) {
			value = isNaN(min) ? (isNaN(max) ? 0 : max) : min;
		} else {
			value = isNaN(max) ? value : Math.min(value, max);
			value = isNaN(min) ? value : Math.max(value, min);
		}
		// Set new value and save it if requested
		this.value = elt.value = value;
		if (save) {
			this.save();
		}
		// Execute state change handlers
		this._changeHandlers && this._changeHandlers.forEach(function(entry) {
			this._callEventListener(entry, value);
		}, this);
		// Return new value
		return value;
	};
	NumberInput.prototype.load = function() {
		var key = this._storageKey('value');
		var value = key && localStorage.getItem(key);
		return (typeof value === 'string') ? this.set(value, false) : void 0;
	};
	NumberInput.prototype.save = function() {
		var key = this._storageKey('value');
		return key ? (localStorage.setItem(key, this.value), this.value) : void 0;
	};
	NumberInput.prototype.unsave = function() {
		var key = this._storageKey('value');
		return key ? (localStorage.removeItem(key), this.value) : void 0;
	};
	NumberInput.prototype._storageKey = function(property) {
		return this.element.id ? ((window.storagePrefix || '') + '/' + property + '/' + this.element.id) : void 0;
	};
	NumberInput.prototype.addChangeListener = function(action, opts) {
		typeof opts === 'object' || (opts = {});
		var entry = {action: action};
		entry.maxCount = parseInt(opts.maxCount, 10);
		entry.maxCount < 0 && (entry.maxCount = NaN);
		entry.count = 0;
		if (entry.maxCount !== 0) {
			this._changeHandlers.push(entry);
			opts.now && this._callEventListener(entry, this.value);
		}
		return entry;
	};
	NumberInput.prototype.removeChangeListener = function(entry) {
		var idx = this._changeHandlers.indexOf(entry);
		if (idx >= 0) {
			this._changeHandlers.splice(idx, 1);
			return true;
		}
		return false;
	};
	NumberInput.prototype._callEventListener = function(entry) {
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
		} else if (selector instanceof Element || selector instanceof NumberInput) {
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
			// If selector is a string, match NumberInput entries against it
			NumberInputs.data.forEach(function(input, elt) {
				if (selector === '' || elt.matches(selector)) {
					result.set(input, fn.apply(input, args.map(argProc, input)));
				}
			});
		} else {
			// Otherwise assume an array-like object of Element and/or NumberInput entries
			Array.prototype.forEach.call(selector, function(elt) {
				var input = (elt instanceof NumberInput) ? elt : NumberInputs.data.get(elt);
				if (input) {
					result.set(input, fn.apply(input, args.map(argProc, input)));
				}
			});
		}
		return result;
	}
	var NumberInputs = {
		// Initialize NumberInput objects of the given type for the specified elements
		init: function(selector, type) {
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
			// Process list of elements
			var inputs = [];
			Array.prototype.forEach.call(elts, function(elt) {
				// Skip already initialized elements
				if (NumberInputs.data.has(elt)) {
					return;
				}
				// Filter for 'input' elements with 'number' type
				if (elt instanceof Element && elt.matches('input[type="number"]')) {
					var input = new NumberInput(elt, type);
					// Register data for the input element
					NumberInputs.data.set(elt, input);
					// Add NumberInput object to array of initialized objects
					inputs.push(input);
				}
			});
			// Return array of initialized objects (may be shorter than an array used as the original argument)
			return inputs;
		},
		// Set values while enforcing restrictions
		set: function(selector, value, save) {
			return forSelected(selector, NumberInput.prototype.set,
				{value: value, evalFunc: true}, {value: save, evalFunc: true});
		},
		load: function(selector) {
			return forSelected(selector, NumberInput.prototype.load);
		},
		save: function(selector) {
			return forSelected(selector, NumberInput.prototype.save);
		},
		unsave: function(selector) {
			return forSelected(selector, NumberInput.prototype.unsave);
		},
		addChangeListener: function(selector, action, opts) {
			return forSelected(selector, NumberInput.prototype.addChangeListener,
				{value: action}, {value: opts, evalFunc: true});
		},
		removeChangeListener: function(selector, entry) {
			return forSelected(selector, NumberInput.prototype.removeChangeListener,
				{value: entry, evalFunc: true});
		},
		data: new Map()
	};
	window.NumberInputs = NumberInputs;
})();
