# Re:Zero Season 2 — Anime Watchers’ Guide

## Visit the site: [https://taemporus.github.io/Re-Zero/](https://taemporus.github.io/Re-Zero/)

## Build

After modifying the configuration in `package.json` or the source files in `src`, perform the following steps to regenerate the required files:

0. Required software: **Node.js** (18+), **ImageMagick** (7+), **OxiPNG** (8+) (make sure the binaries are in your `PATH`).
1. In the repository’s base directory, run `npm install` to get the required modules (repeat each time the dependencies in `package.json` are modified).
2. Execute `npm run build` to generate the files. The constituent tasks of this build process may be listed with `npm run tasks`, and executed individually using the `npm run build [TASK]...` syntax. The `build-dev` argument may be used in place of `build` to skip the more time consuming optimizations.

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
