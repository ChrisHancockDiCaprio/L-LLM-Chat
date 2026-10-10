import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { testCipher } from './test-cipher.mjs';
import { SessionStore, selectContext } from '../src/session-store.mjs';

const message = (role, content, state = 'complete') => ({ id: `${role}-${Math.random()}`, role, content, state, createdAt: new Date().toISOString() });
async function folder(_t) {
  const base = fileURLToPath(new URL('../../.test-output/qwen-chat-tests/', import.meta.url));
  await mkdir(base, { recursive: true });
  return mkdtemp(join(base, 'history-'));
}

test('history survives restart, session switching, and queued saves', async t => {
  const dir = await folder(t); const store = new SessionStore(dir, testCipher); await store.load();
  const first = store.active.id;
  store.active.messages.push(message('user', 'Hallo'), message('assistant', 'Hi'));
  const firstSave = store.save();
  store.active.title = 'Begrüßung';
  await Promise.all([firstSave, store.save()]);
  await store.create(); const second = store.active.id; assert.notEqual(first, second);
  await store.select(first);
  const restored = new SessionStore(dir, testCipher); await restored.load();
  assert.equal(restored.active.id, first); assert.equal(restored.active.title, 'Begrüßung');
  assert.equal(restored.active.messages.length, 2); assert.equal(restored.db.sessions.length, 2);
  await assert.rejects(() => restored.select('missing'));
});

test('pending message becomes unknown after restart and is not sent as context', async t => {
  const dir = await folder(t); const store = new SessionStore(dir, testCipher); await store.load();
  store.active.messages.push(message('user', 'Interrupted', 'pending')); await store.save();
  const restored = new SessionStore(dir, testCipher); await restored.load();
  assert.equal(restored.active.messages[0].state, 'unknown');
  assert.deepEqual(selectContext(restored.active.messages, 'New').messages, [{ role: 'user', content: 'New' }]);
});

test('corrupt encrypted history fails closed and remains unchanged', async t => {
  const dir = await folder(t); const path = join(dir, 'history.vault');
  const corrupt = Buffer.from('invalid ciphertext'); await writeFile(path, corrupt);
  await assert.rejects(() => new SessionStore(dir, testCipher).load(), /Tresor/);
  assert.deepEqual(await readFile(path), corrupt);
  assert.equal((await readdir(dir)).filter(n => n.endsWith('.json')).length, 0);
});

test('context keeps recent complete rounds in order and excludes failed requests', () => {
  const old = [message('user', 'A'.repeat(100)), message('assistant', 'B'.repeat(100))];
  const latest = [message('user', 'Question'), message('assistant', 'Answer')];
  const all = [...old, message('user', 'Failed', 'failed'), ...latest];
  const result = selectContext(all, 'Next', 230);
  assert.equal(result.omittedRounds, 1);
  assert.deepEqual(result.messages.map(m => m.content), ['Question', 'Answer', 'Next']);
  assert.ok(Buffer.byteLength(JSON.stringify(result.messages)) <= 230);
  assert.equal(all.length, 5);
});

test('oversized newest message is rejected, not truncated', () => {
  assert.throws(() => selectContext([], '界'.repeat(2000)), /zu lang/);
});
