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
  // Replace dev build references for single-folder deployment
  html = html.replace(/\.\.\/build\/website_dev\/o3dv\.website\.min/g, './o3dv.website.min');
  html = html.replace(/\.\.\/build\/website_dev/g, './');
  html = html.replace(/\.\/build\/website\/o3dv\.website\.min/g, './o3dv.website.min');
  html = html.replace(/\.\/build\/engine\/o3dv\.min/g, './o3dv.min');
  html = html.replace(/\.\.\/assets\//g, './assets/');
  fs.writeFileSync(filePath, html, 'utf8');
}

function main() {
  console.log('Creating single-folder production build...');
  emptyDir(distDir);
  fs.mkdirSync(distDir, { recursive: true });

  // Copy website root HTML files
  const websiteSrc = path.join(root, 'website');
  copyRecursive(websiteSrc, distDir);

  // Copy assets to root
  copyRecursive(path.join(root, 'assets'), path.join(distDir, 'assets'));

  // Copy built JS/CSS files directly to root
  const websiteBuild = path.join(root, 'build', 'website');
  if (fs.existsSync(websiteBuild)) {
    for (const file of fs.readdirSync(websiteBuild)) {
      if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.map') ||
          file.endsWith('.ttf') || file.endsWith('.woff') || file.endsWith('.svg')) {
        fs.copyFileSync(path.join(websiteBuild, file), path.join(distDir, file));
      }
    }
  }

  // Copy engine build directly to root
  const engineBuildProd = path.join(root, 'build', 'engine_prod');
  const engineBuildDev = path.join(root, 'build', 'engine');
  const engineSrc = fs.existsSync(engineBuildProd) ? engineBuildProd : engineBuildDev;

  if (fs.existsSync(engineSrc)) {
    for (const file of fs.readdirSync(engineSrc)) {
      if (file.endsWith('.js') || file.endsWith('.map')) {
        fs.copyFileSync(path.join(engineSrc, file), path.join(distDir, file));
      }
    }
  }

  // Rewrite HTML files for single-folder paths
  rewriteHtml(path.join(distDir, 'index.html'));
  rewriteHtml(path.join(distDir, 'create.html'));

  console.log('Single-folder dist created at:', distDir);
}

main();
