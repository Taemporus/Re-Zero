import fsp  from 'node:fs/promises';
import str  from 'node:stream';
import strp from 'node:stream/promises';

import concat     from 'gulp-concat';
import eol        from 'gulp-eol';
import modernizr  from 'gulp-modernizr';
import rename     from 'gulp-rename';
import sourcemaps from 'gulp-sourcemaps';
import uglify     from 'gulp-uglify';
import merge      from 'merge2';
import polyfill   from 'polyfill-library';
import vinyl      from 'vinyl';
import toBuffer   from 'vinyl-buffer';
import toVinyl    from 'vinyl-source-stream';

import {PathData, Temp, PipeLine, PromiseChain, getConfs} from './_common.mjs';

const config = {
	dstDir: './docs/js',
	_: [{
		action: 'merge',
		_: [{
			dstName: 'merged.min.js',
			sources: [{
				srcDir: './node_modules',
				_: [{
					srcName: 'scrollingelement/scrollingelement.js',
					alias  : 'scrollingElement.js'
				}, {
					srcName: 'focus-visible/dist/focus-visible.js',
					alias  : 'focusVisible.js'
				}, {
					srcName: 'animejs/lib/anime.min.js',
					alias  : 'anime.js'
				}]
			}, {
				srcDir: './src/js',
				_srcName: [
					'touchDetector.js',
					'focusWithin.js',
					'goto.js',
					'navigation.js',
					'pseudoButtons.js',
					'headerOverlays.js',
					'collapsibles.js',
					'spoilers.js',
					'numberInputs.js',
					'tooltips.js'
				]
			}]
		}, {
			dstName: 'loader.min.js',
			sources: {
				srcDir : './src/js',
				srcName: 'loader.js'
			}
		}]
	}, {
		action: 'copy',
		_: [{
			srcDir: './node_modules/@popperjs/core/dist',
			_srcName: ['umd/popper.min.js', 'umd/popper.min.js.map']
		}, {
			srcDir: './node_modules/tippy.js/dist',
			_srcName: ['tippy-bundle.umd.min.js', 'tippy-bundle.umd.min.js.map']
		}]
	}, {
		action: 'polyfill',
		_: [{
			dstName: 'polyfill.min.js',
			features: [
				'Array.prototype.find',
				'Element.prototype.classList',
				'Element.prototype.dataset',
				'Element.prototype.matches',
				'IntersectionObserver',
				'Map',
				'MutationObserver',
				'Object.assign',
				'Promise',
				'Set'
			],
			srcName: 'polyfill.js'
		}]
	}, {
		action: 'modernizr',
		_: [{
			dstName: 'modernizr.min.js',
			features: [
				'csspointerevents',
				'webp'
			],
			prefix: '',
			srcName: 'modernizr.js'
		}]
	}]
};

