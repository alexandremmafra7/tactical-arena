const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

const resDir = process.argv[2];
if (!resDir) {
  console.error('Missing resDir argument');
  process.exit(1);
}

const vendorModulesPath = path.join(resDir, 'vendor_modules');
if (fs.existsSync(vendorModulesPath)) {
  if (!Module.globalPaths.includes(vendorModulesPath)) {
    Module.globalPaths.push(vendorModulesPath);
  }
  process.env['NODE_PATH'] =
    (process.env['NODE_PATH'] ? process.env['NODE_PATH'] + path.delimiter : '') + vendorModulesPath;
  if (typeof Module._initPaths === 'function') {
    Module._initPaths();
  }
}

require(path.join(resDir, 'server-bundle.cjs'));
