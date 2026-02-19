const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFirstExisting(candidates, dest) {
  for (const source of candidates) {
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, dest);
      return source;
    }
  }
  return null;
}

const root = path.resolve(__dirname, '..');
const xtermRoot = path.join(root, 'node_modules', 'xterm');
const outDir = path.join(root, 'public', 'vendor', 'xterm');

ensureDir(outDir);

const copiedJs = copyFirstExisting(
  [
    path.join(xtermRoot, 'lib', 'xterm.js'),
    path.join(xtermRoot, 'lib', 'xterm.min.js'),
  ],
  path.join(outDir, 'xterm.js')
);

const copiedCss = copyFirstExisting(
  [
    path.join(xtermRoot, 'css', 'xterm.css'),
    path.join(xtermRoot, 'css', 'xterm.min.css'),
  ],
  path.join(outDir, 'xterm.css')
);

if (!copiedJs || !copiedCss) {
  console.error('Could not locate xterm assets in node_modules/xterm.');
  process.exit(1);
}

console.log(`Copied xterm assets:
JS:  ${copiedJs}
CSS: ${copiedCss}`);