function makeFile(conf) {
	const pipe = new PipeLine(), chain = new PromiseChain(), tmp = new Temp(), params = {};
	function chainEnd() {return chain.finally(() => tmp.clean()).then(() => (params.file = dst, params)).get();}
	// Basic configuration settings
	var action   = conf.get('action' , {type: 'string', case: 'lower', default: ''});
	var _dst     = conf.get('dst'    , {type: 'string', default: '' });
	var _dstDir  = conf.get('dstDir' , {type: 'string', default: '.'});
	var _dstName = conf.get('dstName', {type: 'string', default: '' });
	var dst = {resolve: () => dst = new PathData(_dst, _dstDir, _dstName)};
	// Perform requested action
	switch (action) {
		case 'copy': {
			// Get source path
			let src = new PathData(
				conf.get('src'    , {type: 'string', default: '' }),
				conf.get('srcDir' , {type: 'string', default: '.'}),
				conf.get('srcName', {type: 'string', default: '' })
			);
			// Finalize destination
			_dstName ||= src.base;
			dst.resolve();
			// Copy to specified location
			chain.then(() => fsp.mkdir(dst.dir, {recursive: true}));
			chain.then(() => fsp.copyFile(src.path, dst.path));
			// Clean up and finish
			return chainEnd();
		}
		case 'merge': {
			// Process configuration
			let sourceMap = conf.get('sourceMap', {type: 'boolean', default: true});
			let minify    = conf.get('minify'   , {type: 'boolean', default: true});
			// Get sources
			let sources = getConfs(
				conf.get('sources', {array: true, default: []})
					.map(src => (typeof src === 'object') ? src : {srcName: String(src)}),
				conf
			);
			chain.then(() => {
				return sources.length === 0
					? Promise.reject('No source files provided.')
					: Promise.resolve(sources);
			});
			// Do preprocessing
			chain.then(sources => {
				const paths = [], streams = [];
				sources.forEach(conf => {
					const src = new PathData(
						conf.get('src'    , {type: 'string', default: '' }),
						conf.get('srcDir' , {type: 'string', default: '.'}),
						conf.get('srcName', {type: 'string', default: '' })
					);
					const pipe = new PipeLine();
					pipe.init(src.path);
					const alias = conf.get('alias', {type: 'string', default: ''});
					if (alias) {
						pipe.add(rename(alias));
						paths.push(new PathData(alias));
					} else {
						pipe.add(rename(path => {path.dirname = '';}));
						paths.push(new PathData(src.base));
					}
					pipe.add(eol('\n', true));
					streams.push(pipe.get());
				});
				pipe.init(merge.apply(null, streams));
				return paths;
			});
			// Finalize destination
			chain.then(files => {
				_dstName ||= files[0].base;
				dst.resolve();
			});
			// Process files
			chain.then(() => {
				sourceMap && pipe.add(sourcemaps.init());
				// Merge and do postprocessing
				pipe.add(concat('merged.js'));
				minify && pipe.add(uglify({
					ie8: true,
					v8: true,
					webkit: true
				}));
				// Write stream
				pipe.add(rename(dst.base));
				sourceMap && pipe.add(sourcemaps.write('.', {
					includeContent: true,
					sourceRoot: 'src'
				}));
				pipe.write(dst.dir);
				return strp.finished(pipe.get());
			});
			// Clean up and finish
			return chainEnd();
		}
		case 'modernizr':
		case 'polyfill': {
			// Process configuration
			const features  = conf.get('features' , {type: 'string', array: true, default: []});
			const minify    = conf.get('minify'   , {type: 'boolean', default: true});
			const sourceMap = conf.get('sourceMap', {type: 'boolean', default: true});
			const srcName   = conf.get('srcName'  , {type: 'string' , default: ''  }) || 'tmp.js';
			// Finalize destination
			chain.then(() => {
				_dstName ||= '.js';
				dst.resolve();
			});
			chain.then(() => {
				// Generate unminified script
				if (action === 'modernizr') {
					// Additional parameters
					const prefix = conf.get('prefix', {type: 'string', default: ''});
					// Generate script
					pipe.init(str.Readable.from([new vinyl({path: 'dummy.js', contents: Buffer.from('')})]));
					pipe.add(modernizr({
						crawl: false,
						quiet: true,
						classPrefix: prefix,
						uglify: false,
						tests: features,
						options: []
					}));
				} else if (action === 'polyfill') {
					// Additional parameters
					const flags = ['always', 'gated'];
					// Generate script
					pipe.init(polyfill.getPolyfillString({
						minify: false,
						features: Object.fromEntries(features.map(name => [name, {flags: flags}])),
						rum: false,
						stream: true
					}));
					// Convert to Vinyl object stream
					pipe.add(toVinyl(srcName));
					pipe.add(toBuffer());
					// Generate corresponding URL for the online polyfill service
					params.url = 'https://polyfill.io/v3/polyfill.min.js?features='
						+ features.join('%2C')
						+ '&flags=gated';
				}
				pipe.add(eol('\n', true));
				// Do postprocessing
				sourceMap && pipe.add(sourcemaps.init());
				minify && pipe.add(uglify({
					ie8: true,
					v8: true,
					webkit: true
				}));
				// Write stream
				pipe.add(rename(dst.base));
				sourceMap && pipe.add(sourcemaps.write('.', {
					includeContent: true,
					sourceRoot: 'src'
				}));
				pipe.write(dst.dir);
				return strp.finished(pipe.get());
			});
			// Clean up and finish
			return chainEnd();
		}
	}
}
function makeFiles(config) {
	var confs = getConfs(config);
	var promises = [];
	for (let conf of confs) {
		promises.push(
			makeFile(conf).catch(reason => {
				console.error('Failed to generate file: ' + reason);
				console.error(conf);
				throw reason;
			})
		);
	}
	return Promise.waitForAll(promises, 'Failed to generate some files.');
}
function js() {
	return makeFiles(config);
}

export default js;
