/**
* (c) 2021 Taemporus
*/
(function() {
	'use strict';
	function NumberInput(element, type) {
		this.element = (element instanceof Element) ? element : void 0;
		this.type = type ? String(type) : "";
		// Default state
		this.value = void 0;
		this.load() || this.set();
		// Enforce restrictions on manual change
		this.element.addEventListener('change', (function(evt) {
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
			case "int": parse = parseInt; break;
			case "float": parse = parseFloat; break;
			default: parse = parseFloat;
		}
		// Parse value and bounds
		value = parse(value, 10);
		var min = (elt.min === "") ? Number.NaN : parse(elt.min, 10);
		var max = (elt.max === "") ? Number.NaN : parse(elt.max, 10);
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
		this._changeHandlers && this._changeHandlers.forEach(function(action) {
			try {
				action.call(this, value);
			} catch (err) {
				try {window.console.error(err);} catch (e) {}
			}
		}, this);
	};
	NumberInput.prototype.load = function() {
		var key = this._storageKey("value");
		var value = key && localStorage.getItem(key);
		return (typeof value === 'string') ? (this.set(value, false), true) : false;
	};
	NumberInput.prototype.save = function() {
		var key = this._storageKey("value");
		return key ? (localStorage.setItem(key, this.value), true) : false;
	};
	NumberInput.prototype.unsave = function() {
		var key = this._storageKey("value");
		return key ? (localStorage.removeItem(key), true) : false;
	};
	NumberInput.prototype._storageKey = function(property) {
		return this.element.id ? ((window.storagePrefix || "") + "/" + property + "/" + this.element.id) : void 0;
	};
	NumberInput.prototype.addChangeListener = function(action) {
		this._changeHandlers.push(action);
	};
	NumberInput.prototype.removeChangeListener = function(action) {
		var idx = this._changeHandlers.indexOf(action);
		if (idx >= 0) {
			this._changeHandlers.splice(idx, 1);
		}
	};
	var NumberInputs = {
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
				// Filter for 'input' elements with 'number' type
				if (elt instanceof Element && elt.matches("input[type='number']")) {
					var input = new NumberInput(elt, type);
					// Register data for the input element
					NumberInputs.data.set(elt, input);
					// Add NumberInput object to returned array
					inputs.push(input);
				}
			});
			// Return array of initialized inputs (may be shorter than an array used as the original argument)
			return inputs;
		},
		// Set values while enforcing restrictions
		set: function(selector, value, save) {
			// Process selector argument
			if (!selector) {
				selector = "";
			} else if (selector instanceof Element || selector instanceof NumberInput) {
				selector = [selector];
			}
			// Process matching elements
			if (typeof selector === 'string') {
				// If selector is a string, match NumberInput entries against it
				NumberInputs.data.forEach(function(input, elt) {
					if (selector === "" || elt.matches(selector)) {
						input.set(
							(typeof value === 'function') ? value(input) : value,
							(typeof save === 'function') ? save(input) : save
						);
					}
				});
			} else {
				// Otherwise assume an array-like object of Element and/or NumberInput entries
				Array.prototype.forEach.call(selector, function(elt) {
					var input = (elt instanceof NumberInput) ? elt : NumberInputs.data.get(elt);
					if (input) {
						input.set(
							(typeof value === 'function') ? value(input) : value,
							(typeof save === 'function') ? save(input) : save
						);
					}
				});
			}
		},
		unsave: function() {
			NumberInputs.data.forEach(function(input) {
				input.unsave();
			});
		},
		data: new Map()
	};
	window.NumberInputs = NumberInputs;
})();
