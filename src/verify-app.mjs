import { writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { SessionStore } from './session-store.mjs';
import { SettingsStore } from './settings-store.mjs';

export async function verifyApplication({ root, dataDir, window, store, settings, cipher, credentials, attachments, drafts, publish, snapshot }) {
  const run = code => window.webContents.executeJavaScript(code);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(predicate, label, timeout = 15000) {
    const started = Date.now();
    while (!await predicate()) { if (Date.now() - started > timeout) throw new Error(`Verification timeout: ${label}`); await pause(80); }
    await pause(120);
  }
  const image = async name => {
    await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    await pause(200); await writeFile(join(root, name), (await window.webContents.capturePage()).toPNG());
  };
  const report = { connected: snapshot().connection.state === 'online', userData: dataDir };
  if (!report.connected) throw new Error(snapshot().connection.message);
  await store.create(); publish(); await pause(150);
  await run(`document.querySelector('#settings-button').click();`);
  report.settingsDialog = await run(`document.querySelector('#settings-dialog').open`);

  await run(`document.getElementById('toggle-ubuntu-qwen').click();`);
  await until(() => settings.db.activeId === null && !snapshot().settingsBusy, 'disable active model');
  const count = store.active.messages.length;
  const blocked = await run(`window.qwenChat.send('Diese Nachricht darf nicht gesendet werden.')`);
  report.disabledBlocksSending = blocked.ok === false && store.active.messages.length === count;

  await run(`document.getElementById('toggle-ubuntu-qwen').click();`);
  await until(() => settings.db.profiles.find(p => p.id === 'ubuntu-qwen').enabled && !snapshot().settingsBusy, 'enable model');
  await run(`document.querySelector('.profile-use[data-profile="ubuntu-qwen"]').click();`);
  await until(() => settings.db.activeId === 'ubuntu-qwen' && snapshot().connection.state === 'online' && !snapshot().settingsBusy, 'select model');

  await run(`document.querySelector('.profile-edit[data-profile="ubuntu-qwen"]').click(); document.querySelector('#probe-server').click();`);
  await until(async () => await run(`document.querySelectorAll('#model-options option').length > 0`), 'load real Ollama models');
  report.discoveredModels = await run(`Array.from(document.querySelectorAll('#model-options option'), option => option.value)`);
  await run(`document.querySelector('#profile-name').value = 'Qwen auf Ubuntu'; document.querySelector('#profile-form').requestSubmit();`);
  await until(async () => !snapshot().settingsBusy && await run(`document.querySelector('#profile-form').hidden`), 'save profile');
  const restoredSettings = new SettingsStore(dataDir, cipher); await restoredSettings.load();
  report.settingsRestored = restoredSettings.active?.id === 'ubuntu-qwen' && restoredSettings.active?.model === 'qwen3.5:4b';

  await run(`document.querySelector('#profile-form').hidden = true; document.querySelector('#add-server').click();`);
  const serverUrl = settings.active.baseUrl;
  await run(`document.querySelector('#server-name').value = 'Testserver'; document.querySelector('#server-url').value = ${JSON.stringify(serverUrl)}; document.querySelector('#server-http').checked = true; document.querySelector('#server-form').requestSubmit();`);
  await until(async () => !snapshot().settingsBusy && await run(`document.querySelector('#server-form').hidden`), 'server discovery and import', 60000);
  report.serverImport = settings.db.profiles.every(p => p.contextLimit > 0 && p.capabilities.length > 0) && settings.active.id === 'ubuntu-qwen';
  await run(`document.querySelector('#tab-security').click();`);
  report.securityPanel = await run(`!document.querySelector('#security-panel').hidden && document.querySelector('#vault-location').textContent.length > 0`);
  await image('preview-security.png');
  const canary = 'VERIFY-FAKE-API-KEY-NEVER-A-REAL-SECRET';
  const originalFetch = globalThis.fetch;
  let authenticatedCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (!url.startsWith('https://friend.example/')) throw new Error('Unexpected test endpoint');
    if (init.headers.Authorization !== 'Bearer ' + canary || init.redirect !== 'error') throw new Error('Unsafe authentication');
    authenticatedCalls++;
    return new Response(JSON.stringify(url.endsWith('/api/tags') ? { models: [{ name: 'test:model' }] } : { capabilities: ['completion'], model_info: { 'test.context_length': 8192 } }));
  };
  try {
    await run(`document.querySelector('#tab-local').click(); document.querySelector('#add-server').click(); document.querySelector('#server-name').value = 'Test · Freund'; document.querySelector('#server-url').value = 'https://friend.example'; document.querySelector('#server-auth').value = 'bearer'; document.querySelector('#server-auth').dispatchEvent(new Event('change')); document.querySelector('#server-secret').value = ${JSON.stringify(canary)}; document.querySelector('#server-form').requestSubmit();`);
    await until(async () => !snapshot().settingsBusy && await run(`document.querySelector('#server-form').hidden`), 'authenticated server import');
    const imported = settings.db.profiles.find(p => p.baseUrl === 'https://friend.example');
    report.authenticatedImport = Boolean(imported?.authRef) && authenticatedCalls === 2 && !imported.enabled;
    report.noSecretsInRenderer = !JSON.stringify(snapshot()).includes(canary) && await run(`document.querySelector('#server-secret').value === ''`);
    report.dpapiCredentialsEncrypted = !(await readFile(credentials.storage.file)).includes(Buffer.from(canary));
    const authRef = imported.authRef;
    await settings.commit({ ...settings.snapshot(), profiles: settings.db.profiles.filter(p => p.baseUrl !== 'https://friend.example') });
    await credentials.remove(authRef); publish();
  } finally { globalThis.fetch = originalFetch; }

  await run(`document.querySelector('#settings-dialog').scrollTop = 0;`);
  await image('preview-settings.png');
  await run(`document.querySelector('#tab-litellm').click();`);
  report.liteLLMConceptOnly = await run(`!document.querySelector('#litellm-panel').hidden && ['#gateway-url','#gateway-model','#gateway-key'].every(selector => document.querySelector(selector).disabled) && document.querySelector('#litellm-panel button').disabled`);
  await image('preview-litellm.png');
  await run(`document.querySelector('#settings-close').click(); document.querySelector('#message-input').value = 'Antworte bitte nur mit: Hallo Chris!'; document.querySelector('#chat-form').requestSubmit();`);
  await until(() => store.active.messages.some(m => m.role === 'assistant' && m.state === 'complete') && !snapshot().busy, 'real chat reply', 240000);
  report.dom = await run(`({ title: document.title, status: document.querySelector('#connection-label').textContent, visibleMessages: document.querySelectorAll('.message').length, answer: document.querySelector('.message.assistant .message-body').textContent, model: document.querySelector('#model-label').textContent, bridgeAvailable: typeof window.qwenChat.send === 'function' })`);
  const restored = new SessionStore(dataDir, cipher); await restored.load();
  report.historyRestored = restored.active.messages.length === store.active.messages.length;
  report.dpapiHistoryEncrypted = !(await readFile(store.file)).includes(Buffer.from(store.active.messages[0].content));
  report.dpapiSettingsEncrypted = !(await readFile(settings.file)).includes(Buffer.from(serverUrl));
  report.noPlaintextStore = await Promise.all(['history.json', 'settings.json'].map(async name => { try { await access(join(dataDir, name)); return false; } catch (error) { return error.code === 'ENOENT'; } })).then(results => results.every(Boolean));
  if (![report.serverImport, report.securityPanel, report.authenticatedImport, report.noSecretsInRenderer, report.dpapiCredentialsEncrypted, report.dpapiHistoryEncrypted, report.dpapiSettingsEncrypted, report.noPlaintextStore].every(Boolean)) throw new Error('Security verification failed');
  if (!report.settingsDialog || !report.disabledBlocksSending || !report.settingsRestored || !report.liteLLMConceptOnly || !report.discoveredModels.includes('qwen3.5:4b') || !report.historyRestored || report.dom.visibleMessages < 2) throw new Error('Settings/chat verification failed');
  await image('preview.png');
  // Real Qwen vision test with the public app icon, never user pictures.
  await store.create(); publish();
  const picture = await attachments.importFile(join(root, 'assets/icon.png')); drafts.add(picture.id);
  const visionResult = await run(`window.qwenChat.send('Beschreibe das Bild in einem kurzen deutschen Satz.', [${JSON.stringify(picture.id)}])`);
  report.realVision = visionResult.ok && store.active.messages.at(-1).content.trim().length > 10;
  if (!visionResult.ok) {
    report.visionServerError = visionResult.error;
    globalThis.fetch = async (url, init) => {
      if (!url.endsWith('/api/chat')) return originalFetch(url, init);
      if (JSON.parse(init.body).messages.at(-1).images?.[0] !== attachments.get(picture.id).base64) throw new Error('Missing image payload');
      return new Response(JSON.stringify({ done: true, message: { content: 'Ein goldener Kompassstern auf dunkelblauem Grund.' } }));
    };
    try {
      await store.create(); drafts.add(picture.id); publish();
      const fixture = await run(`window.qwenChat.send('Beschreibe das Bild.', [${JSON.stringify(picture.id)}])`);
      if (!fixture.ok) throw new Error('Vision fixture failed'); report.visionFixture = true;
    } finally { globalThis.fetch = originalFetch; }
  }
  report.inlineImage = await run(`document.querySelectorAll('.chat-attachment img').length === 1`);
  report.encryptedAttachment = !(await readFile(join(dataDir, 'attachment-' + picture.id + '.vault'))).includes(Buffer.from(attachments.get(picture.id).base64));
  await image('preview-vision.png');
  // No production image model has been installed. Verify the real UI against a fixture API.
  const originalProfiles = settings.snapshot();
  const fixtureBase64 = (await readFile(join(root, 'assets/icon.png'))).toString('base64');
  globalThis.fetch = async (url, init) => {
    if (!url.startsWith('https://images.example/')) return originalFetch(url, init);
    if (init.redirect !== 'error') throw new Error('Unsafe image redirect');
    return new Response(JSON.stringify(url.endsWith('/v1/models') ? { data: [{ id: 'sd-cpp-local' }] } : { data: [{ b64_json: fixtureBase64 }] }));
  };
  try {
    await run(`document.querySelector('#settings-button').click(); document.querySelector('#add-server').click(); document.querySelector('#server-type').value = 'image-api'; document.querySelector('#server-name').value = 'Qwen Image Test'; document.querySelector('#server-url').value = 'https://images.example'; document.querySelector('#server-http').checked = false; document.querySelector('#server-form').requestSubmit();`);
    await until(async () => !snapshot().settingsBusy && await run(`document.querySelector('#server-form').hidden`), 'image API import');
    const generator = settings.db.profiles.find(p => p.baseUrl === 'https://images.example');
    await settings.toggle(generator.id, true); await settings.select(generator.id); await store.create(); publish();
    await run(`document.querySelector('#settings-close').click();`);
    const generated = await run(`window.qwenChat.send('Ein goldener Kompassstern auf dunkelblauem Hintergrund.')`);
    if (!generated.ok) throw new Error('Image fixture: ' + generated.error);
    report.imageGenerationFixture = await run(`document.querySelectorAll('.message.assistant .chat-attachment img').length === 1`);
    const generatedId = store.active.messages.at(-1).attachmentIds[0];
    const restoredAttachments = new attachments.constructor(dataDir, cipher); await restoredAttachments.restore(store.active.messages);
    report.imageRestored = restoredAttachments.get(generatedId).base64 === fixtureBase64;
    await image('preview-images.png');
    await run(`document.querySelector('#settings-button').click(); document.querySelector('#tab-updates').click();`);
    report.updatesPanel = await run(`!document.querySelector('#updates-panel').hidden && document.querySelector('#app-version').textContent === '0.2.0' && document.querySelector('#update-install').disabled`);
    await image('preview-updates.png');
  } finally { globalThis.fetch = originalFetch; await settings.commit(originalProfiles); publish(); }
  if (![report.realVision || report.visionFixture, report.inlineImage, report.encryptedAttachment, report.imageGenerationFixture, report.imageRestored, report.updatesPanel].every(Boolean)) throw new Error('Attachment/image/update verification failed');
  report.passed = true;
  await writeFile(join(root, 'verification-app.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
