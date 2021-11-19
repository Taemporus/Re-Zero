const gulp = require('gulp');
const {series, parallel} = gulp;
const sourcemaps = require('gulp-sourcemaps');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const uglify = require('gulp-uglify');

const paths = {
	css: {
		srcdir: "./css/src/",
		src: [
			["merged.min.css", [
				"normalize.css",
				"style.scss",
				"tippy/animations/scale.css",
				"tippy/animations/shift-toward.css"
			]]
		],
		dest: "./css/"
	},
	js: {
		srcdir: "./js/src/",
		src: [
			["merged.min.js", [
				"scrollingElement.js",
				"touchDetector.js",
				"focusVisible.js",
				"focusWithin.js",
				"goto.js",
				"navigation.js",
				"pseudoButtons.js",
				"headerOverlays.js",
				"collapsibles.js",
				"spoilers.js",
				"numberInputs.js",
				"tooltips.js",
				"anime-3.2.1.min.js"
			]],
			["loader.min.js", [
				"loader.js"
			]]
		],
		dest: "./js/"
	}
}

function _css(fromPaths, toPath) {
	return gulp.src(fromPaths.map((path) => paths.css.srcdir + "?()" + path))
		.pipe(sourcemaps.init())
		.pipe(sass().on('error', sass.logError))
		.pipe(concat("merged.css"))
		.pipe(postcss([
			autoprefixer({
				grid: 'no-autoplace'
			}),
			cssnano()
		]))
		.pipe(rename(toPath))
		.pipe(sourcemaps.write(".", {
			destPath: ".",
			includeContent: false,
			sourceRoot: "src"
		}))
		.pipe(gulp.dest(paths.css.dest));
}
function css(cb) {
	for (let [toPath, fromPaths] of paths.css.src) {
		_css(fromPaths, toPath);
	}
	cb();
}
function _js(fromPaths, toPath) {
	gulp.src(fromPaths.map((path) => paths.js.srcdir + "?()" + path))
		.pipe(sourcemaps.init())
		.pipe(concat("merged.js"))
		.pipe(uglify({
			ie8: true,
			v8: true,
			webkit: true
		}))
		.pipe(rename(toPath))
		.pipe(sourcemaps.write(".", {
			destPath: ".",
			includeContent: false,
			sourceRoot: "src"
		}))
		.pipe(gulp.dest(paths.js.dest));
}
function js(cb) {
	for (let [toPath, fromPaths] of paths.js.src) {
		_js(fromPaths, toPath);
	}
	cb();
}

exports.css = css;
exports.js = js;
exports.build = parallel(css, js);
