/**
* (c) 2021 Taemporus
*/
(function() {
	'use strict';
	/**
	 * Obtain array containing all descendant nodes inside a node (including itself), in DOM order
	 */
	function getAllNodes(node) {
		var list = [], desc = node, checked = false, i = 0, next = node.nextSibling || node.parentNode;
		do {
			checked || (list[i++] = desc);
			desc = (!checked && desc.firstChild) || (checked = false, desc.nextSibling) || (checked = true, desc.parentNode);
		} while (desc !== next);
		return list;
	}
	function HeaderOverlay(container, headerTuple, insert, override) {
		this.container = (container instanceof Element) ? container : void 0;
		this.tuple = headerTuple;
		// Create DOM element tuples
		this.tuples = new Map();
		this._buildTuples(this.tuple);
		// Add appropriate styles to the overlay
		HeaderOverlay._setOverlayStyle(this.tuple.fixed, [['position', 'fixed'], ['top', "0"], ['box-sizing', 'border-box']]);
		HeaderOverlay._setOverlayStyle(this.tuple.bottom, [['position', 'absolute'], ['bottom', "0"], ['left', "0"], ['box-sizing', 'border-box']]);
		// Fix attributes
		this._fixAttributes();
		// Overlay is not yet attached to DOM
		this.mounted = false;
		// Function used for adding the overlay to the DOM
		this._insert = (typeof insert === 'function') ? insert : function() {};
		// May force the overlay to be visible/hidden under certain conditions
		this._override = (typeof override === 'function') ? override : function() {};
		// Properties of the header for easy access from outside
		this.bounds = {width: 0, height: 0, top: 0, left: 0};
		this.visible = headerTuple.forCopies(function() {return false;});
		// Monitor modifications to the header
		var observer = new MutationObserver(HeaderOverlay.prototype._updateDOM.bind(this));
		observer.observe(this.tuple.main, {subtree: true, childList: true, attributes: true, characterData: true});
		// Monitor the viewport's intersection with the containers
		observer = new IntersectionObserver(HeaderOverlay.prototype._updateIntersectionInfo.bind(this), {rootMargin: "0px", threshold: [0,1]});
		observer.observe(this.container);
		this.tuple.forAll(function() {
			observer.observe(this);
		});
	}
	/**
	 * Attach the overlay to the DOM
	 */
	HeaderOverlay.prototype.mount = function(queue) {
		var apply = (function() {
			if (!this.mounted) {
				// Update size etc.
				this.updateSize();
				this.updateLocation();
				this.updateVisibility();
				// Insert into DOM
				this._insert(this.container, this.tuple);
				this.mounted = true;
			}
		}).bind(this);
		queue ? queue.push(apply) : apply();
	};
	/**
	 * Remove the overlay from the DOM
	 */
	HeaderOverlay.prototype.unmount = function(queue) {
		var apply = (function() {
			this.tuple.forCopies(function() {
				this.parentNode && this.parentNode.removeChild(this);
			});
			this.mounted = false;
		}).bind(this);
		queue ? queue.push(apply) : apply();
	};
	/**
	 * Fully update the header overlay (contents, sizes etc.)
	 */
	HeaderOverlay.prototype.resync = function(queue) {
		var tuple = this.tuple;
		var header = tuple.main;
		var wasMounted = tuple.mounted;
		// Remove overlay from DOM
		this.unmount();
		// Update contents
		tuple.forCopies(function() {
			// Delete attributes
			var attrs = this.attributes;
			for (var i = attrs.length; i--;) {
				this.removeAttribute(attrs[i].name);
			}
			// Copy attributes
			Array.prototype.forEach.call(header.attributes, function(attr) {
				this.setAttribute(attr.name, attr.value);
			});
			// Replace contents
			this.innerHTML = header.innerHTML;
		});
		// Rebuild tuples of DOM nodes
		this._buildTuples(tuple, true);
		// Fix attributes of overlay nodes
		this._fixAttributes(queue);
		// Delay: Reinsert node into the DOM
		if (wasMounted) {
			var insert = this.mount.bind(this);
			queue ? queue.push(insert) : insert();
		}
	};
	/**
	 * Update size of the overlay
	 */
	HeaderOverlay.prototype.updateSize = function(queue) {
		var header = this.tuple.main;
		// Copy size for all descendant elements
		var hWidth, hHeight, updated = [];
		this.tuples.forEach(function(tuple, node) {
			if (!(node instanceof Element))
				return;
			updated.push(tuple);
			// Get current bounds
			var bounds = node.getBoundingClientRect();
			var w = bounds.width;
			var h = bounds.height;
			if (node === header) {
				hWidth = w;
				hHeight = h;
			}
			// Set width and height on overlay
			var wStr = w + "px";
			var hStr = h + "px";
			tuple.forCopies(function() {
				HeaderOverlay._setOverlayStyle(this, [['width', wStr], ['min-width', wStr], ['max-width', wStr], ['height', hStr], ['min-height', hStr], ['max-height', hStr]]);
			});
		}, this);
		// Delay: Apply style
		var apply = (function() {
			this._fixAttributes(updated, 'style');
			// Register size of header
			this.bounds.width = hWidth;
			this.bounds.height = hHeight;
		}).bind(this);
		queue ? queue.push(apply) : apply();
	};
	/**
	 * Set horizontal location of the overlay based on the standard header
	 */
	HeaderOverlay.prototype.updateLocation = function(queue) {
		// Get header bounds
		var bounds = this.tuple.main.getBoundingClientRect();
		// Set X-position
		var left = bounds.left;
		var leftStr = left + "px";
		HeaderOverlay._setOverlayStyle(this.tuple.fixed, [['left', leftStr]]);
		// Delay: Apply style
		var apply = (function() {
			this._fixAttributes(this.tuple, 'style');
			// Register location of the header
			this.bounds.left = left;
		}).bind(this);
		queue ? queue.push(apply) : apply();
	};
	HeaderOverlay.prototype._clearClientRects = function() {
		delete this.container._clientRect;
		this.tuple.forAll(function() {
			delete this._clientRect;
		});
	};
	HeaderOverlay.prototype._getClientRect = function(elt) {
		var rect = elt._clientRect;
		if (typeof rect !== 'object' || rect === null) {
			rect = elt.getBoundingClientRect();
			elt._clientRect = rect;
		}
		return rect;
	};
	HeaderOverlay.prototype._setClientRect = function(elt, rect) {
		elt._clientRect = rect;
	};
	/**
	 * Show or hide overlay headers based on the container's position on screen
	 */
	HeaderOverlay.prototype.updateVisibility = function(recompute, queue) {
		// Use override if applicable
		var visible = this.visibilityOverride();
		// Use stored bounding boxes unless a 'recompute' is requested
		if (recompute) {
			this._clearClientRects();
		}
		// Show fixed header if the main header starts above the visible area, and there is sufficient visible area in the container to fit the overlay inside
		if (typeof visible.fixed === 'undefined') {
			visible.fixed = (this._getClientRect(this.tuple.main).top < 0) && (this._getClientRect(this.tuple.bottom).top > 0);
		}
		// Show bottom header if the main header starts above the visible area, and there is insufficient (but non-zero) visible area to fit the overlay inside
		if (typeof visible.bottom === 'undefined') {
			visible.bottom = (this._getClientRect(this.tuple.main).top < 0) && (this._getClientRect(this.tuple.bottom).top <= 0) && (this._getClientRect(this.tuple.bottom).bottom > 0);
		}
		// Set visibility
		this.tuple.forCopies(function(visible) {
			HeaderOverlay._setOverlayStyle(this, [['visibility', visible ? 'visible' : 'hidden']]);
		}, visible);
		// Delay: Apply style
		var apply = (function() {
			this._fixAttributes(this.tuple, 'style');
			// Register visibility
			this.visible = visible;
		}).bind(this);
		queue ? queue.push(apply) : apply();
	};
	/**
	 * Store styles to be applied to a given node later
	 */
	HeaderOverlay._setOverlayStyle = function(node, style) {
		var styleMap = node._overlayStyle || (node._overlayStyle = new Map());
		style.forEach(function(entry) {
			if (styleMap.get(entry[0]) !== entry[1]) {
				(typeof entry[1] === 'undefined') ? styleMap.delete(entry[0]) : styleMap.set(entry[0], entry[1]);
				node._overlayStyleApplied = false;
			}
		});
	};
	/**
	 * Create tuple for each descendant of a specified DOM node in the header
	 */
	HeaderOverlay.prototype._buildTuples = function(nodeTuple, clear) {
		var tuples = this.tuples;
		if (clear) {
			tuples.clear();
		}
		var mTree = getAllNodes(nodeTuple.main);
		var fTree = getAllNodes(nodeTuple.fixed);
		var bTree = getAllNodes(nodeTuple.bottom);
		var newTuples = [], mNode, fNode, bNode, length = Math.min(mTree.length, fTree.length, bTree.length);
		for (var i = 0; i < length; i++) {
			mNode = mTree[i];
			fNode = fTree[i];
			bNode = bTree[i];
			tuples.set(mNode, newTuples[i] = new HeaderNodeTuple(mNode, fNode, bNode));
			mNode._original = mNode;
			fNode._original = mNode;
			bNode._original = mNode;
		}
		return newTuples;
	};
	/**
	 * Change values of selected attributes in specified header nodes as necessary
	 */
	HeaderOverlay.prototype._fixAttributes = function(nodes, attr) {
		var tuples = (typeof nodes === 'undefined') ?
			this.tuples :
			(!nodes ?
				[] :
				((!(nodes instanceof Node || nodes instanceof HeaderNodeTuple) || (nodes = [nodes])) &&
					Array.prototype.map.call(nodes, function(node) {return (node instanceof HeaderNodeTuple) ? node : this.tuples.get(node);}, this))
			);
		var attrFixes = (typeof attr === 'undefined') ?
			HeaderOverlay._attributeFixes :
			((typeof attr !== 'string' || (attr = [attr])) &&
				Array.prototype.map.call(attr, Map.prototype.get, HeaderOverlay._attributeFixes));
		tuples.forEach(function(tuple) {
			if (!tuple || !(tuple.main instanceof Element))
				return;
			attrFixes.forEach(function(fn) {(typeof fn === 'function') && fn.call(this, tuple);}, this);
		}, this);
	};
	/**
	 * Changes required for each attribute
	 */
	HeaderOverlay._attributeFixes = new Map([
		['id', function(tuple) {
			tuple.fixed.removeAttribute('id');
			tuple.bottom.removeAttribute('id');
		}],
		['tabindex', function(tuple) {
			tuple.fixed.hasAttribute('tabindex') && tuple.fixed.setAttribute('tabindex', -1);
			tuple.bottom.hasAttribute('tabindex') && tuple.bottom.setAttribute('tabindex', -1);
		}],
		['class', function(tuple) {
			if (tuple.main === this.tuple.main) {
				tuple.fixed.classList.add('header-overlay');
				tuple.bottom.classList.add('header-overlay');
			}
		}],
		['style', function(tuple) {
			tuple.forCopies(function() {
				if (this._overlayStyle && !this._overlayStyleApplied) {
					var overlayStyle = "";
					this._overlayStyle.forEach(function(value, property) {overlayStyle += ";" + property + ":" + value;});
					this.style.cssText += overlayStyle;
					this._overlayStyleApplied = true;
				}
			});
		}]
	]);
	/**
	 * Update overlay according to changes registered by a MutationObserver
	 */
	HeaderOverlay.prototype._updateDOM = function(mutations) {
		mutations = (mutations instanceof Array) ? mutations : [mutations];
		var doLayoutUpdate = false;
		mutations.forEach(function(mutation) {
			var mNode = mutation.target;
			var tuple = this.tuples.get(mNode);
			if (!tuple)
				return;
			switch (mutation.type) {
				case 'attributes':
					var attrName = mutation.attributeName;
					if (mNode.hasAttribute(attrName)) {
						var attrValue = mNode.getAttribute(attrName);
						tuple.fixed.setAttribute(attrName, attrValue);
						tuple.bottom.setAttribute(attrName, attrValue);
					} else {
						tuple.fixed.removeAttribute(attrName);
						tuple.bottom.removeAttribute(attrName);
					}
					this._fixAttributes(tuple, attrName);
					break;
				case 'characterData':
					doLayoutUpdate = true;
					tuple.fixed.data = mNode.data;
					tuple.bottom.data = mNode.data;
					break;
				case 'childList':
					doLayoutUpdate = true;
					Array.prototype.forEach.call(mutation.removedNodes, function(child) {
						var cTuple = this.tuples.get(child);
						if (!cTuple)
							return;
						getAllNodes(cTuple.fixed).forEach(function(fNode) {
							this.tuples.delete(fNode._original);
						}, this);
						tuple.fixed.removeChild(cTuple.fixed);
						tuple.bottom.removeChild(cTuple.bottom);
					}, this);
					Array.prototype.forEach.call(mutation.addedNodes, function(child) {
						var next = child, nextTuple;
						do {
							next = next.nextSibling;
							nextTuple = this.tuples.get(next);
						} while (next && !nextTuple);
						var cTuple = new HeaderNodeTuple(child);
						var newTuples = this._buildTuples(cTuple);
						this._fixAttributes(newTuples);
						tuple.fixed.insertBefore(cTuple.fixed, nextTuple ? nextTuple.fixed : null);
						tuple.bottom.insertBefore(cTuple.bottom, nextTuple ? nextTuple.bottom : null);
					}, this);
					break;
			}
		}, this);
		if (doLayoutUpdate) {
			this.updateSize();
			this.updateLocation();
			this.updateVisibility();
		}
	};
	/**
	 * Update if overlay is actively tracked according to changes registered by an IntersectionObserver
	 */
	HeaderOverlay.prototype._updateIntersectionInfo = function(changes) {
		changes.forEach(function(change) {
			this._setClientRect(change.target, change.boundingClientRect);
		}, this);
		this.updateVisibility(true);
	};
	/**
	 * Force visibility state of overlay elements under certain conditions
	 */
	HeaderOverlay.prototype.visibilityOverride = function() {
		var value = this._override(this.container, this.tuple);
		return (typeof value === 'object') ? value : this.tuple.forCopies(function() {
			return (typeof value === 'undefined') ? void 0 : Boolean(value);
		});
	};
	/**
	 * Redispatches an event from an overlay node to its standard version
	 */
	HeaderOverlay.prototype._eventRedirector = function(evt) {
		var newTarget;
		if ((typeof Event === 'function') && (newTarget = evt.target._original)) {
			evt.stopImmediatePropagation();
			newTarget.dispatchEvent(new Event(evt.type, evt));
		}
	};
	/**
	 * Turn on/off the redirection of events of specified type from the overlay to the standard header
	 */
	HeaderOverlay.prototype.redirectEvents = function(on, off) {
		on = (!on) ? [] : ((on instanceof Array) ? on : [on]);
		off = (!off) ? [] : ((off instanceof Array) ? off : [off]);
		var handler = this._eventRedirector;
		on.forEach(function(entry) {
			var type = (typeof entry === 'object') ? String(entry.type) : String(entry);
			var capture = (typeof entry === 'object') ? Boolean(entry.capture) : false;
			this.tuple.forCopies(function() {
				var handlerMap;
				((handlerMap = this._eventRedirection) instanceof Map) || (handlerMap = this._eventRedirection = new Map());
				var oldEntry = handlerMap.get(type);
				if (oldEntry) {
					if (oldEntry.capture) {
						return;
					} else if (capture) {
						this.removeEventListener(type, oldEntry.handler, oldEntry.capture);
						handlerMap.delete(type);
					} else {
						return;
					}
				}
				this.addEventListener(type, handler, capture);
				handlerMap.set(type, {handler: handler, capture: capture});
			});
		}, this);
		off.forEach(function(type) {
			this.tuple.forCopies(function() {
				var handlerMap = this._eventRedirection;
				var entry = handlerMap.get(type);
				if (entry) {
					this.removeEventListener(type, entry.handler, entry.capture);
					handlerMap.delete(type);
				}
			});
		}, this);
	};
	function HeaderNodeTuple(main, fixed, bottom) {
		this.main = (main instanceof Node) ? main : void 0;
		this.fixed = (fixed instanceof Node) ? fixed : (this.main && this.main.cloneNode(true));
		this.bottom = (bottom instanceof Node) ? bottom : (this.main && this.main.cloneNode(true));
	}
	HeaderNodeTuple.Results = function() {};
	HeaderNodeTuple.prototype._forSelected = function(keys, action, args) {
		args = (typeof args === 'undefined') ? [] : args;
		var emptyIdxs = [], resultIdxs = [], i = 0, j = 0, k = 0;
		for (i = args.length; i--;) {
			(i in args) ? ((args[i] instanceof HeaderNodeTuple.Results) && (resultIdxs[k++] = i)) : (emptyIdxs[j++] = i);
		}
		var localArgs = args.slice(), results = new HeaderNodeTuple.Results(), key;
		for (i = keys.length; i--;) {
			key = keys[i];
			for (j = emptyIdxs.length; j--;) {
				localArgs[emptyIdxs[j]] = this[key];
			}
			for (k = resultIdxs.length; k--;) {
				localArgs[resultIdxs[k]] = args[resultIdxs[k]][key];
			}
			results[key] = action.apply(this[key], localArgs);
		}
		return results;
	};
	HeaderNodeTuple.prototype.forAll = function(action, args) {
		return this._forSelected(["main", "fixed", "bottom"], action, (args instanceof Array) ? args : Array.prototype.slice.call(arguments, 1));
	};
	HeaderNodeTuple.prototype.forCopies = function(action, args) {
		return this._forSelected(["fixed", "bottom"], action, (args instanceof Array) ? args.slice() : Array.prototype.slice.call(arguments, 1));
	};
	var HeaderOverlays = {
		create: function(containers, headers, insert, override, suspendMount) {
			if (!HeaderOverlays.isInitialized)
				HeaderOverlays.init();
			
			// If <containers> and <headers> are a single Element, wrap in array, otherwise assume an array-like object
			if (containers instanceof Element) {
				containers = [containers];
			}
			if (headers instanceof Element) {
				headers = [headers];
			}
			// Don't suspend mounting overlay by default
			if (typeof suspendMount === 'undefined') {
				suspendMount = false;
			}
			// Create header nodes and set up behaviour
			var idxArray = Array(Math.min(containers.length, headers.length));
			for (var i = 0; i < idxArray.length; i++) {
				idxArray[i] = i;
			}
			var overlays = Array(idxArray.length);
			Array.prototype.forEach.call(idxArray, function(i) {
				var header = headers[i];
				// Store data
				var overlay = new HeaderOverlay(containers[i], new HeaderNodeTuple(header), insert, override);
				HeaderOverlays.data.set(header, overlay);
				overlays[i] = overlay;
			});
			
			// Suspend DOM manipulation if requested
			if (!suspendMount) {
				mount(overlays);
			}
			
			return overlays;
		},
		isInitialized: false,
		init: function() {
			// Update size and location of header overlay when the window is resized
			window.addEventListener('resize', function(evt) {
				HeaderOverlays.updateSize();
				HeaderOverlays.updateLocation();
				HeaderOverlays.updateVisibility();
			});
			// Update visibility of header overlay on scrolling
			window.addEventListener('scroll', function(evt) {
				var dx = window.pageXOffset - HeaderOverlays._scrollCache.x;
				var dy = window.pageYOffset - HeaderOverlays._scrollCache.y;
				HeaderOverlays._scrollCache.x += dx;
				HeaderOverlays._scrollCache.y += dy;
				if (dx !== 0) {
					HeaderOverlays.updateLocation();
				}
			});
			HeaderOverlays.isInitialized = true;
		},
		_scrollCache: {x: window.pageXOffset, y: window.pageYOffset},
		/**
		 * Key-value pairs of each header and the properties of the corresponding overlay
		 */
		data: new Map(),
		_updateHeaders: function(headers, updater) {
			var queue = [];
			// Process requested headers, or all if unspecified
			var overlays = (typeof headers === 'undefined') ?
				HeaderOverlays.data :
				(!headers ?
					[] :
					((!(headers instanceof Element || headers instanceof HeaderOverlay) || (headers = [headers])) &&
						Array.prototype.map.call(headers, function(header) {return (header instanceof HeaderOverlay) ? header : HeaderOverlays.data.get(header);}))
				);
			var args = Array.prototype.slice.call(arguments, 2);
			args.push(queue);
			overlays.forEach(function(overlay) {
				updater.apply(overlay, args);
			});
			// Do DOM updates
			queue.forEach(function(action) {action();});
		},
		/**
		 * Attach specified headers to the DOM
		 */
		mount: function(headers) {
			HeaderOverlays._updateHeaders(headers, HeaderOverlay.prototype.mount);
		},
		/**
		 * Fully update selected headers (contents, sizes etc.)
		 */
		resync: function(headers) {
			HeaderOverlays._updateHeaders(headers, HeaderOverlay.prototype.resync);
		},
		/**
		 * Set sizes based on the standard header
		 */
		updateSize: function(headers) {
			HeaderOverlays._updateHeaders(headers, HeaderOverlay.prototype.updateSize);
		},
		/**
		 * Set horizontal location based on the standard header
		 */
		updateLocation: function(headers) {
			HeaderOverlays._updateHeaders(headers, HeaderOverlay.prototype.updateLocation);
		},
		/**
		 * Show or hide overlay headers based on the container's position on screen
		 */
		updateVisibility: function(headers) {
			HeaderOverlays._updateHeaders(headers, HeaderOverlay.prototype.updateVisibility, true);
		}
	};
	window.HeaderOverlays = HeaderOverlays;
})();
