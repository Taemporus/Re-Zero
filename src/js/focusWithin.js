/**
* (c) 2023 Taemporus
*/
(function() {
	'use strict';
	function FocusWithinObserver(container, targets, options) {
		this.container = (container instanceof Element) ? container : void 0;
		// Process targets
		if (targets) {
			// Convert to array
			this.targets = (targets instanceof Element) ? [targets] : Array.prototype.slice.call(targets);
		} else {
			// Or if unspecified, set to all descendants plus the container itself
			this.targets = Array.prototype.slice.call(container.querySelectorAll('*'));
			this.targets.unshift(container);
		}
		// Process options
		if (typeof options !== 'object' || options === null) {
			options = {};
		}
		this._fvPolyfilled = ('fvPolyfilled' in options) ? Boolean(options.fvPolyfilled) : true;
		this.callback = (typeof options.callback === 'function') ? options.callback : function() {};
		// Focus events
		this._focusHandler = FocusWithinObserver._focusHandler.bind(this);
		this._blurHandler = FocusWithinObserver._blurHandler.bind(this);
		this.eventListeners = [];
		this.targets.forEach(function(target) {
			target.addEventListener('focus', this._focusHandler, false);
			target.addEventListener('blur', this._blurHandler, false);
			this.eventListeners.push({target: target, type: 'focus', handler: this._focusHandler, useCapture: false});
			this.eventListeners.push({target: target, type: 'blur', handler: this._blurHandler, useCapture: false});
		}, this);
		// DOM modifications from polyfilled behaviour
		this.mutationObservers = [];
		if (this._fvPolyfilled) {
			var observer = new MutationObserver(FocusWithinObserver._fvPolyfillHandler.bind(this));
			var observerOptions = {subtree: false, childList: false, attributes: true, characterData: false};
			this.targets.forEach(function(target) {
				observer.observe(target, observerOptions);
			});
			this.mutationObservers.push(observer);
		}
		// Sets containing targets in various focus states
		this.focus = new Set();
		this.focusVisibleClass = new Set();
		this.focusVisiblePseudoClass = new Set();
		this._updatePending = false;
	}
	FocusWithinObserver.prototype.disconnect = function() {
		this.eventListeners.forEach(function(entry) {
			entry.target.removeEventListener(entry.type, entry.handler, entry.useCapture);
		});
		this.mutationObservers.forEach(function(observer) {
			observer.disconnect();
		});
		this.focus.clear();
		this.focusVisibleClass.clear();
		this.focusVisiblePseudoClass.clear();
		this._update();
	};
	FocusWithinObserver.prototype._update = function(delay) {
		delay = Math.min(Math.max(parseInt(delay, 10) || 0, 0), 1000);
		if (!this._updatePending) {
			this._updatePending = true;
			setTimeout((function() {
				var changes = [];
				var container = this.container;
				// focus-within
				var fwOld = container.classList.contains('focus-within');
				var fwNew = this.focus.size > 0;
				if (fwOld !== fwNew) {
					fwNew ? container.classList.add('focus-within') : container.classList.remove('focus-within');
					changes.push({property: 'focusWithin', oldValue: fwOld, newValue: fwNew});
				}
				// focus-visible-within
				var fvwOld = container.classList.contains('focus-visible-within');
				var fvwNew = this.focusVisibleClass.size + this.focusVisiblePseudoClass.size > 0;
				if (fvwOld !== fvwNew) {
					fvwNew
						? container.classList.add   ('focus-visible-within')
						: container.classList.remove('focus-visible-within');
					changes.push({property: 'focusVisibleWithin', oldValue: fvwOld, newValue: fvwNew});
				}
				// Execute callback
				if (changes.length) {
					try {
						this.callback(changes);
					} catch (err) {
						try {window.console.error(err);} catch (e) {}
					}
				}
				this._updatePending = false;
			}).bind(this), delay);
		}
	};
	FocusWithinObserver._focusHandler = function(evt) {
		var elt = evt.currentTarget;
		this.focus.add(elt);
		var focusVisible;
		try {focusVisible = elt.matches(':focus-visible');} catch (err) {focusVisible = false;}
		if (focusVisible) {
			this.focusVisiblePseudoClass.add(elt);
		}
		this._update(2);
	};
	FocusWithinObserver._blurHandler = function(evt) {
		var elt = evt.currentTarget;
		this.focus.delete(elt);
		this.focusVisiblePseudoClass.delete(elt);
		this._update(2);
	};
	FocusWithinObserver._fvPolyfillHandler = function(entries) {
		var changed = false;
		entries.forEach(function(entry) {
			if (entry.target.classList.contains('focus-visible')) {
				changed = (this.focusVisibleClass.size < this.focusVisibleClass.add(entry.target).size) || changed;
			} else {
				changed = this.focusVisibleClass.delete(entry.target) || changed;
			}
		}, this);
		if (changed) {
			this._update(2);
		}
	};
	var FocusWithin = {
		observe: function(container, targets, options) {
			// Remove previous observer and create new one
			FocusWithin.unobserve(container);
			var observer = new FocusWithinObserver(container, targets, options);
			// Add new observer to the static map
			FocusWithin.data.set(container, observer);
		},
		unobserve: function(container) {
			var observer = FocusWithin.data.get(container);
			observer && observer.disconnect();
			FocusWithin.data.delete(container);
		},
		data: new Map()
	};
	window.FocusWithin = FocusWithin;
})();
