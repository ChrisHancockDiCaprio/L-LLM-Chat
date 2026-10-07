import { app, BrowserWindow, ipcMain, Menu, session, safeStorage, dialog, nativeImage } from 'electron';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { writeFile, readFile, stat } from 'node:fs/promises';
import updaterPackage from 'electron-updater';
import { dataPaths, APP_ID } from './data-paths.mjs';
import { UpdateManager } from './update-manager.mjs';
import { backupVault } from './update-backup.mjs';
import { AttachmentStore } from './attachments.mjs';
import { generateImage } from './image-client.mjs';
import { randomUUID } from 'node:crypto';
import { SessionStore, selectContext } from './session-store.mjs';
import { sendChat } from './ollama-client.mjs';
import { sendOpenaiChat } from './openai-client.mjs';
import { WorkflowStore } from './workflow-store.mjs';
import { SettingsStore, discoverModels, inspectServer, normalizeOrigin } from './settings-store.mjs';
import { CredentialStore } from './credential-store.mjs';
import { protectLegacyBackups } from './secure-file.mjs';
import { normalizeAuth, secureHeaders } from './connection-security.mjs';
import { verifyApplication } from './verify-app.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const verifyUpdateOnly = process.argv.includes('--verify-update');
const verify = process.argv.includes('--verify') || verifyUpdateOnly;
const releaseTestRoot = process.argv.find(a => a.startsWith('--release-test-root='))?.slice('--release-test-root='.length);
if (releaseTestRoot && !existsSync(join(releaseTestRoot, '.qwen-chat-test-root'))) throw new Error('Testordner ist nicht freigegeben.');
const { dataDir, legacyDirectory, appDataDir } = dataPaths({ root, appData: app.getPath('appData'), verify, verifySuite: verifyUpdateOnly ? 'update' : undefined, releaseTestRoot });
app.setAppUserModelId(APP_ID);
mkdirSync(appDataDir, { recursive: true });
app.setPath('userData', appDataDir);
app.commandLine.appendSwitch('disk-cache-size', '0');
app.setName('Qwen Chat');
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  let window; let controller; let busy = false; let checking; let settingsBusy = false; let checkEpoch = 0;
  let connection = { state: 'checking', message: 'Verbindung wird geprüft …' };
  let notice = ''; let omittedRounds = 0;
  let cipher; let store; let settings; let credentials; let workflows; let updates; let attachments; let closing = false; let updating = false;
  const drafts = new Set();
  const profileHealth = {};
  const snapshot = () => ({ ...store.db, sessions: store.db.sessions.map(s => ({...s, messages: s.messages.map(m => ({...m, attachments: (m.attachmentIds ?? []).map(id => attachments.preview(id)) }))})), settings: settings.snapshot(), workflows: Object.fromEntries(settings.db.profiles.filter(p => p.type === 'comfyui').map(p => [p.baseUrl, workflows.summary(p.baseUrl)])), profileHealth, settingsBusy, connection, busy, notice, omittedRounds, updates: updates?.snapshot(), security: { encrypted: true, vaultDirectory: dataDir } });
  const publish = () => { if (window && !window.isDestroyed()) window.webContents.send('chat:update', snapshot()); };
  const guard = event => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Ungültiger Fensteraufruf.');
  };
  const register = (name, handler) => ipcMain.handle(name, async (event, ...args) => { guard(event); return handler(...args); });
  async function check() {
    const profile = settings.active;
    if (!profile) { checkEpoch++; checking = undefined; connection = { state: 'inactive', message: 'Keine KI ausgewählt' }; publish(); return connection; }
    const key = JSON.stringify([profile.id, profile.baseUrl, profile.model, profile.name]);
    if (checking?.key === key) return checking.promise;
    const epoch = ++checkEpoch;
    connection = { state: 'checking', message: 'Verbindung wird geprüft …' }; publish();
    const promise = (async () => {
      let result;
      try {
        const models = await discoverModels(profile.baseUrl, { profile, auth: credentials.get(profile) });
        result = models.includes(profile.model) ? { state: 'online', message: `Mit ${profile.name} verbunden${profile.baseUrl.startsWith('http:') ? ' · HTTP im Heimnetz' : ' · HTTPS'}` } : { state: 'offline', message: `${profile.model} fehlt auf dem Server` };
        if (epoch === checkEpoch) profileHealth[profile.id] = { ...result, models };
      } catch (error) { result = { state: 'offline', message: error.message }; }
      if (epoch === checkEpoch) { connection = result; profileHealth[profile.id] = { ...profileHealth[profile.id], ...result }; checking = undefined; publish(); }
      return result;
    })();
    checking = { key, promise }; return promise;
  }
  async function changeSettings(operation) {
    if (busy || settingsBusy || updating) return { ok: false, error: 'Bitte warte auf den laufenden Vorgang oder brich die Antwort ab.' };
    settingsBusy = true; publish();
    const before = JSON.stringify(settings.active);
    try {
      const result = await operation();
      notice = result?.notice ?? '';
      if (before !== JSON.stringify(settings.active)) await check();
      return { ...result, ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
    finally { settingsBusy = false; publish(); }
  }

  async function refreshServers(id) {
    const profiles = settings.snapshot().profiles;
    const selected = id ? profiles.find(p => p.id === id) : null;
    if (id && !selected) throw new Error('Server nicht gefunden.');
    const seen = new Set(); let added = 0; let failed = 0;
    for (const profile of profiles) {
      if (selected && profile.baseUrl !== selected.baseUrl) continue;
      const key = JSON.stringify([profile.baseUrl, profile.type, profile.authRef]);
      if (seen.has(key)) continue; seen.add(key);
      try {
        const scanProfile = { ...profile, type: profile.type === 'ollama' ? 'auto' : profile.type };
        const models = await inspectServer(scanProfile, credentials.get(profile));
        const count = settings.db.profiles.length;
        if (models.length) await settings.importServer({ ...profile, name: profile.name.split(' · ')[0].slice(0, 30), models });
        added += settings.db.profiles.length - count;
        for (const p of settings.db.profiles.filter(p => p.baseUrl === profile.baseUrl && (p.type === profile.type || models.some(m => m.type === p.type)))) {
          const available = models.some(m => m.name === p.model && (m.type ?? profile.type) === p.type);
          profileHealth[p.id] = { state: available ? 'online' : 'offline', message: available ? 'Modell auf dem Server vorhanden' : 'Modell derzeit nicht in der Serverliste' };
        }
      } catch (error) {
        failed++;
        for (const p of profiles.filter(p => p.baseUrl === profile.baseUrl && p.type === profile.type)) profileHealth[p.id] = { state: 'offline', message: error.message };
        if (id) throw error;
      }
    }
    return { added, notice: failed ? `${failed} Server-Prüfung(en) fehlgeschlagen. Gespeicherte Verbindungen bleiben erhalten.` : added ? `${added} neue Modelle erkannt. Du kannst sie in den Einstellungen aktivieren.` : '' };
  }

  async function start() {
  await app.whenReady();
  if (process.platform !== 'win32' || !await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Windows-Verschlüsselung ist nicht verfügbar. Die App speichert keine Klartextdaten.');
  cipher = { encrypt: text => safeStorage.encryptStringAsync(text), decrypt: async buffer => (await safeStorage.decryptStringAsync(buffer)).result };
  store = new SessionStore(dataDir, cipher, { legacyDirectory, importLatestLegacy: process.argv.includes('--import-latest-legacy') });
  settings = new SettingsStore(dataDir, cipher, { legacyDirectory, legacyHttpAllowed: true });
  credentials = new CredentialStore(dataDir, cipher);
  workflows = new WorkflowStore(dataDir, cipher); await workflows.load();
  await credentials.load(); await store.load(); await settings.load();
  const validateImage = item => {
    const image = nativeImage.createFromBuffer(Buffer.from(item.base64, 'base64')); const size = image.getSize();
    if (image.isEmpty() || size.width > 8192 || size.height > 8192 || size.width * size.height > 24_000_000) throw new Error('Das Bild ist beschädigt oder hat zu viele Bildpunkte.');
  };
  attachments = new AttachmentStore(dataDir, cipher, validateImage);
  await attachments.restore(store.db.sessions.flatMap(s => s.messages));
  if (releaseTestRoot) {
    const { releaseSelfTest } = await import('./release-self-test.mjs');
    const report = await releaseSelfTest({ store, settings, credentials, attachments, root, cipher, dataDir, version: app.getVersion(), seed: process.argv.includes('--seed-release-test'), seedAttachments: process.argv.includes('--seed-release-attachments') });
    await writeFile(join(releaseTestRoot, 'report.json'), JSON.stringify(report));
    app.quit(); return;
  }
  await protectLegacyBackups(legacyDirectory, dataDir, cipher);
  notice = [store.notice, settings.notice].filter(Boolean).join(' ');
  const source = JSON.parse(readFileSync(join(root, 'release/update-source.json'), 'utf8'));
  updates = new UpdateManager({ updater: updaterPackage.autoUpdater, packaged: app.isPackaged, source, version: app.getVersion(), notify: publish,
    isBusy: () => busy || settingsBusy || updating,
    beforeInstall: async () => {
      updating = true;
      try {
        if (drafts.size || await window.webContents.executeJavaScript("Boolean(document.querySelector('#message-input').value.trim())")) throw new Error('Ungesendete Nachricht.');
        await Promise.all([store.storage.queue, settings.storage.queue, credentials.storage.queue, workflows.storage.queue]);
        await backupVault(dataDir, cipher, app.getVersion());
      } catch (error) { updating = false; throw error; }
    },
    // The unsigned pilot never installs downloaded executables automatically.
    installAllowed: false,
  });
  if (process.argv.includes('--refresh-known-servers')) await refreshServers();
  if (process.argv.includes('--audit-migration')) {
    console.log(JSON.stringify({ vaultDirectory: dataDir, sessions: store.db.sessions.length, messages: store.db.sessions.reduce((n, s) => n + s.messages.length, 0), activeId: settings.db.activeId, profiles: settings.db.profiles.map(p => ({ id: p.id, enabled: p.enabled })) }));
    app.quit(); return;
  }
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window = new BrowserWindow({
    title: 'Qwen Chat', width: 1140, height: 810, minWidth: 800, minHeight: 600,
    backgroundColor: '#f7f8f5', icon: join(root, 'assets/icon.png'), show: false, autoHideMenuBar: true,
    webPreferences: { preload: join(root, 'src/preload.cjs'), partition: 'qwen-chat-memory', contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !verify },
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', event => {
    if (closing || updating || verify) return;
    event.preventDefault(); controller?.abort();
    void (async () => {
      while (busy || settingsBusy) await new Promise(resolve => setTimeout(resolve, 50));
      await Promise.all([store.storage.queue, settings.storage.queue, credentials.storage.queue, workflows.storage.queue]);
      closing = true; window.close();
    })().catch(() => { notice = 'Speichern fehlgeschlagen. Das Fenster bleibt zur Sicherheit geöffnet.'; publish(); });
  });
  window.once('ready-to-show', () => { if (!verify) window.show(); });
  app.on('second-instance', (_event, args) => { if (window.isMinimized()) window.restore(); window.show(); window.focus(); if (args.includes('--show-settings')) void window.webContents.executeJavaScript(`document.querySelector('#settings-button').click()`); });
  app.on('window-all-closed', () => app.quit());

  register('chat:state', () => snapshot());
  register('attachments:add', async () => {
    if (busy || settingsBusy || updating) return { ok: false, error: 'Bitte den laufenden Vorgang abschließen.' };
    if (drafts.size >= 20) return { ok: false, error: 'Bitte nicht benötigte Anhänge entfernen.' };
    const selected = await dialog.showOpenDialog(window, { title: 'Bild oder Textdatei anhängen', properties: ['openFile'], filters: [{ name: 'Bilder und Textdateien', extensions: ['png','jpg','jpeg','webp','txt','md','csv','json','py','js','ts','log','html','css','xml','yaml','yml','toml','sql','ps1'] }] });
    if (selected.canceled) return { ok: true, cancelled: true };
    try { const attachment = await attachments.importFile(selected.filePaths[0]); drafts.add(attachment.id); return { ok: true, attachment }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
  register('attachments:remove', id => { if (busy || updating) return { ok: false, error: 'Bitte die laufende Anfrage abschließen.' }; if (drafts.delete(id)) attachments.items.delete(id); return { ok: true }; });
  register('updates:check', () => updates.check());
  register('updates:download', () => updates.download());
  register('updates:install', () => updates.install());
  register('chat:check', async () => { const result = await changeSettings(() => refreshServers(settings.active?.id)); if (result.ok) await check(); return result; });
  register('settings:refresh', id => changeSettings(() => refreshServers(id)));
  register('settings:remove', (id, wholeServer = false) => changeSettings(async () => {
    const removed = await settings.remove(id, wholeServer);
    for (const profile of removed) delete profileHealth[profile.id];
    try { await credentials.collectUnused(settings.db.profiles); await workflows.collectUnused(settings.db.profiles); }
    catch { return { notice: 'Verbindung entfernt. Ein ungenutzter Zugang konnte noch nicht aus dem verschlüsselten Tresor entfernt werden.' }; }
    return { removed: removed.length };
  }));
  register('settings:workflow', id => changeSettings(async () => {
    const profile = settings.db.profiles.find(p => p.id === id && p.type === 'comfyui');
    if (!profile) throw new Error('Bitte eine ComfyUI-Verbindung auswählen.');
    const selected = await dialog.showOpenDialog(window, { title: 'ComfyUI-Workflow im API-Format importieren', properties: ['openFile'], filters: [{ name: 'API-Workflow', extensions: ['json'] }] });
    if (selected.canceled) return { cancelled: true };
    const file = selected.filePaths[0];
    if ((await stat(file)).size > 2 * 1024 * 1024) throw new Error('Der Workflow darf maximal 2 MB groß sein.');
    let raw; try { raw = JSON.parse(await readFile(file, 'utf8')); } catch { throw new Error('Bitte eine gültige JSON-Datei im API-Format auswählen.'); }
    await workflows.import(profile.baseUrl, basename(file), raw);
    return { notice: 'API-Workflow verschlüsselt importiert. Prompt-Zuordnung und Bildlauf werden anschließend eingerichtet.' };
  }));
  register('settings:save', profile => changeSettings(async () => {
    const existing = settings.db.profiles.find(p => p.id === profile?.id);
    const candidate = { ...existing, ...profile };
    const auth = existing && normalizeOrigin(candidate.baseUrl) === existing.baseUrl ? credentials.get(existing) : { type: 'none' };
    secureHeaders(candidate, auth); await settings.upsert(profile);
  }));
  register('settings:toggle', (id, enabled) => changeSettings(() => settings.toggle(id, enabled)));
  register('settings:select', id => changeSettings(() => settings.select(id)));
  register('settings:probe', async request => {
    try {
      const profile = request?.id ? settings.db.profiles.find(p => p.id === request.id) : { type: request?.type ?? 'ollama', baseUrl: normalizeOrigin(request?.baseUrl), allowHttp: request?.allowHttp === true };
      if (!profile) throw new Error('Verbindung nicht gefunden.');
      return { ok: true, models: await discoverModels(profile.baseUrl, { profile, auth: request?.id ? credentials.get(profile) : normalizeAuth(request?.auth) }) };
    }
    catch (error) { return { ok: false, error: error.message }; }
  });
  register('settings:server', raw => changeSettings(async () => {
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 30) throw new Error('Bitte einen Servernamen mit maximal 30 Zeichen eingeben.');
    const profile = { type: raw.type ?? 'auto', baseUrl: normalizeOrigin(raw.baseUrl), allowHttp: raw.allowHttp === true };
    const existing = raw.id ? settings.db.profiles.find(p => p.id === raw.id) : null;
    if (raw.useStoredAuth && (!existing || existing.baseUrl !== profile.baseUrl || existing.authType !== raw.auth?.type)) throw new Error('Für eine neue Adresse oder Zugangsart bitte neue Zugangsdaten eingeben.');
    const auth = raw.useStoredAuth ? credentials.get(existing) : normalizeAuth(raw.auth); secureHeaders(profile, auth);
    const models = await inspectServer(profile, auth);
    if (!models.length) throw new Error('Server erreichbar, aber es sind noch keine Modelle installiert.');
    const ref = await credentials.add(profile.baseUrl, auth);
    const oldRefs = new Set(settings.db.profiles.filter(p => p.baseUrl === profile.baseUrl).map(p => p.authRef).filter(Boolean));
    try { await settings.importServer({ ...profile, name: raw.name, models, authRef: ref, authType: auth.type, restoreRemoved: true }); }
    catch (error) { await credentials.remove(ref); throw error; }
    for (const id of oldRefs) if (!settings.db.profiles.some(p => p.authRef === id)) await credentials.remove(id);
  }));
  register('chat:new', async () => {
    if (busy) return { ok: false, error: 'Bitte warte auf die Antwort oder brich die Anfrage ab.' };
    await store.create(); omittedRounds = 0; notice = ''; publish(); return { ok: true };
  });
  register('chat:select', async id => {
    if (busy) return { ok: false, error: 'Bitte warte auf die Antwort oder brich die Anfrage ab.' };
    if (typeof id !== 'string') return { ok: false, error: 'Ungültiges Gespräch.' };
    await store.select(id); omittedRounds = 0; notice = ''; publish(); return { ok: true };
  });
  register('chat:cancel', () => { controller?.abort(); return { ok: true }; });
  register('chat:send', async (text, attachmentIds = []) => {
    if (busy || updating || closing) return { ok: false, error: 'Bitte den laufenden Vorgang abschließen.' };
    if (settingsBusy) return { ok: false, error: 'Die Einstellungen werden gerade gespeichert.' };
    const profile = settings.active;
    if (!profile) return { ok: false, error: 'Bitte in den Einstellungen eine KI aktivieren und für den Chat auswählen.' };
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Schreib zuerst eine Nachricht.' };
    text = text.trim();
    if (!Array.isArray(attachmentIds) || attachmentIds.length > 4 || new Set(attachmentIds).size !== attachmentIds.length || attachmentIds.some(id => !drafts.has(id))) return { ok: false, error: 'Bitte gültige Anhänge auswählen (maximal vier).' };
    let context;
    try {
      if (profile.type === 'image-api') {
        if (attachmentIds.some(id => attachments.get(id).kind !== 'image')) throw new Error('Bildgeneratoren akzeptieren Bilder, keine Textdateien.');
      } else {
        const newest = attachments.wireMessage({ role: 'user', content: text, attachmentIds }, profile);
        const history = store.active.messages.map(m => ({ ...m, ...attachments.wireMessage(m, profile) }));
        const budget = Math.min(32000, Math.max(128, (profile.options.num_ctx - Math.min(profile.options.num_predict, profile.options.num_ctx / 2) - 512 - (newest.images?.length ?? 0) * 1024) * 2));
        context = selectContext(history, newest.content, budget, newest.images ? { images: newest.images } : {});
        if (context.messages.some(m => m.images?.length) && !profile.capabilities.includes('vision')) throw new Error('Dieses Modell versteht keine Bilder. Wähle ein Vision-Modell oder beginne einen Chat ohne Bilder.');
      }
    }
    catch (error) { return { ok: false, error: error.message }; }
    const active = store.active;
    const message = { id: randomUUID(), role: 'user', content: text, state: 'pending', createdAt: new Date().toISOString(), ...(attachmentIds.length ? { attachmentIds } : {}) };
    active.messages.push(message);
    if (active.title === 'Neues Gespräch') active.title = text.replace(/\s+/g, ' ').slice(0, 44);
    omittedRounds = context?.omittedRounds ?? 0; notice = ''; busy = true; controller = new AbortController(); publish();
    let attachmentsPersisted = false;
    try {
      await attachments.persist(attachmentIds);
      attachmentsPersisted = true;
      attachmentIds.forEach(id => drafts.delete(id));
      await store.save();
      let reply; let generatedIds;
      if (profile.type === 'image-api') {
        const image = await generateImage(text, { signal: controller.signal, profile, auth: credentials.get(profile), references: attachmentIds.map(id => attachments.get(id)) });
        validateImage(image); attachments.items.set(image.id, image); await attachments.persist([image.id]); generatedIds = [image.id]; reply = 'Hier ist dein Bild.';
      } else reply = await (profile.type === 'openai-chat' ? sendOpenaiChat : sendChat)(context.messages, { signal: controller.signal, profile, auth: credentials.get(profile) });
      message.state = 'complete';
      active.messages.push({ id: randomUUID(), role: 'assistant', content: reply, model: profile.model, providerName: profile.name, state: 'complete', createdAt: new Date().toISOString(), ...(generatedIds ? { attachmentIds: generatedIds } : {}) });
      try { await store.save(); } catch { notice = 'Die Antwort ist da, aber der Verlauf konnte nicht gespeichert werden.'; }
      connection = { state: 'online', message: `Mit ${profile.name} verbunden` };
      return { ok: true, submitted: true };
    } catch (error) {
      if (!attachmentsPersisted) delete message.attachmentIds;
      message.state = controller.signal.aborted ? 'cancelled' : 'failed';
      notice = error.message;
      try { await store.save(); } catch { notice += ' Der Verlauf konnte nicht gespeichert werden.'; }
      if (/nicht erreichbar/.test(error.message)) connection = { state: 'offline', message: `${profile.name} ist gerade nicht erreichbar` };
      return { ok: false, submitted: attachmentsPersisted, error: notice };
    } finally { busy = false; controller = undefined; publish(); }
  });

  await window.loadFile(join(root, 'ui/index.html'));
  if (!verify) await changeSettings(() => refreshServers());
  if (!verifyUpdateOnly) await check();
  if ((process.argv.includes('--show-settings') || process.argv.includes('--show-security')) && !verify) await window.webContents.executeJavaScript(`document.querySelector('#settings-button').click(); ${process.argv.includes('--show-security') ? "document.querySelector('#tab-security').click();" : ''}`);
  if (verify) {
    try {
      const verifier = verifyUpdateOnly ? (await import('./verify-update.mjs')).verifyUpdate : verifyApplication;
      const report = await verifier({ root, dataDir, window, store, settings, cipher, credentials, workflows, attachments, drafts, publish, snapshot });
      console.log(JSON.stringify(report));
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  }
  }
  void start().catch(error => { if (verify || releaseTestRoot) console.error(error); else dialog.showErrorBox('Qwen Chat · Tresor gesperrt', 'Der verschlüsselte Speicher konnte nicht sicher geöffnet werden. Vorhandene Daten bleiben erhalten. Es wird nichts im Klartext gespeichert.'); app.exit(1); });
}
