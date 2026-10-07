import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { dataPaths } from '../src/data-paths.mjs';
import { UpdateManager } from '../src/update-manager.mjs';
import { githubSource, probeUpdateRepository } from '../src/update-source.mjs';
import { SettingsStore } from '../src/settings-store.mjs';
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
async function withFetch(mock, action) { const previous = globalThis.fetch; globalThis.fetch = mock; try { await action(); } finally { globalThis.fetch = previous; } }
const repoResponse = () => new Response(JSON.stringify({ private: false, full_name: 'ChrisHancockDiCaprio/Other-Chat' }));
test('update source accepts repository URLs and refuses credentials, foreign hosts and release-page URLs', () => {
  assert.deepEqual(githubSource(' https://github.com/ChrisHancockDiCaprio/Other-Chat.git/ '), { ...source, repo: 'Other-Chat' });
  for (const url of ['http://github.com/u/r', 'https://github.com.evil/u/r', 'https://user:secret@github.com/u/r', 'https://github.com/u/r?token=x', 'https://github.com/u/r/releases', 'https://github.com/u/..', 'https://github.com/u/r#secret']) assert.throws(() => githubSource(url));
});
test('repository probe distinguishes missing public releases from available Windows assets', async () => {
  for (const release of [null, { draft: false, prerelease: false, assets: [] }, { draft: false, prerelease: false, assets: [{ name: 'latest.yml' }, { name: 'Setup.exe' }] }]) await withFetch(async (url, init) => {
    assert.equal(init.redirect, 'error'); assert.equal(init.headers.Authorization, undefined);
    return url.endsWith('/releases/latest') ? release ? new Response(JSON.stringify(release)) : new Response('', { status: 404 }) : repoResponse();
  }, async () => { const result = await probeUpdateRepository('https://github.com/ChrisHancockDiCaprio/Other-Chat'); assert.equal(result.ready, Boolean(release?.assets.length)); if (!release) assert.match(result.notice, /Entwürfe/); });
});
test('source changes clear an old available update, persist encrypted and configure the next check after restart', async () => {
  const base = fileURLToPath(new URL('../../../work/qwen-chat-update-tests/', import.meta.url)); await mkdir(base, { recursive: true }); const dir = await mkdtemp(join(base, 'source-'));
  const settings = new SettingsStore(dir, testCipher); await settings.load();
  const u = updater(); const manager = new UpdateManager({ updater: u, packaged: true, source, version: '0.2.2' }); u.emit('update-available', { version: '0.3.0' });
  await withFetch(async url => url.endsWith('/releases/latest') ? new Response('', { status: 404 }) : repoResponse(), async () => {
    assert.equal((await manager.saveRepository('https://github.com/ChrisHancockDiCaprio/Other-Chat', url => settings.setUpdateRepository(url))).ok, true);
  });
  assert.equal(manager.snapshot().state, 'idle'); assert.equal(manager.snapshot().targetVersion, null); assert.equal((await manager.download()).ok, false); assert.equal(u.feed.repo, 'Other-Chat');
  assert.equal((await readFile(settings.file)).includes(Buffer.from('Other-Chat')), false);
  const restored = new SettingsStore(dir, testCipher); await restored.load(); const next = updater(); new UpdateManager({ updater: next, packaged: true, source: githubSource(restored.db.updateRepository), version: '0.2.2' }); assert.equal(next.feed.repo, 'Other-Chat');
  await settings.importServer({ name: 'Local', baseUrl: 'https://llm.example', models: [{ name: 'm' }] }); assert.equal(settings.db.updateRepository, restored.db.updateRepository);
});
test('bad repository and failed encrypted save retain original feed; downloads and concurrent checks lock switching', async () => {
  const u = updater(); const manager = new UpdateManager({ updater: u, packaged: true, source, version: '0.2.2' });
  await withFetch(async () => new Response('PRIVATE-RESPONSE', { status: 404 }), async () => { const result = await manager.saveRepository('https://github.com/u/r', () => assert.fail('must not persist')); assert.equal(result.ok, false); assert.ok(!result.error.includes('PRIVATE-RESPONSE')); });
  await withFetch(async url => url.endsWith('/releases/latest') ? new Response('', { status: 404 }) : repoResponse(), async () => { assert.equal((await manager.saveRepository('https://github.com/ChrisHancockDiCaprio/Other-Chat', async () => { throw Error('PRIVATE-DISK'); })).ok, false); });
  assert.equal(u.feed.repo, source.repo); assert.equal(manager.snapshot().repository, `https://github.com/${source.owner}/${source.repo}`);
  let finish; u.checkForUpdates = () => new Promise(resolve => { finish = resolve; }); const checking = manager.check();
  assert.equal((await manager.saveRepository('https://github.com/u/r', () => assert.fail())).ok, false); finish(); await checking;
  u.emit('update-downloaded'); assert.equal((await manager.saveRepository('https://github.com/u/r', () => assert.fail())).ok, false);
});
