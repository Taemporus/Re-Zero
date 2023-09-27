import gulp from 'gulp';

// Subtasks
import            './tasks/_common.mjs';
import css   from './tasks/css.mjs';
import js    from './tasks/js.mjs';
import img, {favicon, uiicons, pictures}
             from './tasks/img.mjs';
import html  from './tasks/html.mjs';
import other from './tasks/other.mjs';

// Compound tasks
const build = gulp.series(gulp.parallel(css, js, img), html, other);

// Export tasks
export {css, js, img, favicon, uiicons, pictures, html, other};
export default build;
