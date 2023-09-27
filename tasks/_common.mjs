import fs   from 'node:fs';
import path from 'node:path';
import str  from 'node:stream';
import strp from 'node:stream/promises';

import yargs             from 'yargs';
import {hideBin}         from 'yargs/helpers';
import tmp               from 'tmp-promise';
import gulp              from 'gulp';
import {RewritingStream} from 'parse5-html-rewriting-stream';

/* Global options */
const argv = yargs(hideBin(process.argv))
	.option('dev', {
		default: false,
		type   :'boolean'
	})
	.argv;
process.env['NODE_ENV'] = argv.dev ? 'development' : 'production';

/* Utility functions and classes */
function PathData(pth, dir, name, ext) {
	this.path = pth
		? path.normalize(String(pth))
		: path.join(String(dir), String(name) + (ext ? '.' + String(ext) : ''));
	this.dir  = path.dirname (this.path);
	this.base = path.basename(this.path);
	this.ext  = path.extname (this.path);
	this.name = path.basename(this.path, this.ext);
	this.ext  = this.ext.replace(/^\./, '');
}
function Temp() {
	this.files = [];
}
Temp.prototype.make = function(options) {
	(typeof options === 'object' && options !== null) || (options = {});
	return tmp.file(Object.assign({tries: 16, keep: true}, options))
		.then(res => (this.files.push({data: res, status: 'created'}), new PathData(res.path)));
};
Temp.prototype.clean = function() {
	const files = this.files;
	return Promise.allSettled(files.filter(f => f.status === 'created').map(f =>
		f.data.cleanup().then(
			() => Promise.resolve(f.status = 'removed'     ),
			() => Promise.reject (f.status = 'removeFailed')
		)
	));
};
function PipeLine() {
	arguments.length > 0 && this.init.apply(this, arguments);
}
PipeLine.prototype.init = function(src, options) {
	if (src instanceof str.Stream) {
		this.stream = src;
	} else {
		this.stream = gulp.src(src, options);
	}
	return this;
};
PipeLine.prototype.get = function() {
	return this.stream;
};
PipeLine.prototype.add = function(stream) {
	this.stream = this.stream.pipe(stream);
	return this;
};
PipeLine.prototype.write = function(dir, options) {
	this.add(gulp.dest(dir, options));
	return this;
};
function PromiseChain() {
	this.init.apply(this, arguments);
}
PromiseChain.prototype.init = function(value) {
	this.promise = (value instanceof Promise) ? value : Promise.resolve(value);
	return this;
};
PromiseChain.prototype.get = function() {
	return this.promise;
};
PromiseChain.prototype.add = function(op, handler, value) {
	if (!['then', 'catch', 'finally'].includes(op)) {
		throw new Error('Invalid Promise operation');
	}
	var prev;
	var handlers = (Array.isArray(handler) ? handler : [handler])
		.map(h => (typeof h === 'function') ? h : (() => h))
		.map(h => (res => (prev = res, h(res))));
	var procVals;
	switch (String(value).toLowerCase()) {
		case 'old' : procVals = (prev, cur) => prev; break;
		case 'none': procVals = (prev, cur) => {}; break;
		case 'both': procVals = (prev, cur) => ({old: prev, new: cur}); break;
		case 'new' :
		default    : procVals = (prev, cur) => cur;  break;
	}
	this.promise = this.promise[op]
		.apply(this.promise, handlers)
		.then(res => Promise.resolve(procVals(prev, res)), res => Promise.reject(procVals(prev, res)));
	return this;
};
PromiseChain.prototype.then    = function(handler, value) {return this.add('then'   , handler, value);};
PromiseChain.prototype.catch   = function(handler, value) {return this.add('catch'  , handler, value);};
PromiseChain.prototype.finally = function(handler, value) {return this.add('finally', handler, value);};
Promise.waitForAll = function(promises, valueOnFail, valueOnSuccess) {
	return Promise.allSettled(promises).then(results => {
		const res = results.find(r => r.status === 'rejected');
		return res
			? Promise.reject((typeof valueOnFail === 'undefined') ? res.reason : valueOnFail)
			: Promise.resolve(valueOnSuccess);
	});
};
function parseValue(value, parser) {
	// Normalize parser
	if (typeof parser === 'function') {
		parser = {parse: parser};
	} else if (typeof parser === 'string') {
		parser = {type: parser};
	} else if (typeof parser !== 'object' || parser === null) {
		parser = {};
	}
	// Parse value
	if (typeof value === 'undefined' && Object.hasOwn(parser, 'default')) {
		value = parser.default;
	} else {
		let parse;
		if (Object.hasOwn(parser, 'parse') && typeof parser.parse === 'function') {
			parse = parser.parse;
		} else if (Object.hasOwn(parser, 'type') && typeof parser.type !== 'undefined') {
			const type = String(parser.type).toLowerCase();
			parse = val => {
				switch (type) {
					case 'boolean': val = Boolean(val); break;
					case 'string': {
						val = String(val);
						if (Object.hasOwn(parser, 'case')) {
							switch (String(parser.case).toLowerCase()) {
								case 'lower': val = val.toLowerCase(); break;
								case 'upper': val = val.toUpperCase(); break;
							}
						}
						break;
					}
					case 'int'  :
					case 'float': {
						let numParser = (type === 'int') ? parseInt : parseFloat;
						val = numParser(val, 10);
						let min = Object.hasOwn(parser, 'min') ? numParser(parser.min, 10) : Number.NaN;
						let max = Object.hasOwn(parser, 'max') ? numParser(parser.max, 10) : Number.NaN;
						if (isNaN(val)) {
							val = isNaN(min) ? (isNaN(max) ? 0 : max) : min;
						} else {
							val = isNaN(max) ? val : Math.min(val, max);
							val = isNaN(min) ? val : Math.max(val, min);
						}
						break;
					}
				}
				return val;
			};
		} else {
			parse = val => val;
		}
		if (Object.hasOwn(parser, 'array') && parser.array) {
			value = (Array.isArray(value) ? value : [value]).map(val => parse.call(val, val));
		} else {
			value = parse.call(value, value);
		}
	}
	return value;
}
function Config(config) {
	if (typeof config === 'object' && config !== null) {
		for (let [key, value] of Object.entries(config)) {
			this[key] = value;
		}
	}
}
Config.prototype.get = function(name, parser) {
	return parseValue(Object.hasOwn(this, name) ? this[name] : void 0, parser);
};
Config.prototype.clone = function() {
	return new Config(this);
};
function getConfs(config, inherit, override, confs) {
	Array.isArray(confs) || (confs = []);
	if (Array.isArray(config)) {
		for (let conf of config) {
			getConfs(conf, inherit, override, confs);
		}
		return confs;
	}
	if (typeof config !== 'object' || config === null) {
		return confs;
	}
	(typeof inherit  !== 'object' || inherit  === null) && (inherit  = {});
	(typeof override !== 'object' || override === null) && (override = {});
	const conf = new Config();
	Object.assign(conf, inherit);
	const varProps = {};
	for (let [key, value] of Object.entries(config)) {
		if (key.charAt(0) === '_') {
			varProps[key.substring(1)] = Array.isArray(value) ? value : [value];
		} else {
			conf[key] = value;
		}
	}
	var variants = [conf];
	var subConfs = void 0;
	for (let [key, value] of Object.entries(varProps)) {
		if (key === '') {
			subConfs = value;
		} else {
			variants = variants.flatMap(conf => value.map(val => {
				var _conf = conf.clone();
				_conf[key] = val;
				return _conf;
			}));
		}
	}
	if (typeof subConfs === 'undefined') {
		Array.prototype.push.apply(confs, variants.map(conf => Object.assign(conf, override)));
	} else {
		variants.forEach(conf => {
			getConfs(subConfs, conf, override, confs);
		});
	}
	return confs;
}
// Convert RGB / RGBA array to hexadecimal color code
function toColorCode(rgba, alphaAlways = false) {
	let [r = 0, g = 0, b = 0, a = 0xff] = parseValue(rgba, {type: 'int', min: 0, max: 0xff, array: true, default: []});
	return ((a < 0xff | alphaAlways) ? [r, g, b, a] : [r, g, b])
		.map(v => v.toString(16).padStart(2, '0'))
		.reduce((prev, cur) => prev + cur, '#');
}
// Replace text in HTML file
function replaceHtmlText(src, dst, transformSpec, syncRW) {
	// Normalize arguments
	[src, dst] = [src, dst].map(o => {
		if (typeof o === 'undefined') {
			return {};
		} else if (o instanceof str.Stream) {
			return {stream: o};
		} else if (typeof o === 'object' && o !== null) {
			return o;
		} else {
			return {path: o};
		}
	});
	Array.isArray(transformSpec) || (transformSpec = [transformSpec]);
	syncRW = (typeof syncRW !== 'undefined') ? Boolean(syncRW) : false;
	// Process arguments
	src = {
		stream  : (Object.hasOwn(src, 'stream')  && src.stream instanceof str.Readable) ? src.stream : void 0,
		path    :  Object.hasOwn(src, 'path')     ? String(src.path)     : void 0,
		encoding:  Object.hasOwn(src, 'encoding') ? String(src.encoding) : 'utf8',
		open    : () => src.stream || fs.createReadStream(src.path).setEncoding(src.encoding)
	};
	dst = {
		stream  : (Object.hasOwn(dst, 'stream')  && dst.stream instanceof str.Writable) ? dst.stream : void 0,
		path    :  Object.hasOwn(dst, 'path')     ? String(dst.path)     : src.path,
		encoding:  Object.hasOwn(dst, 'encoding') ? String(dst.encoding) : 'utf8',
		open    : () => dst.stream || fs.createWriteStream(dst.path).setDefaultEncoding(dst.encoding)
	};
	const transforms = [];
	function Transform(crit, text, maxCnt, keepWS, indent) {
		this.crit = (typeof crit !== 'undefined')
			? ((typeof crit === 'function') ? crit : (elt => elt.tagName === String(crit)))
			: (() => true);
		this.text = (typeof text !== 'undefined')
			? ((typeof text === 'function') ? text : (() => String(text)))
			: (() => '');
		this.keepWS = parseValue(keepWS, {type: 'boolean', default: true});
		this.indent = parseValue(indent, {type: 'boolean', default: true});
		this.maxCnt = parseInt(maxCnt, 10);
		isNaN(this.maxCnt) && (this.maxCnt = -1);
		this.cnt    = 0;
	}
	transformSpec.forEach(repl => {
		if (typeof repl !== 'object' || repl === null) {
			return;
		}
		var transform = new Transform(
			Object.hasOwn(repl, 'criterion'     ) ? repl.criterion      : void 0,
			Object.hasOwn(repl, 'text'          ) ? repl.text           : void 0,
			Object.hasOwn(repl, 'count'         ) ? repl.count          : void 0,
			Object.hasOwn(repl, 'keepWhiteSpace') ? repl.keepWhiteSpace : void 0,
			Object.hasOwn(repl, 'indent'        ) ? repl.indent         : void 0
		);
		if (transform.maxCnt !== 0) {
			transforms.push(transform);
		}
	});
	// Initialize rewriter stream
	const rewriter = new RewritingStream();
	const listeners = [];
	function addListener(evt, listener) {
		(Array.isArray(evt) ? evt : [evt]).forEach(evt => {
			listeners.push([evt, listener]);
			rewriter.on(evt, listener);
		});
	}
	function removeListeners() {
		for (let [evt, listener] of listeners) {
			rewriter.removeListener(evt, listener);
		}
	}
	Transform.prototype.apply = function(original, elt) {
		var text  = this.text.call(original, original, elt);
		if (typeof text !== 'string' && !text) {
			rewriter.emitRaw(original);
			return;
		}
		text = String(text);
		if (this.keepWS) {
			var spaceStart, spaceEnd;
			if (original.match(/^\s*$/)) {
				text = text + original;
			} else {
				var match = original.match(/^(\s*)\S([\s\S]*\S)?(\s*)$/);
				[spaceStart, spaceEnd] = [match[1] || '', match[3] || ''];
				if (this.indent && (match = spaceStart.match(/^.*\n([ \t]*)$/))) {
					text = text.replace(/\r?\n/g, '$&' + match[1]);
				}
				text = spaceStart + text + spaceEnd;
			}
		}
		rewriter.emitRaw(text);
		if (++this.cnt >= this.maxCnt && this.maxCnt >= 0) {
			var idx = transforms.indexOf(this);
			(idx >= 0) && transforms.splice(idx, 1);
		}
		(transforms.length === 0) && removeListeners();
	};
	var activeTransform, lastElt;
	addListener('startTag', (elt, raw) => {
		lastElt = elt;
		activeTransform = transforms.find(t => t.crit.call(void 0, elt, raw, t.cnt));
		rewriter.emitRaw(raw);
	});
	addListener('endTag', (elt, raw) => {
		(activeTransform && elt.tagName === lastElt.tagName) && activeTransform.apply('', lastElt);
		activeTransform = void 0;
		rewriter.emitRaw(raw);
	});
	addListener('text', (txt, raw) => {
		if (activeTransform) {
			activeTransform.apply(raw, lastElt);
			activeTransform = void 0;
		} else {
			rewriter.emitRaw(raw);
		}
	});
	// Perform the operations
	var promise;
	var inStr = src.open().pipe(rewriter);
	if (syncRW) {
		var content = '';
		promise = strp.finished(inStr.on('data', chunk => (content += chunk)))
			.then(() => strp.finished(str.Readable.from(content).pipe(dst.open())));
	} else {
		promise = strp.finished(inStr.pipe(dst.open()));
	}
	return promise.then(() => dst.stream || new PathData(dst.path));
}

// Exports
export {argv, PathData, Temp, PipeLine, PromiseChain, parseValue, Config, getConfs, toColorCode, replaceHtmlText};
