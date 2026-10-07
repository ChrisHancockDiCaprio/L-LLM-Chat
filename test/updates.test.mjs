import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { dataPaths } from '../src/data-paths.mjs';
import { UpdateManager } from '../src/update-manager.mjs';
import { backupVault } from '../src/update-backup.mjs';
import { testCipher } from './test-cipher.mjs';
const source = { provider: 'github', owner: 'ChrisHancockDiCaprio', repo: 'L-LLM-Chat' };
function updater() { const result = new EventEmitter(); result.installs = 0; result.setFeedURL = config => { result.feed = config; }; result.checkForUpdates = async () => result.emit('update-not-available'); result.downloadUpdate = async () => result.emit('update-downloaded'); result.quitAndInstall = () => result.installs++; return result; }
test('moving or upgrading the app keeps the external Windows vault path', () => {
  const a = dataPaths({ root: 'C:/old-app', appData: 'C:/Users/Test/AppData/Roaming' });
  const b = dataPaths({ root: 'D:/new-app', appData: 'C:/Users/Test/AppData/Roaming' });
  assert.deepEqual(a.dataDir, b.dataDir); assert.deepEqual(a.appDataDir, b.appDataDir);
});
test('pilot checks GitHub without automatic download, exit installation or unsigned install', async () => {
  const u = updater(); const manager = new UpdateManager({ updater: u, packaged: true, source, version: '0.2.0' });
  assert.equal(u.autoDownload, false); assert.equal(u.autoInstallOnAppQuit, false); assert.equal(u.feed.private, false);
  assert.equal((await manager.check()).ok, true); assert.equal(manager.snapshot().state, 'current');
  u.emit('update-available', { version: '0.3.0' }); await manager.download();
  assert.equal((await manager.install()).ok, false); assert.equal(u.installs, 0);
});
test('busy state and failed encrypted backup block a future signed update restart', async () => {
  const u = updater(); let busy = true; let fail = true;
  const manager = new UpdateManager({ updater: u, packaged: true, source, version: '0.2.0', installAllowed: true, isBusy: () => busy, beforeInstall: async () => { if (fail) throw new Error('disk full'); } });
  u.emit('update-downloaded'); assert.equal((await manager.install()).ok, false);
  busy = false; assert.equal((await manager.install()).ok, false); assert.equal(u.installs, 0);
  fail = false; assert.equal((await manager.install()).ok, true); assert.equal(u.installs, 1);
});
test('update errors do not expose server bodies, tokens or updater error details', () => {
  const u = updater(); const manager = new UpdateManager({ updater: u, packaged: true, source, version: '0.2.0' });
  u.emit('error', new Error('PRIVATE-TOKEN')); assert.equal(JSON.stringify(manager.snapshot()).includes('PRIVATE-TOKEN'), false);
});
test('backup copies exact ciphertext, encrypts inventory and refuses unreadable vault', async () => {
  const base = fileURLToPath(new URL('../../../work/qwen-chat-update-tests/', import.meta.url));
  await mkdir(base, { recursive: true }); const dir = await mkdtemp(join(base, 'vault-'));
  for (const name of ['history', 'settings', 'credentials']) await writeFile(join(dir, `${name}.vault`), await testCipher.encrypt('PRIVATE-' + name));
  const backup = await backupVault(dir, testCipher, '0.2.0');
  for (const name of ['history', 'settings', 'credentials']) assert.deepEqual(await readFile(join(backup, `${name}.vault`)), await readFile(join(dir, `${name}.vault`)));
  const inventory = JSON.parse(await testCipher.decrypt(await readFile(join(backup, 'inventory.vault')))); assert.equal(inventory.entries.length, 3);
  await writeFile(join(dir, 'history.vault'), 'corrupt'); await assert.rejects(() => backupVault(dir, testCipher, '0.2.0'));
  assert.equal((await readdir(join(dir, 'BeforeUpdate'))).filter(n => !n.endsWith('.pending')).length, 1);
});
