import fsp    from 'node:fs/promises';

import {
	PathData,
	PromiseChain,
	getConfs
}             from './_common.mjs';

const config = {
	srcDir: './src/other',
	dstDir: './docs',
	_srcName: [
		'browserconfig.xml',
		'site.webmanifest'
	]
};

function makeFile(conf) {
	const chain = new PromiseChain(), params = {};
	function chainEnd() {return chain.then(() => (params.file = dst, params)).get();}
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
	// Copy to specified location
	chain.then(src);
	chain.then(()   => fsp.mkdir   (dst.dir, {recursive: true}), 'old');
	chain.then(file => fsp.copyFile(file.path, dst.path));
	// Finish
	return chainEnd();
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

function other() {
	return makeFiles(config);
}

export default other;
