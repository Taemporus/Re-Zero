/**
* (c) 2023 Taemporus
*/

/* eslint-disable no-cond-assign */
(function() {
	'use strict';
	var tippy;
	function TooltipData(owner, instance) {
		this.owner = (owner instanceof Element) ? owner : void 0;
		this.instance = instance;
		this.tooltipRoot = instance.popper;
		this.tooltip = instance.popper.getElementsByClassName('tippy-content')[0];
		this.ancestors = [];
		this.descendants = [];
		this.showOnTouch =
			this.owner.hasAttribute('data-tooltip-touch') &&
			this.owner.getAttribute('data-tooltip-touch').toLowerCase() !== 'false';
		this.touched = false;
	}
	var Tooltips = {
		/**
		 * Initialize each element with a "data-tippy-content" attribute
		 */
		init: function() {
			tippy = window.tippy;
			var elts = document.querySelectorAll('[data-tippy-content]:not([data-tippy-content=""])');
			Array.prototype.forEach.call(elts, function(elt) {
				elt.hasAttribute('tabindex') || elt.setAttribute('tabindex', 0);
			});
			var tips = tippy(elts, {
				appendTo: function(elt) {
					var parentId = elt.getAttribute('data-tooltip-parent');
					return parentId ? (document.getElementById(parentId) || document.body) : document.body;
				},
				aria: {
					content: 'describedby',
					expanded: false
				},
				interactive: true,
				inlinePositioning: true,
				hideOnClick: false,
				trigger: 'manual',
				onShow: function(instance) {
					// Increase 'armed' state
					// Will become fully 'armed' once the specified time has elapsed and any CSS transition is finished
					instance.disarm();
					instance.arm();
					instance.armTimer = setTimeout(function() {
						instance.arm();
						delete instance.armTimer;
					}, 100);
					// Cancel removal from DOM
					clearTimeout(instance.hideTimer);
					delete instance.hideTimer;
				},
				onShown: function(instance) {
					// Increase 'armed' state
					// Will become fully 'armed' once the time specified in 'onShow' has elapsed (possibly now)
					instance.arm();
				},
				onHide: function(instance) {
					// Set 'armed' state to its initial value
					instance.disarm();
					// Failsafe to ensure tooltip is eventually removed from DOM (issue on IE)
					// Update delay to be higher than any relevant transition duration
					instance.hideTimer = setTimeout(function() {
						instance.unmount();
						var parent = instance.popper.parentNode;
						if (parent) {
							parent.removeChild(instance.popper);
						}
						delete instance.hideTimer;
					}, 600);
				}
			});
			tips.forEach(function(instance) {
				// Create entry in the tooltip database
				var owner = instance.reference;
				var tooltipData = new TooltipData(owner, instance);
				Tooltips.data.set(owner, tooltipData);
				// 'armed' state: indicates that the tooltip is fully shown, and some time had elapsed since the trigger
				instance.armedState = 0;
				instance.arm = function() {
					instance.armedState++;
					instance.reference.classList.add('arming');
					if (instance.armedState >= 3) {
						instance.reference.classList.add('armed');
					}
				};
				instance.disarm = function() {
					clearTimeout(instance.armTimer);
					delete instance.armTimer;
					instance.armedState = 0;
					instance.reference.classList.remove('arming');
					instance.reference.classList.remove('armed');
				};
				// Triggers
				var triggerHandler = function(evt) {
					switch (evt.type) {
						case 'focus':
							var focusVisible = false;
							try {focusVisible = tooltipData.owner.matches(':focus-visible');} catch (err) {}
							focusVisible = focusVisible || tooltipData.owner.classList.contains('focus-visible');
							if (focusVisible) {
								Tooltips.focused = tooltipData;
							}
							break;
						case 'blur':
							if (Tooltips.focused === tooltipData) {
								Tooltips.focused = void 0;
							}
							break;
						case 'mouseenter':
							tooltipData.touched = tippy.currentInput.isTouch;
							Tooltips.hovered.add(tooltipData);
							break;
						case 'mouseleave':
							Tooltips.hovered.delete(tooltipData);
							break;
						default:
							return;
					}
					Tooltips._update();
				};
				['focus', 'blur', 'mouseenter', 'mouseleave'].forEach(function(type) {
					instance.reference.addEventListener(type, triggerHandler);
				});
			});
			// Register ancestor-descendant relationships between tooltip owners
			Tooltips.data.forEach(function(tooltipData, owner) {
				var node = owner, otherData;
				while (node = node.parentNode) {
					if (otherData = Tooltips.data.get(node)) {
						otherData.descendants.push(tooltipData);
						tooltipData.ancestors.push(otherData);
					}
				}
			});
			// Click handling
			Tooltips.data.forEach(function(tooltipData, owner) {
				// Ensure tooltip is shown before a click can be registered in case of touch input
				var listener = function(evt) {
					if (!evt.deepestTooltip) {
						var node = evt.target;
						do {
							if (evt.deepestTooltip = Tooltips.data.get(node)) {
								break;
							}
						} while (node = node.parentNode);
					}
					if (
						evt.deepestTooltip &&
						evt.deepestTooltip.owner === owner &&
						tippy.currentInput.isTouch &&
						tooltipData.showOnTouch &&
						!owner.classList.contains('armed')
					) {
						evt.preventDefault();
						evt.stopPropagation();
					}
				};
				try {
					owner.addEventListener('click', listener, {capture: true, passive: false});
				} catch (err) {
					owner.addEventListener('click', listener, true);
				}
			});
		},
		data: new Map(),
		focused: void 0,
		hovered: new Set(),
		shown: new Set(),
		_update: function() {
			var shown = new Set();
			// Always show tooltip of focused element
			if (Tooltips.focused) {
				shown.add(Tooltips.focused);
			}
			// Show tooltip of the last added minimal hovered tooltip owner 
			if (Tooltips.hovered.size > 0) {
				// Invert insertion order
				var hoveredA = [];
				Tooltips.hovered.forEach(function(tooltipData) {
					hoveredA.push(tooltipData);
				});
				// Check descendants with tooltips
				var tooltipData, i;
				hovered:
				while (tooltipData = hoveredA.pop()) {
					// If any are hovered, continue
					for (i = 0; i < tooltipData.descendants.length; i++) {
						if (Tooltips.hovered.has(tooltipData.descendants[i])) {
							continue hovered;
						}
					}
					// Unless touch input was used and the the tooltip is not set to be shown on touch, show the tooltip
					if (!tooltipData.touched || tooltipData.showOnTouch) {
						shown.add(tooltipData);
					}
					break;
				}
			}
			// Compare with tooltips shown before update
			var changes = new Map();
			shown.forEach(function(tooltipData) {
				changes.set(tooltipData, true);
			});
			Tooltips.shown.forEach(function(tooltipData) {
				if (!changes.get(tooltipData)) {
					changes.set(tooltipData, false);
				} else {
					changes.delete(tooltipData);
				}
			});
			// Execute changes
			changes.forEach(function(show, tooltipData) {
				if (show) {
					tooltipData.instance.show();
				} else {
					tooltipData.instance.hide();
				}
			});
			Tooltips.shown = shown;
		}
	};
	window.Tooltips = Tooltips;
})();
