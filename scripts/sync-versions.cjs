#!/usr/bin/env node
/**
 * Sincroniza a versão do package.json raiz com todos os pacotes em packages/*.
 * Usado pelo @semantic-release/exec.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = rootPkg.version;

const packagesDir = path.join(rootDir, 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter((name) => {
  const stat = fs.statSync(path.join(packagesDir, name));
  return stat.isDirectory();
});

for (const dir of packageDirs) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Synced ${pkg.name} → ${version}`);

  // Patch hardcoded VERSION constant in src/index.ts when present, so the
  // runtime value follows the published version.
  const indexPath = path.join(packagesDir, dir, 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    const src = fs.readFileSync(indexPath, 'utf-8');
    const updated = src.replace(
      /export const VERSION = '[^']*';/,
      `export const VERSION = '${version}';`,
    );
    if (updated !== src) {
      fs.writeFileSync(indexPath, updated);
      console.log(`Synced VERSION constant in ${pkg.name}/src/index.ts → ${version}`);
    }
  }
}
