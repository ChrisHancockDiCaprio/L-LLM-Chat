import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SettingsStore, normalizeOrigin, discoverModels, inspectServer } from '../src/settings-store.mjs';
import { sendChat } from '../src/ollama-client.mjs';
import { testCipher } from './test-cipher.mjs';

async function store() {
  const base = fileURLToPath(new URL('../../../work/qwen-chat-settings-tests/', import.meta.url));
  await mkdir(base, { recursive: true }); const directory = await mkdtemp(join(base, 'settings-'));
  const settings = new SettingsStore(directory, testCipher); await settings.load();
  assert.equal(settings.active, null); assert.equal(settings.db.profiles.length, 0);
  await settings.commit({ version: 1, activeId: 'ubuntu-qwen', profiles: [
    { id: 'ubuntu-qwen', name: 'Qwen', model: 'qwen3.5:4b', baseUrl: 'http://localhost:11434', allowHttp: true, enabled: true },
    { id: 'ubuntu-hermes', name: 'Hermes', model: 'hermes3:8b', baseUrl: 'http://localhost:11434', allowHttp: true, enabled: false },
  ] }); return settings;
}
async function withFetch(mock, action) {
  const original = globalThis.fetch; globalThis.fetch = mock;
  try { await action(); } finally { globalThis.fetch = original; }
}
test('turning off the selected KI persists no selection and respects explicit activation', async () => {
  const settings = await store(); await settings.toggle('ubuntu-qwen', false);
  assert.equal(settings.active, null); await assert.rejects(() => settings.select('ubuntu-qwen'), /aktivieren/);
  const reloaded = new SettingsStore(settings.directory, testCipher); await reloaded.load();
  assert.equal(reloaded.active, null);
  await reloaded.toggle('ubuntu-hermes', true); assert.equal(reloaded.active, null);
  await reloaded.select('ubuntu-hermes'); assert.equal(reloaded.active.model, 'hermes3:8b');
});
test('profile changes and model options survive encrypted restart', async () => {
  const settings = await store();
  await settings.upsert({ name: 'Laptop', baseUrl: 'https://example.test/', model: 'local:model', enabled: true, options: { temperature: 0.3, num_ctx: 4096, num_predict: 512 } });
  const profile = settings.db.profiles.find(p => p.name === 'Laptop'); await settings.select(profile.id);
  const reloaded = new SettingsStore(settings.directory, testCipher); await reloaded.load();
  assert.equal(reloaded.active.baseUrl, 'https://example.test'); assert.equal(reloaded.active.options.temperature, 0.3);
  const bytes = await readFile(settings.file); assert.equal(bytes.includes(Buffer.from('Laptop')), false);
  assert.equal((await readdir(settings.directory)).some(n => n.endsWith('.json')), false);
});
test('invalid endpoints, settings and unsupported concept providers leave settings unchanged', async () => {
  const settings = await store(); const before = JSON.stringify(settings.db);
  for (const url of ['file:///x', 'http://name:secret@host:11434', 'http://host/api/chat', 'http://host?secret=1', 'http://host#fragment']) {
    assert.throws(() => normalizeOrigin(url)); await assert.rejects(() => settings.upsert({ name: 'Bad', baseUrl: url, model: 'm', enabled: true }));
  }
  await assert.rejects(() => settings.upsert({ type: 'litellm', name: 'Gateway', baseUrl: 'https://example.test', model: 'alias', enabled: true }), /nicht verfügbar/);
  await assert.rejects(() => settings.upsert({ ...settings.active, options: { num_ctx: 1000000, num_predict: 2048, temperature: 0.7 } }));
  await assert.rejects(() => settings.toggle('ubuntu-qwen', 'false'));
  assert.equal(JSON.stringify(settings.db), before);
});
test('corrupt vault is retained and never reset to defaults or plaintext', async () => {
  const settings = await store(); const corrupted = Buffer.from('invalid ciphertext');
  await writeFile(settings.file, corrupted);
  await assert.rejects(() => new SettingsStore(settings.directory, testCipher).load(), /Tresor/);
  assert.deepEqual(await readFile(settings.file), corrupted);
  assert.equal((await readdir(settings.directory)).filter(n => n.endsWith('.json')).length, 0);
});
test('selected profile controls actual URL, model and generation options', async () => {
  const settings = await store(); await settings.toggle('ubuntu-hermes', true); await settings.select('ubuntu-hermes');
  const profile = { ...settings.active, baseUrl: 'http://localhost:12345' };
  await withFetch(async (url, init) => {
    assert.equal(url, 'http://localhost:12345/api/chat'); const body = JSON.parse(init.body);
    assert.equal(body.model, 'hermes3:8b'); assert.deepEqual(body.options, profile.options);
    return new Response(JSON.stringify({ done: true, message: { content: 'Hermes reply' } }));
  }, async () => assert.equal(await sendChat([{ role: 'user', content: 'Hello' }], { profile }), 'Hermes reply'));
});
test('disabled and unsupported providers cannot make network requests', async () => {
  const settings = await store(); let calls = 0;
  await withFetch(async () => { calls++; throw new Error('Unexpected request'); }, async () => {
    await assert.rejects(() => sendChat([{ role: 'user', content: 'Hello' }], { profile: { ...settings.active, enabled: false } }), /nicht aktiviert/);
    await assert.rejects(() => sendChat([{ role: 'user', content: 'Hello' }], { profile: { ...settings.active, type: 'litellm' } }), /nicht aktiviert/);
    assert.equal(calls, 0);
  });
});
test('discovery deduplicates models, checks metadata and reports errors without server bodies', async () => {
  const profile = { baseUrl: 'http://localhost:11434', allowHttp: true };
  await withFetch(async (url, init) => {
    assert.equal(init.redirect, 'error');
    if (url.endsWith('/api/show')) return new Response(JSON.stringify({ capabilities: ['completion', 'thinking'], model_info: { 'qwen.context_length': 262144 } }));
    return new Response(JSON.stringify({ models: [{ name: 'qwen3.5:4b' }, { model: 'hermes3:8b' }, { name: 'qwen3.5:4b' }] }));
  }, async () => {
    assert.deepEqual(await discoverModels(profile.baseUrl, { profile }), ['hermes3:8b', 'qwen3.5:4b']);
    const models = await inspectServer(profile); assert.equal(models.length, 2); assert.equal(models[0].contextLimit, 262144);
    assert.deepEqual(models[0].capabilities, ['completion', 'thinking']);
  });
  await withFetch(async () => new Response('SECRET ERROR BODY', { status: 401 }), async () => assert.rejects(() => discoverModels(profile.baseUrl, { profile }), /401/));
  await withFetch(async () => new Response('{}'), async () => assert.rejects(() => discoverModels(profile.baseUrl, { profile }), /Modellliste/));
});
test('server imports all models disabled and preserves existing activation and selection', async () => {
  const settings = await store();
  await settings.importServer({ name: 'Local', baseUrl: 'http://localhost:11434', allowHttp: true, authRef: null, authType: 'none',
    models: [{ name: 'qwen3.5:4b', capabilities: ['completion'], contextLimit: 262144 }, { name: 'new:model', capabilities: ['completion'], contextLimit: 4096 }] });
  assert.equal(settings.active.id, 'ubuntu-qwen'); assert.equal(settings.db.profiles.find(p => p.model === 'new:model').enabled, false);
  assert.equal(settings.active.contextLimit, 262144);
  await assert.rejects(() => settings.upsert({ ...settings.active, options: { temperature: 0.7, num_ctx: 1000000, num_predict: 2048 } }));
});
test('address changes drop old credential reference and renderer cannot inject references', async () => {
  const settings = await store(); const next = settings.snapshot();
  next.profiles[0].authRef = 'protected-ref'; next.profiles[0].authType = 'bearer'; await settings.commit(next);
  await settings.upsert({ ...settings.active, authRef: 'injected', baseUrl: 'https://new.example' });
  assert.equal(settings.active.authRef, null); assert.equal(settings.active.authType, 'none');
  await settings.upsert({ ...settings.active, authRef: 'injected', authType: 'bearer' }); assert.equal(settings.active.authRef, null);
});
