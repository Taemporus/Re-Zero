import fsp  from 'node:fs/promises';
import strp from 'node:stream/promises';

import autoprefixer  from 'autoprefixer';
import cssnano       from 'cssnano';
import concat        from 'gulp-concat';
import eol           from 'gulp-eol';
import prettier      from 'gulp-prettier';
import postcss       from 'gulp-postcss';
import rename        from 'gulp-rename';
import * as dartSass from 'sass';
import gulpSass      from 'gulp-sass';
const  sass          =     gulpSass(dartSass);
import sourcemaps    from 'gulp-sourcemaps';
import merge         from 'merge2';

import {PathData, Temp, PipeLine, PromiseChain, getConfs} from './_common.mjs';

const config = {
	dstDir: './docs/css',
	_: [{
		action: 'merge',
		srcDir: './src/css',
		_: [{
			dstName: 'merged.min.css',
			sources: [{
				srcDir: './node_modules',
				_: [{
					srcName: 'normalize.css/normalize.css',
					alias  : 'normalize.css'
				}, {
					srcName: 'tippy.js/animations/scale.css',
					alias  : 'tippy/scale.css',
					pretty : true
				}, {
					srcName: 'tippy.js/animations/shift-toward.css',
					alias  : 'tippy/shift-toward.css',
					pretty : true
				}]
			}, {
				srcDir: './src/css',
				_srcName: [
					'style.scss'
				]
			}]
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
					const pretty = conf.get('pretty', {type: 'boolean', default: false});
					if (pretty) {
						pipe.add(prettier());
					}
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
				// Compile SASS stylesheets
				pipe.add(sass().on('error', sass.logError));
				// Merge and do postprocessing
				pipe.add(concat('merged.css'));
				let postcssPlugins = [];
				postcssPlugins.push(autoprefixer({
					grid: 'no-autoplace'
				}));
				minify && postcssPlugins.push(cssnano({
					preset: ['default', {
						discardComments: {removeAll: true}
					}]
				}));
				pipe.add(postcss(postcssPlugins));
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
function css() {
	return makeFiles(config);
}

export default css;
