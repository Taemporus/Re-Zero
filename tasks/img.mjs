import fsp      from 'node:fs/promises';
import strp     from 'node:stream/promises';
import proc     from 'node:child_process';
import util     from 'util';
const  execFile =     util.promisify(proc.execFile);

import gulp     from 'gulp';
import eol      from 'gulp-eol';
import rename   from 'gulp-rename';
import replace  from 'gulp-replace';
import svgmin   from 'gulp-svgmin';
import imgsize  from 'image-size';
const  sizeOf   =     util.promisify(imgsize);

import {
	argv,
	PathData,
	Temp,
	PipeLine,
	PromiseChain,
	getConfs,
	toColorCode
}               from './_common.mjs';

const configFavIcon = {
	src   : './src/img/icons/favicon_flat.svg',
	dstDir: './docs/img/icons',
	tokens: true,
	_: [{
		dstName: 'favicon',
		dstDir :  './docs',
		format : 'ico',
		images : {_size: [48, 32, 16]}
	}, {
		dstName: 'favicon-%wx%h',
		format : 'png',
		_size: [16, 32]
	}, {
		dstName: 'android-chrome-%wx%h',
		format : 'png',
		padding: 3 / 32,
		bgColor: [0x20, 0x00, 0x80],
		_size: [192, 512]
	}, {
		dstName: 'apple-touch-icon',
		format : 'png',
		size   : 180,
		padding: 4 / 45,
		bgColor: [0x20, 0x00, 0x80]
	}, {
		dstName: 'mstile-%wx%h',
		format : 'png',
		scale  : 1.8,
		fgColor: [0xff, 0xff, 0xff],
		_: [
			{size: [ 70,  70], padding: 1 / 8, Size: [128, 128]},
			{size: [150, 150], padding: 1 / 5},
			{size: [310, 150], padding: 1 / 5},
			{size: [310, 310], padding: 2 / 9},
			{size: [144, 144], padding: 1 / 8, scale: 1}
		]
	}, {
		dstName: 'safari-pinned-tab',
		format : 'svg',
		fgColor: [0, 0, 0]
	}, {
		dstName: 'maskable-icon',
		format : 'png',
		size   : 256,
		padding: 1 / 5,
		bgColor: [0x20, 0x00, 0x80]
	}]
};
const configUiIcons = {
	srcDir: './src/img/icons',
	dstDir: './docs/img/icons',
	format: 'svg',
	_srcName: [
		'book.svg',
		'info.svg',
		'lightbulb.svg',
		'manual.svg',
		'toggle.svg'
	]
};
const configPictures = {
	srcDir: './src/img',
	dstDir: './docs/img',
	tokens: true,
	_: [{
		srcName: 'og-logo.png',
		format: 'jpg',
		quality: 95
	}, {
		srcName: 'background.png',
		dstName: 'background-%w',
		_size: [3840, 1920],
		_: [{
			format: 'jpg',
			quality: 95
		}, {
			format: 'webp',
			quality: 95,
			filter: 60
		}]
	}]
};

