/**
* (c) 2023 Taemporus
*/
(function() {
	'use strict';
	var PseudoButtons = {
		_onClick: function(evt, action, eltType) {
			if (evt._used) {
				return;
			}
			evt._used = true;
			action.call(this, evt);
		},
		_onKeyPress: function(evt, action, eltType) {
			if (evt._used) {
				return;
			}
			evt._used = true;
			switch (evt.which || evt.keyCode) {
				// Enter: activate
				case 13:
					if (eltType !== 'button' && eltType !== 'link') {
						action.call(this, evt);
					}
					break;
				// Space: prevent default action (i.e. scrolling)
				case 32:
					if (eltType !== 'button') {
						evt.preventDefault();
					}
					break;
			}
		},
		_onKeyUp: function(evt, action, eltType) {
			if (evt._used) {
				return;
			}
			evt._used = true;
			switch (evt.which || evt.keyCode) {
				// Space: activate (& prevent default)
				case 32:
					if (eltType !== 'button') {
						action.call(this, evt);
					}
					break;
			}
		},
		create: function(selector, action, attrs) {
			// Get matching elements
			var elts;
			if (!selector) {
				return;
			} else if (typeof selector === 'string') {
				elts = document.querySelectorAll(selector);
			} else if (selector instanceof Element) {
				elts = [selector];
			} else {
				elts = selector;
			}
			if (!elts.length) {
				return;
			}
			// Default action
			(typeof action === 'function') || (action = function() {});
			// Process list of elements
			var buttons = [];
			Array.prototype.forEach.call(elts, function(elt) {
				if (!(elt instanceof Element)) {
					return;
				}
				var tag = elt.tagName.toLowerCase();
				var eltType = function() {
					if (tag === 'button') {
						return 'button';
					} else {
						return (tag === 'a' && elt.hasAttribute('href')) ? 'link' : 'other';
					}
				};
				// Add event handlers
				function addHandler(type, delegate) {
					elt.addEventListener(type, function(evt) {delegate.call(this, evt, action, eltType());});
				}
				addHandler('click'   , PseudoButtons._onClick   );
				addHandler('keypress', PseudoButtons._onKeyPress);
				addHandler('keyup'   , PseudoButtons._onKeyUp   );
				
				// Other attributes (accessibility etc.)
				// Compute manual values
				var attrsHere = {}, name;
				for (name in attrs) {
					Object.prototype.hasOwnProperty.call(attrs, name) &&
						(attrsHere[name] = (typeof attrs[name] === 'function') ? attrs[name](elt) : attrs[name]);
				}
				// Guess role if unspecified
				if (!Object.prototype.hasOwnProperty.call(attrsHere, 'role')) {
					switch (tag) {
						case 'button': attrsHere.role = 'button'; break;
						case 'a': attrsHere.role = 'link'; break;
						default: attrsHere.role = 'button';
					}
				}
				// Make focusable
				if (!Object.prototype.hasOwnProperty.call(attrsHere, 'tabindex')) {
					attrsHere.tabindex = 0;
				}
				// Set attributes
				for (name in attrsHere) {
					Object.prototype.hasOwnProperty.call(attrsHere, name) &&
						elt.setAttribute(name, attrsHere[name]);
				}
				
				// Add to list of "buttons" to be returned
				buttons.push(elt);
			});
			// Return array of created "buttons"
			return buttons;
		}
	};
	window.PseudoButtons = PseudoButtons;
})();
