#!/usr/bin/env node
// Creates a production-ready dist/ folder.
// Copies website html, assets, build outputs, and rewrites dev build references to production ones.
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const distDir = path.join(root, 'dist');

function emptyDir(dir) {
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) {
        emptyDir(full);
        fs.rmdirSync(full);
      } else {
        fs.unlinkSync(full);
      }
    }
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) { return; }
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

function rewriteHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');
  // Replace dev build references ../build/website_dev -> ./build/website
  html = html.replace(/\.\.\/build\/website_dev\/o3dv\.website\.min/g, './build/website/o3dv.website.min');
  html = html.replace(/\.\.\/build\/website_dev/g, './build/website');
  fs.writeFileSync(filePath, html, 'utf8');
}

function main() {
  console.log('Creating production dist folder...');
  emptyDir(distDir);
  fs.mkdirSync(distDir, { recursive: true });

  // Copy website root HTML and assets
  const websiteSrc = path.join(root, 'website');
  const websiteDest = path.join(distDir);
  copyRecursive(websiteSrc, websiteDest);

  // Copy build outputs (engine + website)
  copyRecursive(path.join(root, 'build', 'website'), path.join(distDir, 'build', 'website'));
  copyRecursive(path.join(root, 'build', 'engine_prod'), path.join(distDir, 'build', 'engine'));
  // Fallback to engine if prod not built
  if (!fs.existsSync(path.join(distDir, 'build', 'engine', 'o3dv.min.js'))) {
    copyRecursive(path.join(root, 'build', 'engine'), path.join(distDir, 'build', 'engine'));
  }

  // Rewrite HTML files for prod bundle path
  rewriteHtml(path.join(distDir, 'index.html'));
  rewriteHtml(path.join(distDir, 'create.html'));

  console.log('dist folder created at:', distDir);
}

main();
