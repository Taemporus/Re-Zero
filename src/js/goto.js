/**
* (c) 2023 Taemporus
*/

/* eslint-disable no-cond-assign */
/* global PseudoButtons, anime*/
(function() {
	'use strict';
	var GoTo = {
		globalCallbacks: {
			init: [],
			beforeScroll: [function(link, target) {link   && link  .blur(); }],
			afterScroll:  [function(link, target) {target && target.focus();}]
		},
		maxTime: 1000,
		distanceForMaxTime: 3000,
		getDuration: function(start, stop, container) {
			return GoTo.maxTime * Math.min(1, Math.sqrt(Math.abs(stop - start) / GoTo.distanceForMaxTime));
		},
		init: function() {
			// Initialize each element with a "data-goto" attribute
			var elts = document.querySelectorAll('[data-goto]');
			// Event handler
			var doScroll = function(evt) {
				var link = this;
				var target = document.getElementById(this.getAttribute('data-goto'));
				if (!target) {
					return;
				}
				
				evt.stopPropagation();
				var localCallbacks = {};
				for (var type in GoTo.globalCallbacks) {
					if (Object.prototype.hasOwnProperty.call(GoTo.globalCallbacks, type)) {
						localCallbacks[type] = GoTo.globalCallbacks[type].map(
							function(f) {
								return function() {return f(link, target);};
							}
						);
					}
				}
				GoTo.scrollTo(target, null, {
					target: 'top',
					offset: function() {return link && link.getAttribute('data-goto-offset');},
					margin: function() {return {
						top:    target && target.getAttribute('data-goto-margintop'   ),
						bottom: target && target.getAttribute('data-goto-marginbottom')
					};},
					force: true,
					duration: GoTo.getDuration,
					callbacks: localCallbacks
				});
			};
			// Process elements
			var createPseudoButtons =
				(typeof PseudoButtons        === 'object'  ) &&
				(typeof PseudoButtons.create === 'function');
			Array.prototype.forEach.call(elts, function(elt) {
				// Add event handler
				if (createPseudoButtons) {
					PseudoButtons.create(elt, doScroll);
				} else {
					elt.addEventListener('click', doScroll);
				}
				// Tooltips
				if (!elt.getAttribute('data-tippy-animation')) {
					elt.setAttribute('data-tippy-animation', 'shift-toward');
				}
			});
		},
		/**
		 * Scroll to a specified element in its scrollable ancestor
		 */
		scrollTo: function(elt, container, options) {
			// Get first scrollable ancestor
			if (!container) {
				container = elt.parentElement;
				while (container && (['scroll', 'auto'].indexOf(window.getComputedStyle(container).overflowY) < 0)) {
					container = container.parentElement;
				}
				if (!container || container === document.documentElement || container === document.body) {
					container = document.scrollingElement || document.documentElement;
				}
			}
			// Process options
			(typeof options === 'object' && options !== null) || (options = {});
			var callbacks = options.callbacks;
			(typeof callbacks === 'object' && callbacks !== null) || (callbacks = {});
			for (var type in callbacks) {
				if (!Object.prototype.hasOwnProperty.call(callbacks, type)) {
					continue;
				}
				var actions = callbacks[type];
				(actions instanceof Array) || (callbacks[type] = [actions]);
			}
			// Function to process callbacks of a given type
			var executeCallbacks = function(type) {
				var actions = callbacks[type];
				if (!actions) {
					return;
				}
				Array.prototype.forEach.call(actions, function(action) {
					if (typeof action === 'function') {
						var result;
						try {
							result = action();
						} catch (err) {
							try {window.console.error(err);} catch (e) {}
						}
						if (typeof result === 'object' && result !== null && result.type && result.action) {
							callbacks[result.type] = callbacks[result.type] || [];
							callbacks[result.type].push(result.action);
						}
					}
				});
			};
			// Process 'init' callbacks
			executeCallbacks('init');
			// Get element's location in container and the current scroll position
			var eltHeight = elt.offsetHeight;
			var eltTop = elt.offsetTop;
			var node = elt.offsetParent;
			do {
				if (node === container) {
					break;
				} else if (node === container.offsetParent) {
					eltTop -= container.offsetTop + container.clientTop;
					break;
				} else {
					eltTop += node.clientTop + node.offsetTop;
				}
			} while (node = node.offsetParent);
			var eltBottom = eltTop + eltHeight;
			var contHeight = container.clientHeight;
			var contTop = container.scrollTop;
			var contBottom = contTop + contHeight;
			// Get and apply margins
			var margin = (typeof options.margin === 'function') ? options.margin(elt, container) : options.margin;
			margin = margin ? ((typeof margin === 'object') ? margin : {top: margin, bottom: margin}) : {};
			var marginTop = parseInt(margin.top, 10) || 0;
			var marginBottom = parseInt(margin.bottom, 10) || 0;
			eltTop = eltTop - marginTop;
			eltBottom = eltBottom + marginBottom;
			eltHeight = eltBottom - eltTop;
			// Don't do scrolling if the element is already visible (unless options.force == true)
			var twoDelta = (eltTop + eltBottom) - (contTop + contBottom);
			var visible = (Math.abs(twoDelta) <= contHeight - eltHeight);
			if (!options.force && visible) {
				return {container: container, scroll: contTop};
			}
			// Determine the end position for the element
			var target;
			switch (options.target) {
				case 'top':
				case 'bottom':
				case 'center':
					target = options.target;
					break;
				case 'nearest':
					target = (twoDelta > 0) ? 'bottom' : 'top';
					break;
				case 'farthest':
					target = (twoDelta > 0) ? 'top' : 'bottom';
					break;
				default:
					target = 'center';
			}
			// Calculate scroll positions
			var scrollStart = contTop;
			var scrollStop = scrollStart;
			switch (target) {
				case 'top':
					scrollStop = eltTop;
					break;
				case 'bottom':
					scrollStop = eltBottom - contBottom + contTop;
					break;
				case 'center':
					scrollStop = scrollStart + twoDelta / 2;
					break;
			}
			var offset = (typeof options.offset === 'function') ? options.offset(elt, container) : options.offset;
			scrollStop += parseInt(offset, 10) || 0;
			// Do scrolling
			var animate = options.duration || options.animation;
			if (animate && (typeof anime !== 'function')) {
				animate = false;
				try {
					window.console.warn(
						'Smooth scrolling relies on Anime.js. Falling back to instantaneous scrolling.'
					);
				} catch (err) {}
			}
			if (animate) {
				var animationOptions = {
					duration: options.duration,
					easing: 'easeInOutSine',
					begin:    function() {executeCallbacks('beforeScroll');},
					complete: function() {executeCallbacks('afterScroll' );}
				};
				for (var name in options.animation) {
					if (!Object.prototype.hasOwnProperty.call(options.animation, name)) {
						continue;
					}
					if ([
						'begin', 'complete', 'update', 'loopBegin', 'loopComplete',
						'change', 'changeBegin', 'changeComplete'
					].indexOf(name) >= 0 && animationOptions[name]) {
						animationOptions[name] = (function(def, man) {
							return function() {
								(typeof def === 'function') && def.apply(null, arguments);
								(typeof man === 'function') && man.apply(null, arguments);
							};
						})(animationOptions[name], options.animation[name]);
					} else {
						animationOptions[name] = options.animation[name];
					}
				}
				animationOptions.duration = Number(
					(typeof animationOptions.duration === 'function')
						? animationOptions.duration(scrollStart, scrollStop, container)
						: animationOptions.duration
				);
				animationOptions.targets = container;
				animationOptions.scrollTop = scrollStop;
				anime(animationOptions);
			} else {
				executeCallbacks('beforeScroll');
				container.scrollTop = scrollStop;
				executeCallbacks('afterScroll');
			}
			return {container: container, scroll: scrollStop};
		}
	};
	window.GoTo = GoTo;
})();
