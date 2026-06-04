#!/usr/bin/env node
// Cross-platform asset copy for the dist/ folder.
// Mirrors the previous PowerShell-based "copy_assets_to_dist" step so the
// production build works on Windows, macOS and Linux (e.g. CI runners).
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const distDir = path.join(root, 'dist');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function copyFileToDist(file) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
  }
}

function copyGlobToDist(extension) {
  for (const file of fs.readdirSync(root)) {
    if (file.endsWith(extension) && fs.statSync(path.join(root, file)).isFile()) {
      fs.copyFileSync(path.join(root, file), path.join(distDir, file));
    }
  }
}

function copyDirToDist(dir) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(distDir, dir));
  }
}

function main() {
  fs.mkdirSync(distDir, { recursive: true });

  copyGlobToDist('.html');
  copyGlobToDist('.xml');
  copyFileToDist('robots.txt');
  copyFileToDist('studio.js');
  copyFileToDist('.htaccess');
  copyDirToDist('assets');
  copyDirToDist('info');

  console.log('Assets copied to', distDir);
}

main();
