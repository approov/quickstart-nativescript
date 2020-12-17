const fsExtra = require('fs-extra'); // src/postinstall-hooks.js
const path = require('path');

console.log('Generating Nativescript Config!!');

fsExtra.ensureFileSync(path.resolve(__dirname, '..', '..', '..', 'nativescript.config.js'));

require('@nativescript/hook')(__dirname).postinstall();