function makeImage(conf) {
	const pipe = new PipeLine(), chain = new PromiseChain(), tmp = new Temp(), params = {};
	function copyToDest() {
		chain.then(()   => dst.resolve(), 'old');
		chain.then(()   => fsp.mkdir   (dst.dir, {recursive: true}), 'old');
		chain.then(file => fsp.copyFile(file.path, dst.path));
		return chain;
	}
	function chainEnd() {return chain.finally(() => tmp.clean()).then(() => (params.file = dst, params)).get();}
	// Source
	var _src      = conf.get('src',     {type: 'string',  default: ''      });
	var _srcDir   = conf.get('srcDir',  {type: 'string',  default: '.'     });
	var _srcName  = conf.get('srcName', {type: 'string',  default: ''      });
	var _srcExt   = conf.get('srcExt',  {type: 'string',  default: ''      });
	var src = new PathData(_src, _srcDir, _srcName, _srcExt);
	// Destination
	var format    = conf.get('format',  {type: 'string',  default: ''      , case: 'lower'});
	var _dst      = conf.get('dst',     {type: 'string',  default: ''      });
	var _dstDir   = conf.get('dstDir',  {type: 'string',  default: '.'     });
	var _dstName  = conf.get('dstName', {type: 'string',  default: src.name});
	var _dstExt   = conf.get('dstExt',  {type: 'string',  default: format || src.ext});
	var useTokens = conf.get('tokens',  {type: 'boolean', default: false   });
	var tokens = {
		'%%': '%',
		'%w': () => params.width,
		'%h': () => params.height,
		'%W': () => params.Width,
		'%H': () => params.Height
	};
	var dst = {
		resolve: () => {
			if (useTokens) {
				for (let [key, value] of Object.entries(tokens)) {
					value = (typeof value === 'function') ? value() : value;
					if (typeof value !== 'undefined') {
						_dstName = _dstName.replace(key, String(value));
					}
				}
			}
			return dst = new PathData(_dst, _dstDir, _dstName, _dstExt);
		}
	};
	// Generic image processing options
	var optimize = conf.get('optimize', {type: 'boolean', default: true});
	// Convert to specified target format
	switch (format) {
		// No processing, just copy file as is
		case '': {
			// Get image properties
			chain.then(sizeOf(src.path));
			chain.then(size => {
				[params.width, params.height] = [params.Width, params.Height] = [size.width, size.height];
			});
			// Copy to specified location
			chain.then(src);
			copyToDest();
			// Clean up and finish
			return chainEnd();
		}
		// SVG to SVG
		case 'svg': {
			if (src.ext !== 'svg') {
				return Promise.reject('Unable to convert image to SVG.');
			}
			// Get image properties
			chain.then(sizeOf(src.path));
			chain.then(size => {
				[params.width, params.height] = [params.Width, params.Height] = [size.width, size.height];
			});
			// Process image
			chain.then(tmp.make({postfix: '.svg'}));
			chain.then(file => {
				pipe.init(src.path);
				// Set foreground color
				var fg = params.fgColor = conf.get('fgColor', {type: 'int', array: true, default: void 0});
				if (fg) {
					pipe.add(replace(/(fill|stroke)="([^"]*)"/g, '$1="' + toColorCode(fg) + '"'));
					pipe.add(replace(/(fill|stroke):([^;]*);/g, '$1:'    + toColorCode(fg) + ';' ));
				}
				// Optimize image
				if (optimize) {
					pipe.add(svgmin({
						plugins: [
							{cleanupIDs: false}
						]
					}));
				}
				// Normalize line endings
				pipe.add(eol('\n', true));
				// Write stream
				pipe.add(rename(file.base));
				pipe.write(file.dir);
				return strp.finished(pipe.get());
			}, 'old');
			// Copy to specified location
			copyToDest();
			// Clean up and finish
			return chainEnd();
		}
		// Rasterize to PNG while applying basic transformations
		case 'png': {
			chain.then(sizeOf(src.path));
			chain.then(sizeOrig => {
				// Standard display dimensions
				var size = conf.get('size', {type: 'int', min: 0, array: true, default: []});
				[params.width = sizeOrig.width, params.height = params.width * sizeOrig.height / sizeOrig.width] = size;
				// Adjust by extra scaling
				var Size = conf.get('Size', {type: 'int', min: 0, array: true, default: void 0});
				if (typeof Size !== 'undefined') {
					[params.Width = 0, params.Height = params.Width] = Size;
				} else {
					let scale = conf.get('scale', {type: 'float', min: 0, default: 1});
					[params.Width, params.Height] = [params.width, params.height].map(v => Math.round(scale * v));
				}
				// Padding
				var padding = conf.get('padding', {type: 'float', array: true, default: []});
				var pad = params.padding = {};
				[pad.top = 0, pad.right = pad.top, pad.bottom = pad.top, pad.left = pad.right] = padding;
				var Pad = params.Padding = {};
				[Pad.top, Pad.right, Pad.bottom, Pad.left] = [
					pad.top    * params.Height,
					pad.right  * params.Width,
					pad.bottom * params.Height,
					pad.right  * params.Width
				].map(v => Math.round(v));
				// Compute size and position of content
				var wContMax = params.Width  - Pad.left - Pad.right;
				var hContMax = params.Height - Pad.top  - Pad.bottom;
				if (wContMax > 0 && hContMax > 0) {
					let content = params.content = {};
					if (sizeOrig.width * hContMax - wContMax * sizeOrig.height > 0) {
						content.width  = wContMax;
						content.height = Math.round(wContMax * sizeOrig.height / sizeOrig.width );
					} else {
						content.width  = Math.round(hContMax * sizeOrig.width  / sizeOrig.height);
						content.height = hContMax;
					}
					content.x = Pad.left + Math.floor((wContMax - content.width ) / 2);
					content.y = Pad.top  + Math.floor((hContMax - content.height) / 2);
				} else {
					params.content = void 0;
				}
				// Foreground and background
				params.fgColor = conf.get('fgColor', {type: 'int', array: true, default: void 0      });
				params.bgColor = conf.get('bgColor', {type: 'int', array: true, default: [0, 0, 0, 0]});
				// Validate parameters before generating image
				if (params.Width <= 0 || params.Height <= 0) {
					return Promise.reject('Image dimensions need to be positive.');
				} else {
					return Promise.resolve();
				}
			});
			// Render image
			let procOpts = {stdio: ['ignore', 'ignore', 'pipe']};
			chain.then(tmp.make({postfix: '.png'}));
			chain.then(file => {
				var cmd  = 'magick';
				var args = [];
				args.push(
					'-depth', 8,
					'-size', params.Width + 'x' + params.Height,
					'xc:' + toColorCode(params.bgColor)
				);
				if (params.content) {
					args.push('(');
					if (src.ext === 'svg') {
						args.push('-size', params.content.width + 'x' + params.content.height, '-background', 'none');
					}
					args.push(src.path);
					if (params.fgColor) {
						args.push('-fill', toColorCode(params.fgColor), '-colorize', 100);
					}
					args.push('-resize', params.content.width + 'x' + params.content.height);
					args.push(')', '-geometry', '+' + params.content.x + '+' + params.content.y, '-composite');
					args.push(
						'-define', 'png:compression-level=1',
						'-define', 'png:compression-strategy=0'
					);
				}
				args.push(file.path);
				return execFile(cmd, args, procOpts);
			}, 'old');
			// Optimize image
			if (optimize) {
				chain.then(file => execFile('oxipng', ['--opt',     0, '--strip', 'all', file.path], procOpts), 'old');
				chain.then(file => execFile('oxipng', ['--opt', 'max',                   file.path], procOpts), 'old');
				if (!argv.dev) {
					chain.then(file => execFile('oxipng', ['--opt', 'max', '--zopfli', file.path], procOpts), 'old');
				}
			}
			// Copy to specified location
			copyToDest();
			// Clean up and finish
			return chainEnd();
		}
		// JPG or WebP format
		case 'jpg':
		case 'webp': {
			// Render as PNG
			chain.then(tmp.make({postfix: '.png'}));
			chain.then(file => {
				var _conf = conf.clone();
				_conf.format   = 'png';
				_conf.optimize = false;
				_conf.dst      = file.path;
				return makeImage(_conf);
			}, 'new');
			// Copy processed image data
			chain.then(data => {
				Object.assign(params, data);
				return data.file;
			}, 'new');
			// Convert to WebP
			let procOpts = {stdio: ['ignore', 'ignore', 'pipe']};
			chain.then(tmp.make({postfix: '.' + format}), 'both');
			chain.then(file => {
				const cmd  = 'magick';
				const args = [file.old.path];
				if (format === 'webp') {
					const lossless = conf.get('lossless', {type: 'boolean', default: false});
					args.push(
						'-define', 'webp:thread-level=1',
						'-define', 'webp:lossless=' + String(lossless)
					);
					if (lossless) {
						const [quality, method] = [
							optimize ? (argv.dev ? 75 : 100) : 0,
							optimize ? (argv.dev ?  4 :   6) : 0
						];
						args.push(
							'-quality', quality,
							'-define', 'webp:method=' + method
						);
					} else {
						const [quality, filter, sharp, strong, method] = [
							conf.get('quality', {type: 'int', min: 0, max: 100, default: 90}),
							conf.get('filter' , {type: 'int', min: 0, max: 100, default: 50}),
							conf.get('sharp'  , {type: 'int', min: 0, max:   7, default:  0}),
							conf.get('strong' , {type: 'boolean', default: true}),
							optimize ? (argv.dev ? 4 : 6) : 0
						];
						args.push(
							'-quality', quality,
							'-define', 'webp:filter-strength='  + filter,
							'-define', 'webp:filter-sharpness=' + sharp,
							'-define', 'webp:filter-type=' + (strong ? 1 : 0),
							'-define', 'webp:method=' + method
						);
					}
				} else if (format === 'jpg') {
					const quality = conf.get('quality', {type: 'int', min: 0, max: 100, default: 90});
					args.push(
						'-quality', quality,
						'-interlace', 'plane',
						'-strip'
					);
				}
				args.push(file.new.path);
				return execFile(cmd, args, procOpts).then(() => file.new);
			});
			// Copy to specified location
			copyToDest();
			// Clean up and finish
			return chainEnd();
		}
		// ICO file with multiple components
		case 'ico': {
			// Render component images
			let subConfs = getConfs(
				conf.get('images', {array: true, default: []}),
				conf,
				{format: 'png', optimize: false}
			);
			let promises = subConfs.map(conf => tmp.make({postfix: '.png'}).then(file => {
				conf.dst = file.path;
				return makeImage(conf);
			}));
			chain.then(Promise.allSettled(promises));
			chain.then(results => {
				var comps = results
					.filter(res => res.status === 'fulfilled')
					.map   (res => res.value);
				if (comps.length === 0) {
					return Promise.reject('No components of ICO file rendered successfully.');
				} else {
					return Promise.resolve(comps);
				}
			}, 'new');
			// Copy processed image data from first component
			chain.then(comps => {
				Object.assign(params, comps[0]);
				return comps.map(data => data.file);
			}, 'new');
			// Create ICO file
			let procOpts = {stdio: ['ignore', 'ignore', 'pipe']};
			chain.then(tmp.make({postfix: '.ico'}), 'both');
			chain.then(file => {
				var cmd  = 'magick';
				var args = file.old.map(c => c.path);
				if (optimize) {
					args.push('-quality', 94);
				}
				args.push('-type', 'TrueColorAlpha');
				args.push(file.new.path);
				return execFile(cmd, args, procOpts).then(() => file.new);
			}, 'new');
			// Copy to specified location
			copyToDest();
			// Clean up and finish
			return chainEnd();
		}
		default:
			return Promise.reject('Invalid format: ' + format);
	}
}
function makeImages(config) {
	var confs = getConfs(config);
	var promises = [];
	for (let conf of confs) {
		promises.push(
			makeImage(conf).catch(reason => {
				console.error('Failed to generate image: ' + reason);
				console.error(conf);
				throw reason;
			})
		);
	}
	return Promise.waitForAll(promises, 'Failed to generate some files.');
}
function favicon() {
	return makeImages(configFavIcon);
}
function uiicons() {
	return makeImages(configUiIcons);
}
function pictures() {
	return makeImages(configPictures);
}
const img = gulp.parallel(favicon, uiicons, pictures);

export {favicon, uiicons, pictures};
export default img;
