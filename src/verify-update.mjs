import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SettingsStore } from './settings-store.mjs';
import { CredentialStore } from './credential-store.mjs';
import { SessionStore } from './session-store.mjs';

export async function verifyUpdate({ root, dataDir, window, store, settings, credentials, workflows, cipher, publish, snapshot }) {
  const run = code => window.webContents.executeJavaScript(code);
  const json = data => new Response(JSON.stringify(data));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(init.redirect, 'error');
    if (url.includes('gateway.example')) {
      assert.equal(init.headers.Authorization, 'Bearer FAKE-UI-TEST-KEY');
      return json({ data: [{ id: 'old-alias' }, { id: 'new-alias' }] });
    }
    if (url.endsWith('/system_stats')) return json({ system: { os: 'linux' } });
    if (url.endsWith('/object_info')) return json({ UnetLoaderGGUF: { input: { required: { unet_name: [['Qwen-Image-2.1.gguf']] } } } });
    throw new Error('Unexpected fixture request');
  };
  const report = { version: snapshot().updates.version };
  try {
    await settings.commit({ version: 1, profiles: [], activeId: null });
    const ref = await credentials.add('https://gateway.example', { type: 'bearer', token: 'FAKE-UI-TEST-KEY' });
    await settings.importServer({ type: 'openai-chat', name: 'Gateway', baseUrl: 'https://gateway.example', authRef: ref, authType: 'bearer', models: [{ name: 'old-alias', type: 'openai-chat' }] });
    const profile = settings.db.profiles[0]; await settings.toggle(profile.id, true); await settings.select(profile.id);
    await store.create(); store.active.messages.push({ id: randomUUID(), role: 'user', content: 'UPDATE-UI-HISTORY', state: 'complete', createdAt: new Date().toISOString() }); await store.save();
    publish(); await run(`document.querySelector('#settings-button').click()`);
    const inside = await run(`(() => { const b = document.querySelector('#settings-dialog').getBoundingClientRect(); return {x: Math.round(b.left + 15), y: Math.round(b.top + 15)}; })()`);
    for (const type of ['mouseDown', 'mouseUp']) window.webContents.sendInputEvent({ type, ...inside, button: 'left', clickCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 100));
    report.insideClickKeepsSettings = await run(`document.querySelector('#settings-dialog').open`); assert.ok(report.insideClickKeepsSettings);
    for (const type of ['mouseDown', 'mouseUp']) window.webContents.sendInputEvent({ type, x: 3, y: 3, button: 'left', clickCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 100));
    report.backdropClosesSettings = await run(`!document.querySelector('#settings-dialog').open`); assert.ok(report.backdropClosesSettings);
    await run(`document.querySelector('#settings-button').click();`);
    const refreshed = await run(`window.qwenChat.refreshServer(${JSON.stringify(profile.id)})`); assert.ok(refreshed.ok);
    report.newModelsListedDisabled = settings.db.profiles.some(p => p.model === 'new-alias' && !p.enabled) && settings.active.id === profile.id; assert.ok(report.newModelsListedDisabled);
    await run(`document.querySelector('.profile-remove[data-profile=${JSON.stringify(profile.id)}]').click(); document.querySelector('#delete-confirm-cancel').click()`);
    assert.equal(settings.db.profiles.length, 2); report.deleteCanBeCancelled = true;
    await run(`document.querySelector('.profile-remove[data-profile=${JSON.stringify(profile.id)}]').click(); document.querySelector('#delete-confirm-yes').click()`);
    await until(() => !snapshot().settingsBusy && settings.db.profiles.length === 1);
    report.removingActiveKeepsHistory = !settings.active && store.active.messages[0].content === 'UPDATE-UI-HISTORY'; assert.ok(report.removingActiveKeepsHistory);
    assert.equal(Object.keys(credentials.db.entries).length, 1);
    await run(`window.qwenChat.refreshServer(${JSON.stringify(settings.db.profiles[0].id)})`); assert.equal(settings.db.profiles.length, 1);
    report.removedModelNotRecreated = true;
    const remaining = settings.db.profiles[0];
    await run(`document.querySelector('.server-remove[data-profile=${JSON.stringify(remaining.id)}]').click(); document.querySelector('#delete-confirm-yes').click()`);
    await until(() => !snapshot().settingsBusy && !settings.db.profiles.length);
    assert.equal(Object.keys(credentials.db.entries).length, 0); report.serverAndUnusedSecretRemoved = true;
    const added = await run(`window.qwenChat.addServer({type: 'comfyui', name: 'ComfyUI', baseUrl: 'https://comfy.example', auth: {type: 'none'}})`); assert.ok(added.ok);
    const comfy = settings.db.profiles[0]; assert.equal(comfy.type, 'comfyui'); assert.equal(comfy.enabled, false);
    report.comfyConnectionPrepared = comfy.serverInfo.ggufAvailable;
    await workflows.import(comfy.baseUrl, 'api-workflow.json', { '1': { class_type: 'CLIPTextEncode', inputs: { text: 'WORKFLOW-UI-PRIVATE' } } }); publish();
    report.workflowSummaryVisible = await run(`document.querySelector('#profile-list').textContent.includes('api-workflow.json') && !document.querySelector('#profile-list').textContent.includes('WORKFLOW-UI-PRIVATE')`); assert.ok(report.workflowSummaryVisible);
    window.showInactive(); await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    await new Promise(resolve => setTimeout(resolve, 200));
    await writeFile(join(root, 'preview-update-settings.png'), (await window.webContents.capturePage()).toPNG());
    window.hide();
    const restoredSettings = new SettingsStore(dataDir, cipher); const restoredCredentials = new CredentialStore(dataDir, cipher); const restoredHistory = new SessionStore(dataDir, cipher);
    await restoredSettings.load(); await restoredCredentials.load(); await restoredHistory.load();
    report.encryptedRestartPreservesChangesAndChats = restoredSettings.db.profiles[0].type === 'comfyui' && !Object.keys(restoredCredentials.db.entries).length && restoredHistory.active.messages[0].content === 'UPDATE-UI-HISTORY'; assert.ok(report.encryptedRestartPreservesChangesAndChats);
    await writeFile(join(root, 'verification-update.json'), JSON.stringify(report, null, 2)); return report;
  } finally { globalThis.fetch = previousFetch; }
}
async function until(predicate) { for (let n = 0; n < 150; n++) { if (predicate()) { await new Promise(resolve => setTimeout(resolve, 80)); return; } await new Promise(resolve => setTimeout(resolve, 80)); } throw new Error('Update UI verification timed out'); }
