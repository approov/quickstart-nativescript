const fsExtra = require('fs-extra'); // src/preuninstall-hooks.js
const path = require('path');

require('@nativescript/hook')(__dirname).preuninstall();

console.log('Removing Nativescript Config!!');

fsExtra.removeSync(path.resolve(__dirname, '..', '..', '..', 'nativescript.config.js'));
