import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SecureFile, protectLegacyBackups } from '../src/secure-file.mjs';
import { CredentialStore } from '../src/credential-store.mjs';
import { secureHeaders, normalizeAuth } from '../src/connection-security.mjs';
import { discoverModels } from '../src/settings-store.mjs';
import { sendChat } from '../src/ollama-client.mjs';
import { testCipher, makeTestCipher } from './test-cipher.mjs';

async function folder() {
  const base = fileURLToPath(new URL('../../../work/qwen-chat-security-tests/', import.meta.url));
  await mkdir(base, { recursive: true }); return mkdtemp(join(base, 'vault-'));
}
test('vault stores no plaintext and wrong key or tampering fails closed', async () => {
  const dir = await folder(); const vault = new SecureFile(dir, 'settings', testCipher);
  const secret = 'SECURITY-CANARY-private-token-and-server'; await vault.write(secret);
  const bytes = await readFile(vault.file); assert.equal(bytes.includes(Buffer.from(secret)), false);
  assert.equal(await vault.read(), secret);
  await assert.rejects(() => new SecureFile(dir, 'settings', makeTestCipher()).read(), /Tresor/);
  bytes[bytes.length - 1] ^= 1; await writeFile(vault.file, bytes);
  await assert.rejects(() => vault.read(), /Tresor/); assert.deepEqual(await readFile(vault.file), bytes);
  assert.throws(() => new SecureFile(dir, 'unsafe'), /erforderlich/);
});
test('migration removes legacy plaintext only after verified encrypted disk write', async () => {
  const dir = await folder(); const legacy = join(dir, 'history.json'); await writeFile(legacy, 'PRIVATE HISTORY');
  const failing = { encrypt: async () => { throw new Error('No encryption'); }, decrypt: async () => '' };
  await assert.rejects(() => new SecureFile(dir, 'history', failing, legacy).read());
  assert.equal(await readFile(legacy, 'utf8'), 'PRIVATE HISTORY');
  const vault = new SecureFile(dir, 'history', testCipher, legacy);
  assert.equal(await vault.read(), 'PRIVATE HISTORY'); await assert.rejects(() => access(legacy), { code: 'ENOENT' });
  assert.equal((await readFile(vault.file)).includes(Buffer.from('PRIVATE HISTORY')), false);
});
test('migration preserves newer vault data and encrypts leftover plaintext backups', async () => {
  const dir = await folder(); const legacy = join(dir, 'settings.json');
  const vault = new SecureFile(dir, 'settings', testCipher, legacy); await vault.write('NEW DATA');
  await writeFile(legacy, 'OLD DATA'); assert.equal(await vault.read(), 'NEW DATA');
  await writeFile(join(dir, 'history-unlesbar-old.json'), 'OLD HISTORY BACKUP');
  await protectLegacyBackups(dir, dir, testCipher);
  const names = await readdir(dir); assert.equal(names.some(n => n.endsWith('.json') || n.endsWith('.tmp')), false);
  const restored = await Promise.all(names.map(async name => testCipher.decrypt(await readFile(join(dir, name)))));
  assert.ok(restored.includes('OLD DATA')); assert.ok(restored.includes('OLD HISTORY BACKUP'));
});
test('queued vault saves keep invocation order even with slow encryption', async () => {
  const dir = await folder(); const cipher = {
    encrypt: async text => { if (text === 'FIRST') await new Promise(resolve => setTimeout(resolve, 40)); return testCipher.encrypt(text); },
    decrypt: testCipher.decrypt,
  };
  const vault = new SecureFile(dir, 'history', cipher); await Promise.all([vault.write('FIRST'), vault.write('SECOND')]);
  assert.equal(await vault.read(), 'SECOND'); assert.equal((await readdir(dir)).some(n => n.endsWith('.tmp')), false);
});
test('explicit latest-legacy import preserves the previous encrypted version as archive', async () => {
  const dir = await folder(); const legacy = join(dir, 'history.json');
  const vault = new SecureFile(dir, 'history', testCipher, legacy, { preferLegacy: true });
  await vault.write('PREVIOUS VERIFIED HISTORY'); await writeFile(legacy, 'LATEST HISTORY');
  assert.equal(await vault.read(), 'LATEST HISTORY'); await assert.rejects(() => access(legacy));
  const archived = (await readdir(dir)).find(n => n.startsWith('migration-'));
  assert.equal(await testCipher.decrypt(await readFile(join(dir, archived))), 'PREVIOUS VERIFIED HISTORY');
});
test('HTTP requires private address plus explicit opt-in, and never carries credentials', () => {
  for (const baseUrl of ['http://127.0.0.1:11434', 'http://192.168.1.10:11434', 'http://10.0.0.1']) {
    assert.throws(() => secureHeaders({ baseUrl }), /HTTPS/);
    assert.equal(secureHeaders({ baseUrl, allowHttp: true }).Authorization, undefined);
    assert.throws(() => secureHeaders({ baseUrl, allowHttp: true }, { type: 'bearer', token: 'CANARY' }), /HTTPS/);
    assert.throws(() => secureHeaders({ baseUrl, allowHttp: true }, { type: 'basic', username: 'u', password: 'p' }), /HTTPS/);
  }
  for (const baseUrl of ['http://example.com', 'http://8.8.8.8', 'http://100.64.0.1']) assert.throws(() => secureHeaders({ baseUrl, allowHttp: true }), /HTTPS/);
});
test('HTTPS supports bearer and basic authentication without credentials in URL', () => {
  const profile = { baseUrl: 'https://friend.example' };
  assert.equal(secureHeaders(profile, { type: 'bearer', token: 'CANARY' }).Authorization, 'Bearer CANARY');
  assert.equal(secureHeaders(profile, { type: 'basic', username: 'user', password: 'pass' }).Authorization, 'Basic ' + Buffer.from('user:pass').toString('base64'));
  assert.throws(() => normalizeAuth({ type: 'bearer', token: 'token\r\nInjected: header' }));
  assert.throws(() => normalizeAuth({ type: 'basic', username: 'user:other', password: 'x' }));
  assert.throws(() => secureHeaders({ baseUrl: 'https://user:secret@friend.example' }));
});
test('an inherited TLS validation bypass is rejected instead of weakening HTTPS', () => {
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try { assert.throws(() => secureHeaders({ baseUrl: 'https://friend.example' }, { type: 'bearer', token: 'CANARY' }), /deaktiviert/); }
  finally { if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous; }
});
test('credential vault is separate, encrypted, reloadable and bound to exact origin', async () => {
  const dir = await folder(); const credentials = new CredentialStore(dir, testCipher); await credentials.load();
  const ref = await credentials.add('https://friend.example', { type: 'bearer', token: 'PRIVATE-CANARY-KEY' });
  const reloaded = new CredentialStore(dir, testCipher); await reloaded.load();
  assert.equal(reloaded.get({ baseUrl: 'https://friend.example', authRef: ref }).token, 'PRIVATE-CANARY-KEY');
  assert.throws(() => reloaded.get({ baseUrl: 'https://other.example', authRef: ref }), /gehört nicht/);
  assert.equal((await readFile(join(dir, 'credentials.vault'))).includes(Buffer.from('PRIVATE-CANARY-KEY')), false);
  await reloaded.remove(ref); assert.throws(() => reloaded.get({ baseUrl: 'https://friend.example', authRef: ref }));
});
test('all network entry points block HTTP secrets before fetch and use redirect:error for TLS', async () => {
  const original = globalThis.fetch; let calls = 0;
  const auth = { type: 'bearer', token: 'CANARY' };
  const profile = { baseUrl: 'http://localhost:11434', allowHttp: true, enabled: true, type: 'ollama', model: 'test:model' };
  globalThis.fetch = async (_url, init) => {
    calls++; assert.equal(init.headers.Authorization, 'Bearer CANARY'); assert.equal(init.redirect, 'error');
    return new Response(JSON.stringify({ models: [{ name: 'test:model' }], done: true, message: { content: 'OK' } }));
  };
  try {
    await assert.rejects(() => discoverModels(profile.baseUrl, { profile, auth }), /HTTPS/);
    await assert.rejects(() => sendChat([{ role: 'user', content: 'Hello' }], { profile, auth }), /HTTPS/);
    assert.equal(calls, 0); const tls = { ...profile, baseUrl: 'https://friend.example' };
    await discoverModels(tls.baseUrl, { profile: tls, auth }); await sendChat([{ role: 'user', content: 'Hello' }], { profile: tls, auth });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
