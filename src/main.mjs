import { JobStore, boundJob, connectionIdentity } from './job-store.mjs';
import { SSHStore, validateSSH, apiDestination } from './ssh-store.mjs';
import { TunnelManager } from './tunnel-manager.mjs';
import { createHash } from 'node:crypto';
import { app, BrowserWindow, ipcMain, Menu, session, safeStorage, dialog, nativeImage, shell } from 'electron';
import { registerTts } from './tts-service.mjs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { writeFile, readFile, stat } from 'node:fs/promises';
import updaterPackage from 'electron-updater';
import { dataPaths, APP_ID } from './data-paths.mjs';
import { UpdateManager } from './update-manager.mjs';
import { githubSource } from './update-source.mjs';
import { backupVault } from './update-backup.mjs';
import { AttachmentStore } from './attachments.mjs';
import { generateImage } from './image-client.mjs';
import { randomUUID } from 'node:crypto';
import { SessionStore, selectContext } from './session-store.mjs';
import { sendChat } from './ollama-client.mjs';
import { sendOpenaiChat } from './openai-client.mjs';
import { WorkflowStore } from './workflow-store.mjs';
import { generateComfyImages, prepareComfyWorkflow, queryComfyJob, fetchComfyResult, cancelComfyJob } from './comfyui-client.mjs';
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
app.setName('KAIROS');
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  let tts; let window; let controller; let busy = false; let checking; let settingsBusy = false; let checkEpoch = 0;
  let connection = { state: 'checking', message: 'Verbindung wird geprüft …' };
  let notice = ''; let omittedRounds = 0; let imageProgress = null;
  let jobs; let sshStore; let tunnels; let activeJob; let currentServerStop; let jobAction = false; let actionController; let shuttingDown=false;
  let cipher; let store; let settings; let credentials; let workflows; let updates; let attachments; let closing = false; let updating = false;
  const drafts = new Set();
  const profileHealth = {};
  const snapshot = () => ({ ...store.db, tts: tts?.snapshot(), jobs: jobs?.snapshot().map(j=>({...j,bindingOK:boundJob(j,settings?.db?.profiles.find(p=>p.id===j.profileId))})), tunnels: tunnels?.snapshot(), activeJobId: activeJob?.id, jobAction, sessions: store.db.sessions.map(s => ({...s, messages: s.messages.map(m => ({...m, attachments: (m.attachmentIds ?? []).map(id => attachments.preview(id)) }))})), settings: settings.snapshot(), workflows: Object.fromEntries(settings.db.profiles.filter(p => p.type === 'comfyui').map(p => [p.id, workflows.summary(p)])), profileHealth, settingsBusy, connection, busy, notice, omittedRounds, imageProgress, updates: updates?.snapshot(), security: { encrypted: true, vaultDirectory: dataDir } });
  const publish = () => { if (window && !window.isDestroyed()) window.webContents.send('chat:update', snapshot()); };
  const guard = event => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Ungültiger Fensteraufruf.');
  };
  const register = (name, handler) => ipcMain.handle(name, async (event, ...args) => { guard(event); return handler(...args); });
  const wireProfile = profile => tunnels.ensure(profile);
  async function proveOnline(profile) {
    try {
      const wire = await wireProfile(profile); const models = await discoverModels(wire.baseUrl, {profile:wire,auth:credentials.get(profile),signal:actionController?.signal});
      if(profile.type!=='comfyui' && !models.includes(profile.model)) throw Error('Modell nicht auf dem Server vorhanden.');
      profileHealth[profile.id]={state:'online',message:'API erreichbar · Modell vorhanden',checkedAt:Date.now(),identity:connectionIdentity(profile)};
    }catch(error){profileHealth[profile.id]={state:'offline',message:error.message,checkedAt:Date.now(),identity:connectionIdentity(profile)};throw error;}finally{publish();}
  }
  async function applyRecovered(job, result) {
    const chat = store.db.sessions.find(s=>s.id===job.chatId); const message = chat?.messages.find(m=>m.id===job.messageId);
    if(!chat||!message)throw Error('Das ursprüngliche Gespräch wurde gelöscht.');
    if(chat.messages.some(m=>m.jobId===job.id && m.role==='assistant')) { await jobs.update(job.id,{state:'completed',waiting:false,detail:'Ergebnis bereits diesem Gespräch zugeordnet.'}); return; }
    const ids=result.images.map((image,index)=>{
      validateImageRuntime(image); const hash=createHash('sha256').update(job.id+':'+index).digest('hex');
      image.id=hash.slice(0,8)+'-'+hash.slice(8,12)+'-'+hash.slice(12,16)+'-'+hash.slice(16,20)+'-'+hash.slice(20,32);
      attachments.items.set(image.id,image);return image.id;
    });
    await attachments.persist(ids);
    const reply={id:job.id,jobId:job.id,role:'assistant',content:'Hier ist dein Bild.'+(job.seed===undefined?'':' Seed: '+job.seed),model:job.model,providerName:job.providerName,state:'complete',createdAt:new Date().toISOString(),attachmentIds:ids};
    message.state='complete'; chat.messages.splice(chat.messages.indexOf(message)+1,0,reply);
    try{await store.save()}catch(error){chat.messages.splice(chat.messages.indexOf(reply),1);message.state='unknown';throw error;}
    await jobs.update(job.id,{state:'completed',waiting:false,detail:'Ergebnis im ursprünglichen Gespräch gespeichert.'}); publish();
  }
  let validateImageRuntime;
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
        const wire = await wireProfile(profile); const models = await discoverModels(wire.baseUrl, { profile:wire, auth: credentials.get(profile) });
        result = (profile.type === 'comfyui' || models.includes(profile.model)) ? { identity:connectionIdentity(profile), state: 'online', message: `Mit ${profile.name} verbunden${profile.baseUrl.startsWith('http:') ? ' · HTTP im Heimnetz' : ' · HTTPS'}` } : { state: 'offline', message: `${profile.model} fehlt auf dem Server` };
        if (epoch === checkEpoch) profileHealth[profile.id] = { ...result, models };
      } catch (error) { result = { state: 'offline', message: error.message }; }
      if (epoch === checkEpoch) { connection = result; profileHealth[profile.id] = { ...profileHealth[profile.id], ...result }; checking = undefined; publish(); }
      return result;
    })();
    checking = { key, promise }; return promise;
  }
  async function changeSettings(operation) {
    if (busy || settingsBusy || jobAction || updating || shuttingDown) return { ok: false, error: 'Bitte warte auf den laufenden Vorgang oder brich die Antwort ab.' };
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
      if (selected && apiDestination(profile) !== apiDestination(selected)) continue;
      const key = JSON.stringify([apiDestination(profile), profile.type, profile.authRef]);
      if (seen.has(key)) continue; seen.add(key);
      try {
        const scanProfile = await wireProfile({ ...profile, type: profile.type === 'ollama' ? 'auto' : profile.type });
        const models = await inspectServer(scanProfile, credentials.get(profile));
        const count = settings.db.profiles.length;
        if (models.length) await settings.importServer({ ...profile, name: profile.name.split(' · ')[0].slice(0, 30), models });
        added += settings.db.profiles.length - count;
        for (const p of settings.db.profiles.filter(p => apiDestination(p) === apiDestination(profile) && (p.type === profile.type || models.some(m => m.type === p.type)))) {
          const available = models.some(m => (p.type === 'comfyui' || m.name === p.model) && (m.type ?? profile.type) === p.type);
          profileHealth[p.id] = { identity:connectionIdentity(p), state: available ? 'online' : 'offline', message: available ? 'Modell auf dem Server vorhanden' : 'Modell derzeit nicht in der Serverliste' };
        }
      } catch (error) {
        failed++;
        for (const p of profiles.filter(p => apiDestination(p) === apiDestination(profile) && p.type === profile.type)) profileHealth[p.id] = { identity:connectionIdentity(p), state: 'offline', message: error.message };
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
  jobs = new JobStore(dataDir, cipher); await jobs.load();
  sshStore = new SSHStore(dataDir, cipher); await sshStore.load(); tunnels = new TunnelManager(sshStore,{notify:()=>{for(const e of tunnels?.snapshot().connections??[])if(e.tunnel!=='ready')for(const id of e.profileIds)profileHealth[id]={state:'offline',message:e.detail};publish()}});
  workflows = new WorkflowStore(dataDir, cipher);
  await credentials.load(); await store.load(); await settings.load(); await workflows.load(settings.db.profiles);
  const validateImage = item => {
    const image = nativeImage.createFromBuffer(Buffer.from(item.base64, 'base64')); const size = image.getSize();
    if (image.isEmpty() || size.width > 8192 || size.height > 8192 || size.width * size.height > 24_000_000) throw new Error('Das Bild ist beschädigt oder hat zu viele Bildpunkte.');
  };
  validateImageRuntime = validateImage;
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
  const source = settings.db.updateRepository ? githubSource(settings.db.updateRepository) : JSON.parse(readFileSync(join(root, 'release/update-source.json'), 'utf8'));
  updates = new UpdateManager({ updater: updaterPackage.autoUpdater, packaged: app.isPackaged, source, version: app.getVersion(), beta: settings.db.betaUpdates, notify: publish,
    isBusy: () => busy || settingsBusy || jobAction || shuttingDown || updating || tts?.busy,
    beforeInstall: async () => {
      updating = true;
      try {
        if (drafts.size || await window.webContents.executeJavaScript("Boolean(document.querySelector('#message-input').value.trim())")) throw new Error('Ungesendete Nachricht.');
        await Promise.all([store.storage.queue, settings.storage.queue, credentials.storage.queue, workflows.storage.queue, jobs.queue, sshStore.queue, tts?.queue]);
        await backupVault(dataDir, cipher, app.getVersion());
      } catch (error) { updating = false; throw error; }
    },
    installAllowed: false,
    onInstallFailure: () => { updating = false; },
    confirmUnsignedInstall: async ({ targetVersion, repository }) => {
      const result = await dialog.showMessageBox(window, {
        type: 'warning', title: 'KAIROS · Unsigniertes Update',
        message: 'ACHTUNG: Update ohne verifizierte Herausgebersignatur installieren?',
        detail: `Version: ${targetVersion ?? 'unbekannt'}\nQuelle: ${repository}\n\nDie Identität des Herausgebers ist nicht durch ein Windows-Zertifikat bestätigt. Eine manipulierte Veröffentlichung könnte Schadsoftware enthalten. Die Download-Prüfsumme ersetzt keine Signatur.\n\nBestätige nur, wenn du dieser Quelle vertraust. Dein verschlüsselter Tresor wird vor dem Start des Installers gesichert. Windows kann die Ausführung weiterhin blockieren. Diese Zustimmung gilt nur für diese Installation.`,
        buttons: ['Abbrechen', 'Risiko akzeptieren und installieren'], defaultId: 0, cancelId: 0, noLink: true,
      });
      return result.response === 1;
    },
  });
  if (process.argv.includes('--refresh-known-servers')) await refreshServers();
  if (process.argv.includes('--audit-migration')) {
    console.log(JSON.stringify({ vaultDirectory: dataDir, sessions: store.db.sessions.length, messages: store.db.sessions.reduce((n, s) => n + s.messages.length, 0), activeId: settings.db.activeId, profiles: settings.db.profiles.map(p => ({ id: p.id, enabled: p.enabled })) }));
    app.quit(); return;
  }
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window = new BrowserWindow({
    title: 'KAIROS', width: 1140, height: 810, minWidth: 800, minHeight: 600,
    backgroundColor: '#f7f8f5', icon: join(root, 'assets/icon.png'), show: false, autoHideMenuBar: true,
    webPreferences: { preload: join(root, 'src/preload.cjs'), partition: 'qwen-chat-memory', contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !verify },
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', event => {
    if (closing || updating || verify) return;
    event.preventDefault(); if(shuttingDown)return;shuttingDown=true;tts?.abort();controller?.abort(); actionController?.abort(); tunnels.close();
    void (async () => {
      while (busy || settingsBusy || jobAction || tts?.busy) await new Promise(resolve => setTimeout(resolve, 50));
      await Promise.all([store.storage.queue, settings.storage.queue, credentials.storage.queue, workflows.storage.queue, jobs.queue, sshStore.queue, tts?.queue]);
      closing = true; window.close();
    })().catch(() => { notice = 'Speichern fehlgeschlagen. Das Fenster bleibt zur Sicherheit geöffnet.'; publish(); });
  });
  window.once('ready-to-show', () => { if (!verify) window.show(); });
  app.on('second-instance', (_event, args) => { if (window.isMinimized()) window.restore(); window.show(); window.focus(); if (args.includes('--show-settings')) void window.webContents.executeJavaScript(`document.querySelector('#settings-button').click()`); });
  app.on('window-all-closed', () => app.quit());

  register('ssh:trust', async (id,accept) => {try{await tunnels.confirm(id,accept);return {ok:true}}catch(error){return {ok:false,error:error.message}}});
  register('ssh:key', config => changeSettings(async()=>{
    const ssh=validateSSH({...config,authType:'key'}); if(!ssh)throw Error('SSH-Konfiguration fehlt.');
    const selected=await dialog.showOpenDialog(window,{title:'SSH-Schlüssel importieren',properties:['openFile']});if(selected.canceled)return {cancelled:true};
    if((await stat(selected.filePaths[0])).size>65536)throw Error('SSH-Schlüssel darf höchstens 64 KB groß sein.');
    const ref=await sshStore.add(ssh,{privateKey:await readFile(selected.filePaths[0],'utf8'),passphrase:config.passphrase??''});
    return {credentialsRef:ref,notice:'SSH-Schlüssel verschlüsselt im Zugangstresor gespeichert.'};
  }));
  register('jobs:check', async id=>{
    if(busy||settingsBusy||jobAction||closing||shuttingDown||updating)return {ok:false,error:'Bitte den laufenden Vorgang abschließen.'};
    jobAction=true;actionController=new AbortController();publish();
    try{
      const job=jobs.get(id);const profile=settings.db.profiles.find(p=>p.id===job.profileId);
      if(!job.recoverable||job.backend!=='comfyui'||!job.serverId)throw Error('Dieses Backend bietet für den Auftrag keinen Ergebnis-Wiederabruf.');
      if(!boundJob(job,profile))throw Error('Verbindung geändert oder gelöscht. Der Auftrag wird nicht auf einem anderen Server gesucht.');
      const wire=await wireProfile(profile);const status=await queryComfyJob(job,{profile:wire,auth:credentials.get(profile),signal:actionController?.signal});
      if(status.state==='completed')await applyRecovered(job,await fetchComfyResult(job,status.result,{profile:wire,auth:credentials.get(profile),signal:actionController?.signal}));
      else await jobs.update(id,{state:status.state,detail:status.detail,waiting:false});
      return {ok:true};
    }catch(error){try{await jobs.update(id,{state:'unknown',waiting:false,detail:error.message+' Der Auftrag kann weiterhin auf dem Server laufen.'})}catch{}return {ok:false,error:error.message};}
    finally{jobAction=false;actionController=undefined;publish();}
  });
  register('jobs:stop', async id=>{
    if(settingsBusy||jobAction||closing||shuttingDown||updating)return {ok:false,error:'Bitte den laufenden Vorgang abschließen.'};
    jobAction=true;publish();
    try{
      const job=jobs.get(id);const profile=settings.db.profiles.find(p=>p.id===job.profileId);
      if(job.backend!=='comfyui'||!job.serverId||!boundJob(job,profile))throw Error('Kein verifizierter Serverabbruch für diesen Auftrag verfügbar.');
      const wire=await wireProfile(profile);const result=await cancelComfyJob(job,{profile:wire,auth:credentials.get(profile)});
      await jobs.update(id,{state:result.state,detail:result.detail,...(result.confirmed?{waiting:false}:{})});
      if(result.confirmed && activeJob?.id===id){currentServerStop=true;controller?.abort();}
      return {ok:result.confirmed,error:result.confirmed?undefined:result.detail};
    }catch(error){return {ok:false,error:error.message}}finally{jobAction=false;publish();}
  });
  register('chat:state', () => snapshot());
  register('attachments:add', async () => {
    if (busy || settingsBusy || jobAction || updating) return { ok: false, error: 'Bitte den laufenden Vorgang abschließen.' };
    if (drafts.size >= 20) return { ok: false, error: 'Bitte nicht benötigte Anhänge entfernen.' };
    const profile = settings.active;
    if (!profile || profile.type === 'comfyui' || !(profile.uploads.files || profile.uploads.photos)) return { ok: false, error: 'Uploads für dieses Modell sind deaktiviert.' };
    const selected = await dialog.showOpenDialog(window, { title: 'Bild oder Textdatei anhängen', properties: ['openFile'], filters: [{ name: 'Bilder und Textdateien', extensions: ['png','jpg','jpeg','webp','txt','md','csv','json','py','js','ts','log','html','css','xml','yaml','yml','toml','sql','ps1'] }] });
    if (selected.canceled) return { ok: true, cancelled: true };
    try { const attachment = await attachments.importFile(selected.filePaths[0]); if (!(attachment.kind === 'image' ? profile.uploads.photos : profile.uploads.files)) { attachments.items.delete(attachment.id); throw new Error('Diese Upload-Art ist für das Modell deaktiviert.'); }
      drafts.add(attachment.id); return { ok: true, attachment }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
  register('attachments:remove', id => { if (busy || updating) return { ok: false, error: 'Bitte die laufende Anfrage abschließen.' }; if (drafts.delete(id)) attachments.items.delete(id); return { ok: true }; });
  register('attachments:export', async id => {
    try {
      if (!store.db.sessions.some(s => s.messages.some(m => m.attachmentIds?.includes(id)))) throw new Error('Dieses Bild gehört zu keiner gespeicherten Nachricht.');
      const image = attachments.get(id); if (image.kind !== 'image') throw new Error('Bitte ein Bild auswählen.');
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[image.mime];
      const selected = await dialog.showSaveDialog(window, { title: 'Bild speichern', defaultPath: `KAIROS-Bild.${extension}`, filters: [{ name: 'Bild', extensions: [extension] }] });
      if (selected.canceled || !selected.filePath) return { ok: true, cancelled: true };
      await writeFile(selected.filePath, Buffer.from(image.base64, 'base64')); return { ok: true };
    } catch { return { ok: false, error: 'Das Bild konnte nicht gespeichert werden.' }; }
  });
  register('updates:beta', value => changeSettings(() => updates.saveBeta(value, enabled => settings.setBetaUpdates(enabled))));
  register('updates:check', () => updates.check());
  register('updates:download', () => updates.download());
  register('updates:install', () => updates.install());
  register('updates:source', value => changeSettings(async () => {
    const result = await updates.saveRepository(value, url => settings.setUpdateRepository(url));
    if (!result.ok) throw new Error(result.error);
    return result;
  }));
  register('chat:check', async () => { const result = await changeSettings(() => refreshServers(settings.active?.id)); if (result.ok) await check(); return result; });
  register('settings:refresh', id => changeSettings(() => refreshServers(id)));
  register('settings:remove', (id, wholeServer = false) => changeSettings(async () => {
    const removed = await settings.remove(id, wholeServer);
    for (const profile of removed) delete profileHealth[profile.id];
    try { await credentials.collectUnused(settings.db.profiles); await workflows.collectUnused(settings.db.profiles); }
    catch { return { notice: 'Verbindung entfernt. Ein ungenutzter Zugang konnte noch nicht aus dem verschlüsselten Tresor entfernt werden.' }; }
    return { removed: removed.length };
  }));
  register('settings:workflow-duplicate', id => changeSettings(async () => {
    const profile = await settings.duplicateImageProfile(id);
    return { id: profile.id, notice: 'Eigenes Bild-Profil angelegt. Bitte Vorlage importieren und Modellnamen bearbeiten.' };
  }));
  register('settings:workflow', id => changeSettings(async () => {
    const profile = settings.db.profiles.find(p => p.id === id && p.type === 'comfyui');
    if (!profile) throw new Error('Bitte eine ComfyUI-Verbindung auswählen.');
    const selected = await dialog.showOpenDialog(window, { title: 'ComfyUI-Workflow im API-Format importieren', properties: ['openFile'], filters: [{ name: 'API-Workflow', extensions: ['json'] }] });
    if (selected.canceled) return { cancelled: true };
    const file = selected.filePaths[0];
    if ((await stat(file)).size > 2 * 1024 * 1024) throw new Error('Der Workflow darf maximal 2 MB groß sein.');
    let raw; try { raw = JSON.parse(await readFile(file, 'utf8')); } catch { throw new Error('Bitte eine gültige JSON-Datei im API-Format auswählen.'); }
    await workflows.import(profile, basename(file), raw);
    if (profile.enabled) await settings.toggle(profile.id, false);
    return { notice: 'API-Workflow verschlüsselt importiert. Bitte jetzt die editierbaren Eingänge und den Ausgabe-Node zuordnen.' };
  }));
  register('settings:workflow-config', (id, mapping, options, limits) => changeSettings(async () => {
    const profile = settings.db.profiles.find(p => p.id === id && p.type === 'comfyui');
    if (!profile) throw new Error('ComfyUI-Verbindung nicht gefunden.');
    await workflows.configure(profile, mapping, options, limits);
    return { notice: 'Workflow-Zuordnung verschlüsselt gespeichert. Du kannst das Bild-Backend jetzt aktivieren.' };
  }));
  register('settings:save', profile => changeSettings(async () => {
    const existing = settings.db.profiles.find(p => p.id === profile?.id);
    const candidate = { ...existing, ...profile };
    if (candidate.type === 'comfyui' && candidate.enabled && !workflows.summary(candidate)?.ready) throw new Error('Bitte zuerst den API-Workflow importieren und seine Eingänge zuordnen.');
    const auth = existing && normalizeOrigin(candidate.baseUrl) === existing.baseUrl ? credentials.get(existing) : { type: 'none' };
    const checkedCandidate={...candidate,id:candidate.id??"new"};
    if(candidate.enabled)await proveOnline(checkedCandidate);
    secureHeaders(await wireProfile(checkedCandidate), auth); await settings.upsert(profile);
  }));
  register('settings:toggle', (id, enabled) => changeSettings(async () => {
    const profile = settings.db.profiles.find(p => p.id === id);
    if (enabled && profile?.type === 'comfyui' && !workflows.summary(profile)?.ready) throw new Error('Bitte zuerst den API-Workflow importieren und seine Eingänge zuordnen.');
    if(enabled)await proveOnline(profile);
    return settings.toggle(id, enabled);
  }));
  register('settings:select', id => changeSettings(async () => {const p=settings.db.profiles.find(p=>p.id===id);if(!p)throw Error('Verbindung nicht gefunden.');await proveOnline(p);return settings.select(id)}));
  register('settings:probe', async request => {
    if(busy||settingsBusy||jobAction)return {ok:false,error:'Einstellungen sind während des laufenden Auftrags gesperrt.'};
    try {
      const profile = request?.id ? settings.db.profiles.find(p => p.id === request.id) : { type: request?.type ?? 'ollama', baseUrl: normalizeOrigin(request?.baseUrl), allowHttp: request?.allowHttp === true };
      if (!profile) throw new Error('Verbindung nicht gefunden.');
      const wire=await wireProfile(profile);
      const models=await discoverModels(wire.baseUrl, { profile:wire, auth: request?.id ? credentials.get(profile) : normalizeAuth(request?.auth) });
      if(request?.id){profileHealth[profile.id]={state:(profile.type==='comfyui'||models.includes(profile.model))?'online':'offline',message:'API-Verbindung geprüft',identity:connectionIdentity(profile),checkedAt:Date.now()};publish();}
      return {ok:true,models};
    }
    catch (error) {if(request?.id && settings.db.profiles.some(p=>p.id===request.id)){profileHealth[request.id]={state:'offline',message:error.message};publish();}return { ok: false, error: error.message }; }
  });
  register('settings:server', raw => changeSettings(async () => {
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 30) throw new Error('Bitte einen Servernamen mit maximal 30 Zeichen eingeben.');
    const profile = { ssh: validateSSH(raw.ssh), type: raw.type ?? 'auto', baseUrl: normalizeOrigin(raw.baseUrl), allowHttp: raw.allowHttp === true };
    const existing = raw.id ? settings.db.profiles.find(p => p.id === raw.id) : null;
    if (raw.useStoredAuth && (!existing || existing.baseUrl !== profile.baseUrl || existing.authType !== raw.auth?.type || apiDestination(existing)!==apiDestination(profile))) throw new Error('Für eine neue Adresse oder Zugangsart bitte neue Zugangsdaten eingeben.');
    if(profile.ssh){
      if(profile.ssh.authType==='password' && raw.sshSecret)profile.ssh.credentialsRef=await sshStore.add(profile.ssh,{password:raw.sshSecret});
      else if(profile.ssh.authType!=='agent')sshStore.get(profile.ssh);
    }
    const auth = raw.useStoredAuth ? credentials.get(existing) : normalizeAuth(raw.auth); const wire=await wireProfile(profile);secureHeaders(wire, auth);
    const models = await inspectServer(wire, auth);
    if (!models.length) throw new Error('Server erreichbar, aber es sind noch keine Modelle installiert.');
    const ref = await credentials.add(profile.baseUrl, auth, apiDestination(profile));
    const oldRefs = new Set(settings.db.profiles.filter(p => apiDestination(p) === apiDestination(profile)).map(p => p.authRef).filter(Boolean));
    try { await settings.importServer({ ...profile, name: raw.name, models, authRef: ref, authType: auth.type, restoreRemoved: true }); }
    catch (error) { await credentials.remove(ref); throw error; }
    for(const p of settings.db.profiles.filter(p=>p.baseUrl===profile.baseUrl && (!profile.ssh||JSON.stringify(p.ssh)===JSON.stringify(profile.ssh))))profileHealth[p.id]={state:'online',message:'SSH/Tunnel und API geprüft',identity:connectionIdentity(p),checkedAt:Date.now()};
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
  register('chat:delete', async id => {
    if (busy || settingsBusy || updating || closing || shuttingDown) return { ok: false, error: 'Bitte den laufenden Vorgang abschließen.' };
    try {
      await store.remove(id); await jobs.removeChats([id]); await attachments.collectUnused(store.db.sessions.flatMap(s => s.messages), drafts);
      omittedRounds = 0; notice = ''; publish(); return { ok: true };
    } catch { publish(); return { ok: false, error: 'Gespräch oder ungenutzte Anhänge konnten nicht vollständig entfernt werden.' }; }
  });
  register('chat:cancel', () => { controller?.abort(); return { ok: true, notice:'KAIROS wartet nicht mehr. Der Server kann weiterrechnen; die Auftragszuordnung bleibt erhalten.' }; });
  register('chat:send', async (text, attachmentIds = [], imageOptions) => {
    if (busy || jobAction || updating || closing) return { ok: false, error: 'Bitte den laufenden Vorgang abschließen.' };
    if (settingsBusy) return { ok: false, error: 'Die Einstellungen werden gerade gespeichert.' };
    const profile = settings.active;
    if (!profile) return { ok: false, error: 'Bitte in den Einstellungen eine KI aktivieren und für den Chat auswählen.' };
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Schreib zuerst eine Nachricht.' };
    text = text.trim();
    if (!Array.isArray(attachmentIds) || attachmentIds.length > 4 || new Set(attachmentIds).size !== attachmentIds.length || attachmentIds.some(id => !drafts.has(id))) return { ok: false, error: 'Bitte gültige Anhänge auswählen (maximal vier).' };
    let context;
    try {
      for (const id of attachmentIds) { const item = attachments.get(id); if (!(item.kind === 'image' ? profile.uploads.photos : profile.uploads.files)) throw new Error('Diese Upload-Art ist für das ausgewählte Modell deaktiviert.'); }
      if (profile.type === 'comfyui') {
        if (attachmentIds.length) throw new Error('Der ComfyUI-Workflow unterstützt derzeit Text-zu-Bild. Bitte die Anhänge entfernen.');
        prepareComfyWorkflow(workflows.get(profile), text, imageOptions);
      } else if (profile.type === 'image-api') {
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
    busy=true;publish();let wire;
    try{await proveOnline(profile);wire=await wireProfile(profile)}catch(error){busy=false;publish();return {ok:false,error:error.message};}
    const active = store.active;
    const message = { id: randomUUID(), role: 'user', content: text, state: 'pending', createdAt: new Date().toISOString(), ...(attachmentIds.length ? { attachmentIds } : {}) };
    active.messages.push(message);
    if (active.title === 'Neues Gespräch') active.title = text.replace(/\s+/g, ' ').slice(0, 44);
    omittedRounds = context?.omittedRounds ?? 0; notice = ''; busy = true; controller = new AbortController(); publish();
    let attachmentsPersisted = false; let job; currentServerStop=false;
    const onSlow = detail => {imageProgress={state:"slow",message:detail}; if(job)void jobs.update(job.id,{detail}).then(publish).catch(()=>{});publish()};
    try {
      await attachments.persist(attachmentIds);
      attachmentsPersisted = true;
      attachmentIds.forEach(id => drafts.delete(id));
      await store.save();
      job=await jobs.create(profile,active.id,message.id); activeJob=job; message.jobId=job.id; await store.save(); publish();
      let reply; let generatedIds;
      if (profile.type === 'comfyui') {
        const result = await generateComfyImages(text, { signal: controller.signal, profile:wire, auth: credentials.get(profile), clientId:job.clientId, onSlow,
          onAccepted: async accepted=>{job=await jobs.update(job.id,{...accepted,state:"queued",recoverable:true});activeJob=job;publish()}, entry: workflows.get(profile), options: imageOptions,
          onProgress: progress => { imageProgress = progress; if(job && ["queued","running"].includes(progress.state))void jobs.update(job.id,{state:progress.state,detail:progress.message}).then(publish).catch(()=>{});publish(); } });
        await applyRecovered(job,result); connection={state:'online',message:'Ergebnis empfangen'};return {ok:true,submitted:true};
      } else if (profile.type === 'image-api') {
        const image = await generateImage(text, { signal: controller.signal, profile:wire, auth: credentials.get(profile), onSlow, references: attachmentIds.map(id => attachments.get(id)) });
        validateImage(image); attachments.items.set(image.id, image); await attachments.persist([image.id]); generatedIds = [image.id]; reply = 'Hier ist dein Bild.';
      } else reply = await (profile.type === 'openai-chat' ? sendOpenaiChat : sendChat)(context.messages, { signal: controller.signal, profile:wire, auth: credentials.get(profile), onSlow });
      imageProgress = null; message.state = 'complete';
      active.messages.push({ id: job.id, jobId:job.id, role: 'assistant', content: reply, model: profile.model, providerName: profile.name, state: 'complete', createdAt: new Date().toISOString(), ...(generatedIds ? { attachmentIds: generatedIds } : {}) });
      try { await store.save(); } catch { throw Error('Die Antwort ist da, aber der Verlauf konnte nicht gespeichert werden. Bitte KAIROS geöffnet lassen.'); }
      await jobs.update(job.id,{state:'completed',waiting:false,detail:'Antwort im Gespräch gespeichert.'});
      connection = { state: 'online', message: `Mit ${profile.name} verbunden` };
      return { ok: true, submitted: true };
    } catch (error) {
      if (!attachmentsPersisted) delete message.attachmentIds;
      const confirmedStop = currentServerStop || error.jobState==='cancelled' || job && jobs.get(job.id).state==='cancelled';
      message.state = confirmedStop ? 'cancelled' : error.jobState==='failed' ? 'failed' : 'unknown';
      if(job)try{await jobs.update(job.id,{state:confirmedStop?'cancelled':error.jobState??'unknown',waiting:false,detail:confirmedStop?'Serverseitiger Abbruch bestätigt.':error.message})}catch{};
      notice = error.message;
      try { await store.save(); } catch { notice += ' Der Verlauf konnte nicht gespeichert werden.'; }
      if (/nicht erreichbar/.test(error.message)) connection = { state: 'offline', message: `${profile.name} ist gerade nicht erreichbar` };
      return { ok: false, submitted: attachmentsPersisted, error: notice };
    } finally { busy = false; imageProgress = null; controller = undefined; activeJob=undefined;currentServerStop=false; publish(); }
  });

  register('chat:open-link', async value => {
    if(typeof value !== 'string' || value.length > 2048)return {ok:false};
    try {const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return {ok:false};await shell.openExternal(url.href);return {ok:true};}catch{return {ok:false};}
  });
  tts = await registerTts({register,directory:dataDir,cipher,dialog,window,publish,isLocked:()=>busy||settingsBusy||jobAction||updating||shuttingDown});
  await window.loadFile(join(root, 'ui/index.html'));
  if (!verify) await changeSettings(() => refreshServers());
  if (!verifyUpdateOnly) await check();
  if ((process.argv.includes('--show-settings') || process.argv.includes('--show-security')) && !verify) await window.webContents.executeJavaScript(`document.querySelector('#settings-button').click(); ${process.argv.includes('--show-security') ? "document.querySelector('#tab-security').click();" : ''}`);
  if (verify) {
    try {
      const verifier = verifyUpdateOnly ? (await import('./verify-update.mjs')).verifyUpdate : verifyApplication;
      const report = await verifier({ root, dataDir, window, store, settings, cipher, credentials, workflows, attachments, drafts, updates, jobs, publish, snapshot });
      console.log(JSON.stringify(report));
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  }
  }
  void start().catch(error => { if (verify || releaseTestRoot) console.error(error); else dialog.showErrorBox('KAIROS · Tresor gesperrt', 'Der verschlüsselte Speicher konnte nicht sicher geöffnet werden. Vorhandene Daten bleiben erhalten. Es wird nichts im Klartext gespeichert.'); app.exit(1); });
}
