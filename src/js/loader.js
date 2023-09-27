/**
* (c) 2023 Taemporus
*/
(function() {
	'use strict';
	var Loader = {
		/**
		 * Load and execute an external script once its dependencies have been imported
		 * Can be referred to by others as a dependency via the 'id' specified
		 */
		import: function(id, source, requires, callback, async, defer) {
			// Create and initialize ScriptData object
			return (new ScriptData(id, source, requires, callback, async, defer)).init();
		},
		/**
		 * Run a specified function once its dependencies have been met imported
		 */
		run: function(fn, requires, callback) {
			// Create and initialize FunctionData object
			return (new FunctionData(fn, requires, callback)).init();
		},
		/**
		 * Preload a resource of the specified type once a specified set of dependencies has been imported
		 */
		load: function(type, source, requires, callback) {
			// Create and initialize ResourceData object
			return (new ResourceData(type, source, requires, callback)).init();
		},
		entries: [],
		scripts: {},
		functions: [],
		resources: []
	};
	/**
	 * Abstract loader entry with dependencies
	 */
	function LoaderEntry(requires, callback) {
		this.requires = {};
		this.reqByStatus = {};
		[ScriptData.LOADING, ScriptData.LOADED, ScriptData.FAILED].forEach(function(status) {
			this.reqByStatus[status] = {};
		}, this);
		((requires instanceof Array) ? requires : (requires ? [requires] : [])).forEach(function(dep) {
			dep = (typeof dep === 'object' && dep !== null) ? dep : {id: dep};
			var scriptData = Loader.scripts[dep.id];
			var depEntry = {
				data: scriptData,
				soft: (typeof dep.soft !== 'undefined') ? Boolean(dep.soft) : false
			};
			this.requires[dep.id] = depEntry;
			var status = scriptData ? scriptData.status : ScriptData.LOADING;
			this.reqByStatus[status][dep.id] = depEntry;
			if (scriptData) {
				scriptData.requiredBy.push(this);
			}
		}, this);
		this.callback = (typeof callback === 'function') ? callback : function() {};
		this.isInitialized = false;
		this.isReady = false;
		this.isFinished = false;
		this.isPaused = false;
		this.isAborted = false;
		this.success = void 0;
		this.failData = void 0;
	}
	LoaderEntry.prototype.updateDependency = function(id, newStatus) {
		if (
			Object.prototype.hasOwnProperty.call(this.requires   , id       ) &&
			Object.prototype.hasOwnProperty.call(this.reqByStatus, newStatus)
		) {
			var status;
			for (status in this.reqByStatus) {
				Object.prototype.hasOwnProperty.call(this.reqByStatus, status) &&
					delete this.reqByStatus[status][id];
			}
			this.reqByStatus[newStatus][id] = this.requires[id];
		}
		this.checkDependencies();
	};
	LoaderEntry.prototype.checkDependencies = function() {
		var id, reqs;
		for (id in (reqs = this.reqByStatus[ScriptData.FAILED])) {
			if (Object.prototype.hasOwnProperty.call(reqs, id) && !reqs[id].soft) {
				this.ready(reqs[id].data);
				return;
			}
		}
		for (id in (reqs = this.reqByStatus[ScriptData.LOADING])) {
			if (Object.prototype.hasOwnProperty.call(reqs, id)) {
				return;
			}
		}
		this.ready();
	};
	LoaderEntry.prototype.init = function() {
		if (this.isInitialized || this.isAborted) {
			return;
		}
		this.isInitialized = true;
		if (typeof this._init === 'function') {this._init();}
		Loader.entries.push(this);
		this.checkDependencies();
		return this;
	};
	LoaderEntry.prototype.ready = function(failed) {
		if (this.isReady || this.isAborted) {
			return;
		}
		this.isReady = true;
		if (typeof this._ready === 'function') {this._ready(failed);}
	};
	LoaderEntry.prototype.finish = function(failData) {
		if (this.isFinished) {
			return;
		}
		this.isFinished = true;
		this.failData = failData;
		this.success = !this.failData;
		if (typeof this._finish === 'function') {this._finish(failData);}
		try {
			this.callback.call(this, {success: this.success, failData: (this.success ? void 0 : this.failData)});
		} catch (err) {
			try {window.console.error(err);} catch (e) {}
		}
	};
	LoaderEntry.prototype.pause = function() {
		this.isPaused = true;
		if (typeof this._pause === 'function') {this._pause();}
	};
	LoaderEntry.prototype.resume = function() {
		this.isPaused = false;
		if (typeof this._resume === 'function') {this._resume();}
	};
	LoaderEntry.prototype.abort = function() {
		this.isAborted = true;
		this.finish(this);
	};
	/**
	 * Externally sourced script
	 */
	function ScriptData(id, source, requires, callback, async, defer) {
		// Inherit from LoaderEntry
		LoaderEntry.call(this, requires, callback);
		// Own properties
		this.id = String(id);
		this.sources = (source instanceof Array) ? source.slice() : (source ? [source] : []);
		this.sourceIndex = 0;
		this.status = ScriptData.LOADING;
		this.requiredBy = [];
		Loader.entries.forEach(function(entry) {
			if (Object.prototype.hasOwnProperty.call(entry.requires, this.id)) {
				this.requiredBy.push(entry);
				entry.requires[this.id].data = this;
				entry.updateDependency(this.id, this.status);
			}
		}, this);
		this.async = (typeof async !== 'undefined') ? Boolean(async) : true;
		this.defer = (typeof defer !== 'undefined') ? Boolean(defer) : false;
		this.preloader = void 0;
		this.scriptNode = void 0;
	}
	// Inherit from LoaderEntry
	ScriptData.prototype = Object.create(LoaderEntry.prototype);
	ScriptData.prototype.constructor = ScriptData;
	// Methods
	ScriptData.prototype._init = function() {
		this.preloader = (new ResourceData('script', this.sources)).init();
		Loader.scripts[this.id] = this;
	};
	ScriptData.prototype._ready = function(failed) {
		if (failed) {
			this.finish(failed);
		} else {
			if (this.preloader) {
				this.preloader.pause();
				this.sourceIndex = this.preloader.sourceIndex;
			}
			this.attachNode();
		}
	};
	ScriptData.prototype.attachNode = function() {
		if (this.isPaused) {
			this._resume = this.attachNode;
			return;
		}
		var thisObj = this;
		if (this.sourceIndex < this.sources.length) {
			var node = document.createElement('script');
			this.scriptNode = node;
			node.id = this.id;
			node.async = this.async;
			node.defer = this.defer;
			node.addEventListener('load', function() {
				thisObj.finish();
			});
			node.addEventListener('error', function() {
				thisObj.sourceIndex++;
				thisObj.attachNode();
			});
			node.src = String(this.sources[this.sourceIndex]);
			var oldNode = document.getElementById(node.id);
			if (oldNode) {
				var parent = oldNode.parentNode;
				var next = oldNode.nextSibling;
				oldNode.parentNode.removeChild(oldNode);
				parent.insertBefore(node, next);
			} else {
				document.head.appendChild(node);
			}
		} else {
			this.finish(this);
		}
	};
	ScriptData.prototype._finish = function(failData) {
		if (this.preloader) {
			this.preloader.abort();
		}
		this.status = this.success ? ScriptData.LOADED : ScriptData.FAILED;
		this.requiredBy.forEach(function(entry) {
			entry.updateDependency(this.id, this.status);
		}, this);
	};
	ScriptData.LOADING = 0;
	ScriptData.LOADED = 1;
	ScriptData.FAILED = -1;
	/**
	 * Inline script
	 */
	function FunctionData(fn, requires, callback) {
		// Inherit from LoaderEntry
		LoaderEntry.call(this, requires, callback);
		// Own properties
		this.execute = (typeof fn === 'function') ? fn : function() {};
	}
	// Inherit from LoaderEntry
	FunctionData.prototype = Object.create(LoaderEntry.prototype);
	FunctionData.prototype.constructor = FunctionData;
	// Methods
	FunctionData.prototype._init = function() {
		Loader.functions.push(this);
	};
	FunctionData.prototype._ready = function(failed) {
		this.finish(failed);
	};
	FunctionData.prototype._finish = function(failData) {
		if (this.success) {
			try {
				this.execute();
			} catch (err) {
				this.failData = this;
				this.success = false;
				try {window.console.error(err);} catch (e) {}
			}
		}
	};
	/**
	 * Generic external resource
	 */
	function ResourceData(type, source, requires, callback) {
		// Inherit from LoaderEntry
		LoaderEntry.call(this, requires, callback);
		// Own properties
		this.type = String(type);
		this.sources = (source instanceof Array) ? source.slice() : (source ? [source] : []);
		this.sourceIndex = 0;
		this.preloadNode = void 0;
	}
	// Inherit from LoaderEntry
	ResourceData.prototype = Object.create(LoaderEntry.prototype);
	ResourceData.prototype.constructor = ResourceData;
	// Methods
	ResourceData.prototype._init = function() {
		Loader.resources.push(this);
	};
	ResourceData.prototype._ready = function(failed) {
		failed ? this.finish(failed) : this.attachNode();
	};
	ResourceData.prototype.attachNode = function() {
		if (this.isPaused) {
			this._resume = this.attachNode;
			return;
		}
		var thisObj = this;
		if (this.sourceIndex < this.sources.length) {
			var node = document.createElement('link');
			node.rel = 'preload';
			node.as = this.type;
			node.href = String(this.sources[this.sourceIndex]);
			node.addEventListener('load', function() {
				thisObj.finish();
			});
			node.addEventListener('error', function() {
				thisObj.sourceIndex++;
				thisObj.attachNode();
			});
			var oldNode, parent;
			if ((oldNode = this.preloadNode) && (parent = oldNode.parentNode)) {
				var next = oldNode.nextSibling;
				oldNode.parentNode.removeChild(oldNode);
				parent.insertBefore(node, next);
			} else {
				document.head.appendChild(node);
			}
			this.preloadNode = node;
		} else {
			this.finish(this);
		}
	};
	ResourceData.prototype._finish = function(failData) {
		var node = this.preloadNode;
		if (node && node.parentNode) {
			node.parentNode.removeChild(node);
		}
	};
	window.Loader = Loader;
})();
