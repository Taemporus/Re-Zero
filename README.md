# Re:Zero Season 2 — Anime Watchers’ Guide

## Visit the site: https://taemporus.github.io/Re-Zero/

## Build instructions

After modifying the configuration in `package.json` or the source files in `css/src` or `js/src`, perform the following steps to regenerate the required CSS and JS files:

1. Make sure **Node.js** is installed on the system.
2. Install **Gulp** via `npm install -g gulp-cli` (if not already installed).
3. In the repository’s base directory, run `npm install` to get the required modules.
4. Run `gulp build` to generate the CSS and JS files.
5. Copy the code from `js/loader.min.js` into the `<script id="script_loader">` element in `index.html`.

## Credits

### Images

- [Artofrob](https://www.deviantart.com/artofrob/art/Echidna-from-RE-Zero-852291451)
- [Neps](https://www.pixiv.net/en/artworks/59122273)

### Plugins and libraries

- [anime.js](https://animejs.com/) (3.2.1)
- [Modernizr](https://github.com/Modernizr/Modernizr/) (3.13.0)
- [Normalize.css](https://necolas.github.io/normalize.css/) (8.0.1)
- [Popper.js](https://popper.js.org/) (2.11.8)
- [Tippy.js](https://atomiks.github.io/tippyjs/) (6.3.7)

### Polyfills

- [focus-visible](https://github.com/WICG/focus-visible/) (5.2.0)
- [polyfill-library](https://github.com/financial-times/polyfill-library/) (4.8.0) (along with the [online service](https://polyfill.io/))
- [scrollingElement](https://github.com/mathiasbynens/document.scrollingElement) (1.5.2)
