import { listPackage } from '@electron/asar';
import assert from 'node:assert/strict';
const archive = process.argv[2] ?? 'dist-release/win-unpacked/resources/app.asar';
const files = listPackage(archive).map(x => x.replaceAll('\\','/'));
assert.ok(files.includes('/src/main.mjs')); assert.ok(files.includes('/assets/icon.png'));
assert.ok(files.includes('/release/update-source.json'));
assert.ok(!files.some(x => /\.(vault|log|tmp)$/.test(x) || /^\/(data|work|test|\.git|\.env)(\/|$)/.test(x)));
assert.ok(!files.some(x => /\/node_modules\/electron\/|\/node_modules\/electron-builder\//.test(x)));
console.log(JSON.stringify({ packageChecked: true, encryptedUserDataIncluded: false, developmentRuntimeIncluded: false }));
