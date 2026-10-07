import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { backupVault } from './update-backup.mjs';

// Explicit isolated test root only. No network requests or real user data.
export async function releaseSelfTest({ store, settings, credentials, attachments, root, cipher, dataDir, version, seed, seedAttachments }) {
  if (seed) {
    store.active.title = 'Installationstest';
    store.active.messages = [{ id: 'fixture-message', role: 'user', content: 'RELEASE-TEST-CHAT', state: 'complete', createdAt: new Date().toISOString() }];
    await store.save();
    const authRef = await credentials.add('https://example.com', { type: 'bearer', token: 'RELEASE-TEST-KEY' });
    await settings.importServer({ name: 'Testmodell', baseUrl: 'https://example.com', allowHttp: false, authRef, authType: 'bearer', models: [{ name: 'qwen3.5:4b', capabilities: ['completion'] }] });
    const profile = settings.db.profiles.find(p => p.baseUrl === 'https://example.com');
    await settings.upsert({ ...profile, enabled: true, options: { num_ctx: 4096, num_predict: 512, temperature: 0.4 } });
    await settings.select(profile.id);
    await backupVault(dataDir, cipher, version);
  }
  if (seedAttachments) {
    const picture = await attachments.importFile(join(root, 'assets/icon.png')); await attachments.persist([picture.id]);
    store.active.messages.push({ id: 'fixture-image', role: 'assistant', content: 'RELEASE-TEST-IMAGE', state: 'complete', createdAt: new Date().toISOString(), attachmentIds: [picture.id] }); await store.save();
  }
  assert.equal(store.active.messages[0].content, 'RELEASE-TEST-CHAT');
  assert.equal(settings.active.model, 'qwen3.5:4b');
  assert.equal(settings.active.options.temperature, 0.4);
  assert.equal(credentials.get(settings.active).token, 'RELEASE-TEST-KEY');
  for (const name of ['history', 'settings', 'credentials']) {
    const bytes = await readFile(join(dataDir, `${name}.vault`));
    assert.equal(bytes.includes(Buffer.from('RELEASE-TEST-')), false);
  }
  const imageIds = store.active.messages.flatMap(m => m.attachmentIds ?? []);
  for (const id of imageIds) assert.ok(attachments.get(id).base64);
  return { ok: true, version, sessions: store.db.sessions.length, messages: store.active.messages.length, selectedModelPreserved: true, credentialsPreserved: true, attachmentsPreserved: imageIds.length, encrypted: true };
}
