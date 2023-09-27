import fs     from 'node:fs';
import fsp    from 'node:fs/promises';
import path   from 'node:path';

import {
	PathData,
	Temp,
	PromiseChain,
	getConfs,
	replaceHtmlText
}             from './_common.mjs';

const config = {
	srcDir: './src/html',
	dstDir: './docs',
	_: [{
		srcName: 'index.html',
		imports: true
	}]
};

class Comment {
	static parse(text, commentStyles) {
		// Normalize arguments
		text = String(text);
		commentStyles = (Array.isArray(commentStyles) ? commentStyles : [commentStyles]).map(String);
		// Iterate over allowed comment syntaxes
		const comment = new Comment();
		for (let style of commentStyles) {
			let match = null;
			switch (style) {
				case '/*': match = text.match(/^(?<prefix>\/\*)(?<content>([^*]|\*[^/])*)(?<postfix>\*\/)/); break;
				case '//': match = text.match(/^(?<prefix>\/\/)(?<content>[^\n]*)(?<postfix>)$/);            break;
			}
			if (match) {
				return Object.assign(comment, match.groups);
			}
		}
		return null;
	}
	prefix  = '';
	content = '';
	postfix = '';
	get text() {
		return this.prefix + this.content + this.postfix;
	}
}
function processHtml(conf) {
	const chain = new PromiseChain(), tmp = new Temp(), params = {};
	function chainEnd() {return chain.finally(() => tmp.clean()).then(() => (params.file = dst, params)).get();}
	// Process configuration
	var src = new PathData(
		conf.get('src',     {type: 'string', default: ''      }),
		conf.get('srcDir',  {type: 'string', default: '.'     }),
		conf.get('srcName', {type: 'string', default: ''      })
	);
	var dst = new PathData(
		conf.get('dst',     {type: 'string', default: ''      }),
		conf.get('dstDir',  {type: 'string', default: '.'     }),
		conf.get('dstName', {type: 'string', default: src.base})
	);
	// Process file
	var imports = conf.get('imports');
	chain.then(src);
	// Resolve imports
	if (imports) {
		chain.then(tmp.make({postfix: '.html'}), 'both');
		chain.then(file => {
			var transforms = [];
			for (let type of ['css', 'js']) {
				if (!((imports === true) || (Array.isArray(imports) && imports.includes(type)))) continue;
				const transform = {};
				transform.criterion = {
					css: elt => elt.tagName === 'style',
					js : elt => elt.tagName === 'script'
				}[type];
				const commentStyles = {
					css: ['/*'],
					js : ['/*', '//']
				}[type];
				transform.text = text => {
					var comment, match;
					if (
						(comment = Comment.parse(text.trim(), commentStyles)) &&
						(match = comment.content.trim().match(/^@include\s+"([^"]*)"(?:\s+"([^"])*")?$/))
					) {
						var importFile = new PathData(void 0, dst.dir, match[1]);
						var content = fs.readFileSync(importFile.path, {encoding: match[2] || 'utf8'}).trim();
						var lastLineIdx = content.lastIndexOf('\n') + 1;
						var lastLine = content.substring(lastLineIdx);
						if (
							(comment = Comment.parse(lastLine, commentStyles)) &&
							(match = comment.content.match(/^(\s*#\s+sourceMappingURL=)(.*\S)(\s*)$/))
						) {
							var mapFile = new PathData(void 0, importFile.dir, match[2]);
							comment.content =
								match[1] +
								path.relative(dst.dir, mapFile.path).replace(path.sep, path.posix.sep) +
								match[3];
							content = content.substring(0, lastLineIdx) + comment.text;
						}
						return content;
					}
				};
				transforms.push(transform);
			}
			return replaceHtmlText(file.old.path, file.new.path, transforms);
		});
	}
	// Copy to specified location
	chain.then(()   => fsp.mkdir   (dst.dir, {recursive: true}), 'old');
	chain.then(file => fsp.copyFile(file.path, dst.path));
	// Clean up and finish
	return chainEnd();
}

function html() {
	var confs = getConfs(config);
	var promises = [];
	for (let conf of confs) {
		promises.push(
			processHtml(conf).catch(reason => {
				console.error('Failed to generate HTML file: ' + reason);
				console.error(conf);
				throw reason;
			})
		);
	}
	return Promise.waitForAll(promises, 'Failed to generate some files.');
}

export default html;
