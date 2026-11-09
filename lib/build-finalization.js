// Keep the editable React JSX source; serve one local production bundle offline.
const path = require('node:path');
const fs = require('node:fs');
const { buildSync } = require('esbuild');
const root = path.join(__dirname, '..');
buildSync({
  absWorkingDir: root, entryPoints: ['public/js/finalization.jsx'],
  outfile: 'public/js/finalization.bundle.js', bundle: true, minify: true,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'eof', target: ['es2020']
});
fs.copyFileSync(path.join(root, 'node_modules/react/LICENSE'), path.join(root, 'public/vendor/REACT-LICENSE.txt'));
console.log('Built public/js/finalization.bundle.js from public/js/finalization.jsx.');
