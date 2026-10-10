const api = window.qwenChat;
const $ = selector => document.querySelector(selector);
let state; let cancelling = false; let probing = false; let draftAttachments = []; let deletion;
let appliedRepository;
let imageProfile; let trustId;
const jobLabels={queued:"Wartet",running:"Läuft",completed:"Abgeschlossen",failed:"Fehlgeschlagen",cancelled:"Serverseitig abgebrochen",missing:"Nicht mehr auffindbar",unknown:"Status unbekannt"};
const comfyFields = { prompt: 'Prompt', negativePrompt: 'Negative Prompt', width: 'Breite', height: 'Höhe', steps: 'Schritte', seed: 'Seed', cfg: 'CFG' };
const input = $('#message-input');
$('#open-source-notices').addEventListener('click',()=>void api.showLicenses());
function renderAttachments() {
  $('#attachment-list').replaceChildren(...draftAttachments.map(attachment => {
    const chip = document.createElement('div'); chip.className = 'draft-attachment';
    if (attachment.kind === 'image') { const img = document.createElement('img'); img.src = attachment.src; img.alt = attachment.name; chip.append(img); }
    const name = document.createElement('span'); name.textContent = attachment.name;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button'; remove.textContent = '×'; remove.setAttribute('aria-label', `${attachment.name} entfernen`);
    remove.disabled = Boolean(state?.busy);
    remove.addEventListener('click', async () => { const result = await api.removeAttachment(attachment.id); if (!result.ok) { error(result.error); return; } draftAttachments = draftAttachments.filter(a => a.id !== attachment.id); renderAttachments(); });
    chip.append(name, remove); return chip;
  }));
  const p = state?.settings.profiles.find(p => p.id === state.settings.activeId);
  $('#attach-file').disabled = !p || p.type === 'comfyui' || !(p.uploads?.files || p.uploads?.photos) || Boolean(state?.busy || state?.settingsBusy || draftAttachments.length >= 4);
  kairosHancockPanel.syncDraft();
}
$('#attach-file').addEventListener('click', async () => {
  $('#attach-file').disabled = true;
  try { const result = await api.attach(); if (!result.ok) error(result.error); else if (result.attachment) { draftAttachments.push(result.attachment); renderAttachments(); } }
  catch { error('Die Datei konnte nicht angehängt werden.'); }
  finally { renderAttachments(); }
});
const time = iso => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(iso));
const date = iso => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' }).format(new Date(iso));

function error(message) { $('#notice').textContent = message; $('#notice').hidden = !message; kairosHancockPanel.notice(message); }
function renderJobs() {
  $('#job-list').replaceChildren(...(state.jobs??[]).filter(j=>j.chatId===state.activeId && j.state!=='completed').map(job=>{
    const card=document.createElement('div');card.className='security-card job-card';
    const title=document.createElement('strong');title.textContent=job.providerName+' · '+jobLabels[job.state];
    const detail=document.createElement('p');detail.textContent=job.detail;
    card.append(title,detail);
    if(!job.recoverable) {const hint=document.createElement('small');hint.textContent='Kein serverseitiger Ergebnis-Wiederabruf nachgewiesen. Die lokale Auftragsnummer ist keine Server-ID.';card.append(hint)}
    else if(!job.bindingOK) {const hint=document.createElement('small');hint.textContent='Verbindung wurde geändert oder gelöscht. Kein Abruf auf einem anderen Server.';card.append(hint)}
    else {
      const check=document.createElement('button');check.className='secondary-button';check.textContent='Status prüfen / Ergebnis abrufen';check.disabled=state.busy||state.settingsBusy||state.jobAction;
      check.addEventListener('click',async()=>{const result=await api.checkJob(job.id);if(!result.ok)error(result.error)});card.append(check);
      if(job.state==='queued') {const stop=document.createElement('button');stop.className='secondary-button';stop.textContent='Wartenden Auftrag entfernen';stop.disabled=state.settingsBusy||state.jobAction;
        stop.addEventListener('click',async()=>{const result=await api.stopJob(job.id);if(!result.ok)error(result.error)});card.append(stop)}
    }
    return card;
  }));
  const pending=state.tunnels?.pending?.[0];
  if(pending){trustId=pending.id;$('#ssh-trust-host').textContent=pending.host+':'+pending.port;$('#ssh-trust-fingerprint').textContent=pending.fingerprint;if(!$('#ssh-trust-dialog').open)$('#ssh-trust-dialog').showModal()}
  else if($('#ssh-trust-dialog').open){trustId=undefined;$('#ssh-trust-dialog').close()}
}
function render(next) {
  state = next;
  if (!state.busy) cancelling = false;
  const active = state.sessions.find(s => s.id === state.activeId);
  const profile = state.settings.profiles.find(p => p.id === state.settings.activeId && p.enabled);
  const picker = $('#active-ai');
  const options = state.settings.profiles.filter(p => p.enabled).map(p => { const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; return option; });
  if (!profile) { const option = document.createElement('option'); option.value = ''; option.textContent = 'KI auswählen …'; options.unshift(option); }
  picker.replaceChildren(...options); picker.value = profile?.id ?? '';
  picker.disabled = state.busy || state.settingsBusy || options.length === 1 && !profile && !state.settings.profiles.some(p => p.enabled);
  $('#model-label').textContent = profile ? `${profile.model} · ${profile.name}` : 'Keine KI ausgewählt · Einstellungen öffnen';
  input.placeholder = profile?.type === 'comfyui' ? 'Beschreibe dein Wunschbild …' : profile ? `Nachricht an ${profile.name} …` : 'Wähle eine KI in den Einstellungen …';
  const workflow = state.workflows?.[profile?.id];
  $('#image-options').hidden = profile?.type !== 'comfyui';
  const imageSignature = JSON.stringify([profile?.id, workflow?.mapping, workflow?.options, workflow?.limits]);
  if (imageProfile !== imageSignature) {
    imageProfile = imageSignature; const rows = [];
    for (const field of Object.keys(comfyFields).filter(f => f !== 'prompt' && workflow?.mapping?.[f])) {
      const label = document.createElement('label'); label.textContent = comfyFields[field];
      const control = document.createElement('input'); control.id = 'image-' + (field === 'negativePrompt' ? 'negative' : field); control.dataset.field = field;
      control.type = field === 'negativePrompt' ? 'text' : 'number'; control.value = workflow.options[field] ?? '';
      if (field === 'negativePrompt') control.maxLength = 4000;
      else { Object.assign(control, workflow.limits[field]); control.required = true; }
      label.append(control); rows.push(label);
    }
    $('#image-fields').replaceChildren(...rows);
  }
  $('#image-options').querySelectorAll('input').forEach(field => { field.disabled = state.busy || state.settingsBusy; });
  $('#attachment-help').textContent = profile?.type === 'comfyui' ? 'ComfyUI · eigener Text-zu-Bild-Workflow' : profile?.type === 'image-api' ? 'Bilder anhängen zum Bearbeiten · Text beschreibt dein Wunschbild' : profile?.capabilities?.includes('vision') ? 'Bilder, Text und Code · dieses Modell versteht Bilder' : 'Text und Code · dieses Modell versteht keine Bilder';
  $('#attach-file').disabled = !profile || !(profile.uploads?.files || profile.uploads?.photos) || profile?.type === 'comfyui' || state.busy || state.settingsBusy || draftAttachments.length >= 4;
  $('#attachment-list').querySelectorAll('button').forEach(button => { button.disabled = state.busy; });
  $('#waiting strong').textContent = profile?.model ?? 'KI';
  $('#chat-title').textContent = active.title;
  $('#delete-chat').disabled = state.busy || state.settingsBusy;
  $('#connection-check').className = `connection ${state.connection.state}`;
  $('#connection-label').textContent = state.connection.state === 'online' ? (profile?.ssh?.enabled ? 'SSH-Tunnel · API verbunden' : profile?.baseUrl.startsWith('http:') ? 'HTTP · Heimnetz' : 'HTTPS · Verbunden') : state.connection.message;
  $('#connection-check').title = `${state.connection.message} · Klicken zum erneuten Prüfen`;
  $('#connection-check').disabled = state.connection.state === 'checking' || !profile || state.settingsBusy;
  $('#new-chat').disabled = state.busy;
  const sessions = state.sessions.map(s => {
    const button = document.createElement('button');
    button.className = `session${s.id === state.activeId ? ' active' : ''}`;
    button.disabled = state.busy;
    button.setAttribute('aria-current', s.id === state.activeId ? 'true' : 'false');
    const title = document.createElement('strong'); title.textContent = s.title;
    const meta = document.createElement('small'); meta.textContent = `${date(s.createdAt)} · ${s.messages.filter(m => m.state === 'complete').length} Nachrichten`;
    button.append(title, meta);
    button.addEventListener('click', async () => {
      try { const result = await api.select(s.id); if (result.ok) { input.value = ''; updateSend(); input.focus(); } else error(result.error); }
      catch { error('Das Gespräch konnte nicht geöffnet werden.'); }
    });
    return button;
  });
  $('#session-list').replaceChildren(...sessions);
  $('#welcome').hidden = active.messages.length > 0;
  const messages = active.messages.map(message => {
    const row = document.createElement('article'); row.className = `message ${message.role}`;
    const avatar = document.createElement('span'); avatar.className = message.role === 'assistant' ? 'avatar qwen-avatar' : 'avatar'; avatar.textContent = message.role === 'assistant' ? 'K' : 'Du';
    const main = document.createElement('div'); main.className = 'message-main';
    const header = document.createElement('div'); header.className = 'message-header';
    const author = document.createElement('strong'); author.textContent = message.role === 'assistant' ? (message.model ?? 'KI') : 'Du';
    const stamp = document.createElement('time'); stamp.textContent = time(message.createdAt); stamp.dateTime = message.createdAt;
    header.append(author, stamp);
    if(message.role==='assistant'&&message.usage){const usage=document.createElement('small');const values=[];if(message.usage.totalTokens!=null)values.push(message.usage.totalTokens+' Tokens');if(message.usage.reportedCost!=null)values.push(message.usage.reportedCost+' USD laut Anbieter');usage.textContent=values.join(' · ');header.append(usage);}
    const body = document.createElement('div'); body.className = 'message-body';
    if(message.role === 'assistant') kairosRichText.render(body, message.content);
    else body.textContent = message.content;
    main.append(header, body);
    if(message.role === 'assistant' && message.state === 'complete') {
      const speak=document.createElement('button');speak.type='button';speak.className='secondary-button';speak.textContent='♪ Im Sprachstudio öffnen';
      speak.addEventListener('click',()=>kairosTts.useText(kairosRichText.text(body)));main.append(speak);
    }
    for (const attachment of message.attachments ?? []) {
      const block = document.createElement('div'); block.className = 'chat-attachment';
      if (attachment.kind === 'image') {
        const image = document.createElement('img'); image.src = attachment.src; image.alt = attachment.name; image.loading = 'lazy'; block.append(image);
        const download = document.createElement('button'); download.type = 'button'; download.className = 'secondary-button image-download'; download.textContent = 'Bild speichern';
        download.addEventListener('click', async () => { download.disabled = true; try { const result = await api.exportImage(attachment.id); if (!result.ok) error(result.error); } catch { error('Bild konnte nicht gespeichert werden.'); } finally { download.disabled = false; } }); block.append(download);
      }
      const caption = document.createElement('span'); caption.textContent = attachment.name; block.append(caption); main.append(block);
    }
    if (message.state !== 'complete') {
      const status = document.createElement('div'); status.className = 'message-state';
      status.textContent = { pending: 'Wird beantwortet …', failed: 'Nicht beantwortet · Nachricht kann erneut gesendet werden', cancelled: 'Abbruch bestätigt bzw. Altbestand', unknown:'Ausgang unbekannt · Server kann weiterrechnen' }[message.state];
      main.append(status);
    }
    row.append(avatar, main); return row;
  });
  $('#messages').replaceChildren(...messages);
  $('#waiting').hidden = !state.busy;
  $('#waiting .thinking span').textContent = state.imageProgress?.message ?? 'Antwort wird vorbereitet …';
  error(state.notice);
  $('#context-note').hidden = !state.omittedRounds;
  $('#context-note').textContent = 'Ältere Nachrichten bleiben gespeichert. Für diese Antwort erhält das ausgewählte Modell nur den neuesten Teil des Gesprächs.';
  updateSend();
  renderSettings();
  renderUpdates();
  renderJobs();
  kairosTts.render(state);
  kairosHancockPanel.render(state);
  $('#conversation').scrollTop = $('#conversation').scrollHeight;
}
function renderUpdates() {
  const update = state.updates;
  if (appliedRepository !== update?.repository) { appliedRepository = update?.repository; $('#update-repository').value = appliedRepository ?? ''; }
  const changed = $('#update-repository').value.trim() !== appliedRepository;
  const locked = state.busy || state.settingsBusy || update?.operationBusy || update?.sourceChecking || ['checking','downloading','installing','downloaded'].includes(update?.state);
  $('#update-repository').disabled = Boolean(locked);
  $('#update-beta').checked = update?.beta === true; $('#update-beta').disabled = Boolean(locked);
  $('#update-releases').replaceChildren(...(update?.releases ?? []).map(r => { const line = document.createElement('li'); line.textContent = r.version + (r.prerelease ? ' · Pre-Release' : ' · Release') + (r.downloadable ? '' : ' · keine Windows-Updatedateien'); return line; }));
  $('#update-source-save').disabled = Boolean(locked);
  $('#update-source-save').textContent = update?.sourceChecking ? 'Repository wird geprüft …' : 'Prüfen & speichern';
  $('#update-source-reset').disabled = Boolean(locked || !changed);
  $('#update-source-status').textContent = changed ? 'Adresse geändert. Bitte zuerst prüfen und speichern.' : update?.sourceMessage ?? `Aktive Quelle: ${appliedRepository ?? 'Noch nicht eingerichtet'}`;
  $('#app-version').textContent = update?.version ?? '';
  $('#update-status').textContent = update?.message ?? 'Updates werden vorbereitet.';
  $('#update-check').disabled = !update || locked || changed || update.state === 'disabled';
  $('#update-open-release').disabled = locked || changed || update?.state !== 'available';
}
function updateSend() {
  const busy = Boolean(state?.busy);
  const profile = state?.settings.profiles.find(p => p.id === state.settings.activeId);
  $('#send-button').disabled = cancelling || (!busy && (!input.value.trim() || !state?.settings.activeId || state?.settingsBusy));
  $('#send-button').classList.toggle('cancel', busy);
  $('#send-label').textContent = busy ? (cancelling ? 'Warten wird beendet …' : 'Nicht mehr warten') : ['image-api','comfyui'].includes(profile?.type) ? 'Bild erzeugen' : 'Senden';
  $('#send-icon').textContent = busy ? '×' : '↗';
  kairosHancockPanel.syncDraft();
}
input.addEventListener('input', updateSend);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!state?.busy) $('#chat-form').requestSubmit(); }
});
$('#chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state) return;
  if (cancelling || state.settingsBusy) return;
  if (state.busy) { cancelling = true; updateSend(); await api.cancel(); return; }
  const text = input.value.trim();
  if (!text) return;
  if (!state.settings.activeId) { error('Bitte in den Einstellungen eine KI aktivieren und für den Chat auswählen.'); return; }
  input.value = ''; state.busy = true; updateSend();
  let sendError = '';
  try {
    const imageOptions = $('#image-options').hidden ? undefined : Object.fromEntries([...$('#image-fields').querySelectorAll('input')].map(c => [c.dataset.field, c.type === 'number' ? Number(c.value) : c.value]));
    const result = await api.send(text, draftAttachments.map(a => a.id), imageOptions);
    if (result.ok || result.submitted) { draftAttachments = []; renderAttachments(); }
    if (!result.ok) { sendError = result.error; if (!result.submitted && !input.value) input.value = text; }
  } catch { sendError = 'Die Nachricht konnte nicht gesendet werden.'; if (!input.value) input.value = text; }
  finally { render(await api.state()); if (sendError) error(sendError); }
});
$('#delete-chat').addEventListener('click', () => { $('#chat-delete-dialog').showModal(); });
$('#chat-delete-cancel').addEventListener('click', () => $('#chat-delete-dialog').close());
$('#chat-delete-confirm').addEventListener('click', async () => {
  const result = await api.deleteChat(state.activeId); if (result.ok) { input.value = ''; $('#chat-delete-dialog').close(); } else error(result.error);
});
$('#new-chat').addEventListener('click', async () => {
  try { const result = await api.newChat(); if (result.ok) { input.value = ''; updateSend(); input.focus(); } else error(result.error); }
  catch { error('Das neue Gespräch konnte nicht gespeichert werden.'); }
});
$('#connection-check').addEventListener('click', () => api.check().catch(() => error('Die Verbindung konnte nicht geprüft werden.')));
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.prompt; updateSend(); input.focus(); }));

function settingsFeedback(message, success = false) {
  $('#settings-feedback').textContent = message; $('#settings-feedback').hidden = !message;
  $('#settings-feedback').classList.toggle('success', success);
}
async function settingsAction(action, success = '') {
  try { const result = await action(); settingsFeedback(result.cancelled ? '' : result.ok ? result.notice || success : result.error, result.ok); return result; }
  catch { settingsFeedback('Die Einstellungen konnten nicht geändert werden.'); return { ok: false }; }
}
function renderSettings() {
  kairosProviders.render(state);
  const locked = state.busy || state.settingsBusy || state.jobAction;
  $('#vault-location').textContent = state.security?.vaultDirectory ?? '';
  $('#add-server').disabled = locked;
  $('#add-profile').disabled = locked;
  $('#refresh-servers').disabled = locked || !state.settings.profiles.length;
  $('#delete-confirm').hidden = !deletion;
  $('#delete-confirm-text').textContent = deletion ? `${deletion.wholeServer ? 'Server mit allen Modellverbindungen' : 'Modellverbindung'} „${deletion.name}“ entfernen? Deine Gespräche und die Modelle auf dem Server bleiben erhalten.` : '';
  $('#delete-confirm-yes').disabled = locked;
  $('#server-form').querySelectorAll('input,button,select,textarea').forEach(field => { field.disabled = locked; });
  $('#profile-form').querySelectorAll('input,button,select').forEach(field => { field.disabled = locked || field.id === 'probe-server' && probing; });
  $('#workflow-form').querySelectorAll('input,button,select').forEach(field => { field.disabled = locked || field.id.startsWith('limit-') && !$(`#mapping-${field.id.split('-')[1]}`)?.value; });
  const cards = state.settings.profiles.map(profile => {
    const card = document.createElement('article'); card.className = `profile-card${profile.enabled ? '' : ' disabled'}`;
    const head = document.createElement('div'); head.className = 'profile-card-head';
    const details = document.createElement('div'); details.className = 'profile-details';
    const title = document.createElement('strong'); title.textContent = profile.name;
    const model = document.createElement('span'); model.textContent = profile.model;
    const address = document.createElement('small'); address.textContent = profile.baseUrl+(profile.apiPath??'');
    const protection = document.createElement('small'); protection.className = profile.baseUrl.startsWith('http:') ? 'transport-warning' : '';
    protection.textContent = profile.ssh?.enabled ? 'SSH · verschlüsselter Tunnel · API-Ziel '+profile.ssh.targetHost+':'+profile.ssh.targetPort : `${profile.baseUrl.startsWith('https:') ? 'HTTPS · verschlüsselte Übertragung' : 'HTTP · unverschlüsselte Heimnetz-Ausnahme'} · ${profile.authType === 'none' ? 'Ohne Zugangsdaten' : 'Zugang im Tresor'}`;
    const capabilities = document.createElement('small'); capabilities.textContent = `${profile.capabilities?.length ? 'Gemeldete Fähigkeiten: ' + profile.capabilities.join(', ') : 'Fähigkeiten noch nicht abgefragt'}${profile.contextLimit ? ' · Kontextgrenze: ' + profile.contextLimit.toLocaleString('de-DE') + ' Tokens' : ''}`;
    const health=document.createElement('small');health.textContent='API: '+(state.profileHealth[profile.id]?.message??'Noch nicht geprüft');details.append(title, model, address, protection, capabilities,health);
    const tunnel=state.tunnels?.connections?.find(t=>t.profileIds.includes(profile.id));if(tunnel){const info=document.createElement('small');info.textContent='SSH: '+tunnel.ssh+' · Tunnel: '+tunnel.tunnel+' · '+tunnel.detail;details.append(info)}
    const toggleLabel = document.createElement('label'); toggleLabel.className = 'toggle-label';
    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.className = 'profile-toggle'; toggle.id = `toggle-${profile.id}`; toggle.checked = profile.enabled; toggle.disabled = locked || state.profileHealth[profile.id]?.state!=='online';
    toggle.setAttribute('aria-label', `${profile.name} in dieser App aktivieren`);
    const caption = document.createElement('span'); caption.textContent = profile.enabled ? 'Aktiviert' : 'Deaktiviert';
    toggleLabel.append(toggle, caption);
    toggle.addEventListener('change', () => settingsAction(() => api.toggleProfile(profile.id, toggle.checked), toggle.checked ? 'KI aktiviert. Du kannst sie jetzt für den Chat auswählen.' : 'KI deaktiviert.'));
    head.append(details, toggleLabel);
    const actions = document.createElement('div'); actions.className = 'profile-actions';
    const use = document.createElement('button'); use.type = 'button'; use.className = 'profile-use primary-button'; use.dataset.profile = profile.id;
    use.textContent = state.settings.activeId === profile.id ? 'Im Chat ausgewählt' : 'Im Chat nutzen';
    use.disabled = locked || !profile.enabled || state.settings.activeId === profile.id;
    use.addEventListener('click', () => settingsAction(() => api.selectProfile(profile.id), 'Auswahl gespeichert. Sie gilt ab der nächsten Nachricht.'));
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'profile-edit secondary-button'; edit.dataset.profile = profile.id; edit.textContent = 'Bearbeiten'; edit.disabled = locked;
    edit.addEventListener('click', () => editProfile(profile));
    const test = document.createElement('button'); test.type = 'button'; test.className = 'secondary-button'; test.textContent = 'Prüfen'; test.disabled = locked;
    test.addEventListener('click', async () => {
      test.disabled = true;
      const result = await settingsAction(() => api.probeServer({ id: profile.id }));
      if (result.ok) settingsFeedback((profile.type === 'comfyui' || result.models.includes(profile.model)) ? `${profile.name} ist erreichbar; das Modell ist vorhanden.` : `Server erreichbar, aber ${profile.model} wurde nicht gefunden.`, (profile.type === 'comfyui' || result.models.includes(profile.model)));
      test.disabled = false;
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'profile-remove secondary-button danger-button'; remove.dataset.profile = profile.id; remove.textContent = 'Entfernen'; remove.disabled = locked;
    remove.addEventListener('click', () => confirmDeletion(profile, false));
    if (profile.type === 'comfyui') {
      const workflow = document.createElement('button'); workflow.type = 'button'; workflow.className = 'secondary-button'; workflow.textContent = 'API-Workflow importieren'; workflow.disabled = locked;
      workflow.addEventListener('click', async () => { const result = await settingsAction(() => api.importWorkflow(profile.id)); if (result.ok && !result.cancelled) { render(await api.state()); editWorkflow(profile); } });
      const duplicate = document.createElement('button'); duplicate.type = 'button'; duplicate.className = 'secondary-button'; duplicate.textContent = 'Weiteres Bild-Profil'; duplicate.disabled = locked;
      duplicate.addEventListener('click', () => settingsAction(() => api.duplicateWorkflowProfile(profile.id)));
      actions.append(workflow, duplicate);
      const note = document.createElement('p'); note.className = 'settings-hint';
      const imported = state.workflows?.[profile.id];
      note.textContent = `ComfyUI-Bild-Backend · ${profile.serverInfo?.ggufAvailable ? 'GGUF-Knoten erkannt' : 'GGUF-Knoten nicht gemeldet'} · ${profile.serverInfo?.modelFiles?.length ?? 0} Modelldateien gemeldet. ${imported ? `Workflow: ${imported.name} (${imported.nodeCount} Knoten). ${imported.ready ? 'Zuordnung gespeichert.' : 'Bitte Eingänge zuordnen.'}` : 'Noch kein API-Workflow importiert.'}`;
      const configure = document.createElement('button'); configure.type = 'button'; configure.className = 'secondary-button workflow-configure'; configure.dataset.profile = profile.id; configure.textContent = 'Workflow zuordnen'; configure.disabled = locked || !imported; configure.addEventListener('click', () => editWorkflow(profile)); actions.append(configure);
      details.append(note); test.disabled = locked;
      toggle.disabled = locked || !imported?.ready || state.profileHealth[profile.id]?.state!=='online';
    }
    actions.append(use, edit, test, remove); card.append(head, actions); return card;
  });
  const serverIdentity = p => JSON.stringify([p.ssh?.enabled ? [p.ssh.host,p.ssh.port,p.ssh.username,p.ssh.targetHost,p.ssh.targetPort,p.ssh.targetTls] : p.baseUrl,p.provider??'custom',p.apiPath??'/v1']);
  const grouped = []; const origins = new Set();
  state.settings.profiles.forEach((profile, index) => {
    if (!origins.has(serverIdentity(profile))) {
      origins.add(serverIdentity(profile));
      const header = document.createElement('div'); header.className = 'server-group-heading';
      const name = document.createElement('strong'); name.textContent = profile.baseUrl+(profile.apiPath??'');
      const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'secondary-button'; refresh.textContent = 'Modelle & Zugang aktualisieren'; refresh.disabled = locked;
      refresh.textContent = 'Modelle laden';
      refresh.addEventListener('click', () => settingsAction(() => api.refreshServer(profile.id), 'Modellliste aktualisiert. Neue Modelle kannst du jetzt aktivieren.'));
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary-button'; edit.textContent = 'Zugang bearbeiten'; edit.disabled = locked; edit.addEventListener('click', () => editServer(profile));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'server-remove secondary-button danger-button'; remove.dataset.profile = profile.id; remove.textContent = 'Server löschen'; remove.disabled = locked; remove.addEventListener('click', () => confirmDeletion(profile, true));
      const actions = document.createElement('div'); actions.className = 'server-actions'; actions.append(refresh, edit, remove);
      header.append(name, actions); grouped.push(header);
      state.settings.profiles.forEach((p, i) => { if (serverIdentity(p) === serverIdentity(profile)) grouped.push(cards[i]); });
    }
  });
  $('#profile-list').replaceChildren(...grouped);
}
function confirmDeletion(profile, wholeServer) {
  deletion = { id: profile.id, name: wholeServer ? profile.baseUrl : profile.name, wholeServer };
  renderSettings(); $('#delete-confirm').scrollIntoView({ block: 'nearest' }); $('#delete-confirm-cancel').focus();
}
function editWorkflow(profile) {
  const workflow = state.workflows?.[profile.id]; if (!workflow) return;
  $('#workflow-profile').value = profile.id; $('#workflow-name').textContent = workflow.name;
  const rows = Object.entries(comfyFields).map(([field, name]) => {
    const label = document.createElement('label'); label.textContent = name; label.htmlFor = `mapping-${field}`;
    const select = document.createElement('select'); select.id = `mapping-${field}`; select.required = field === 'prompt';
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = field === 'prompt' ? 'Eingang auswählen …' : 'Nicht unterstützt / nicht anzeigen'; select.append(empty);
    for (const target of workflow.editableInputs.filter(t => t.type === (['prompt','negativePrompt'].includes(field) ? 'string' : 'number'))) {
      const option = document.createElement('option'); option.value = JSON.stringify({ nodeId: target.nodeId, input: target.input }); option.textContent = target.label; select.append(option);
    }
    select.value = workflow.mapping?.[field] ? JSON.stringify(workflow.mapping[field]) : ''; const row = document.createElement('div'); row.append(label, select);
    if (!['prompt','negativePrompt'].includes(field)) {
      const limit = workflow.limits[field];
      for (const [key, caption] of Object.entries({ default: 'Standard', min: 'Minimum', max: 'Maximum', step: 'Schrittmaß' })) {
        const wrapper = document.createElement('label'); wrapper.textContent = caption;
        const control = document.createElement('input'); control.type = 'number'; control.step = 'any'; control.id = 'limit-' + field + '-' + key;
        control.value = key === 'default' ? workflow.options[field] ?? {width:1024,height:1024,steps:20,seed:-1,cfg:7}[field] : limit[key];
        control.disabled = !select.value; wrapper.append(control); row.append(wrapper);
      }
      select.addEventListener('change', () => row.querySelectorAll('input').forEach(c => { c.disabled = !select.value; }));
    }
    return row;
  });
  $('#workflow-mappings').replaceChildren(...rows); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Ausgabe auswählen …'; $('#workflow-output').replaceChildren(empty);
  for (const node of workflow.outputNodes) { const option = document.createElement('option'); option.value = node.id; option.textContent = node.label; $('#workflow-output').append(option); }
  $('#workflow-output').value = workflow.mapping?.outputNode ?? ''; $('#workflow-form').hidden = false; $('#workflow-form').scrollIntoView({ block: 'nearest' });
}
$('#workflow-form-close').addEventListener('click', () => { $('#workflow-form').hidden = true; });
$('#workflow-form').addEventListener('submit', async event => {
  event.preventDefault(); const id = $('#workflow-profile').value; const profile = state.settings.profiles.find(p => p.id === id); if (!profile) return;
  const mapping = Object.fromEntries(Object.keys(comfyFields).map(field => [field, $(`#mapping-${field}`).value ? JSON.parse($(`#mapping-${field}`).value) : null])); mapping.outputNode = $('#workflow-output').value;
  const options = { negativePrompt: '' }; const limits = {};
  for (const field of ['width','height','steps','seed','cfg']) if (mapping[field]) { options[field] = Number($(`#limit-${field}-default`).value); limits[field] = Object.fromEntries(['min','max','step'].map(k => [k, Number($(`#limit-${field}-${k}`).value)])); }
  const result = await settingsAction(() => api.configureWorkflow(id, mapping, options, limits));
  if (result.ok) { $('#workflow-form').hidden = true; imageProfile = undefined; render(await api.state()); }
});
$('#delete-confirm-cancel').addEventListener('click', () => { deletion = undefined; renderSettings(); });
$('#delete-confirm-yes').addEventListener('click', async () => {
  const target = deletion; if (!target || state.busy || state.settingsBusy) return;
  const result = await settingsAction(() => api.removeProfile(target.id, target.wholeServer), 'Verbindung entfernt. Deine Gespräche bleiben erhalten.');
  if (result.ok) { deletion = undefined; clearServerSecret(); $('#server-form').hidden = true; $('#profile-form').hidden = true; renderSettings(); }
});
$('#refresh-servers').addEventListener('click', () => settingsAction(() => api.refreshServer(), 'Gespeicherte Server geprüft. Neue Modelle kannst du jetzt aktivieren.'));
function editProfile(profile) {
  $('#profile-form').hidden = false;
  $('#profile-form-title').textContent = profile ? 'Verbindung bearbeiten' : 'Neue Ollama-Verbindung';
  $('#profile-id').value = profile?.id ?? '';
  $('#profile-type').value = profile?.type ?? 'ollama';
  $('#profile-name').value = profile?.name ?? '';
  $('#profile-url').value = profile?.baseUrl ?? '';
  $('#profile-provider').value=profile?.provider??'custom';$('#profile-api-path').value=profile?.apiPath??'/v1';profileEndpointFields();
  $('#profile-model').value = profile?.model ?? '';
  $('#profile-enabled').checked = profile?.enabled ?? true;
  $('#profile-http').checked = profile?.allowHttp ?? false;
  $('#profile-files').checked = profile?.uploads?.files ?? true; $('#profile-photos').checked = profile?.uploads?.photos ?? true;
  $('#profile-temperature').value = profile?.options?.temperature ?? 0.7;
  $('#profile-context').value = profile?.options?.num_ctx ?? 8192;
  $('#profile-context').max = Math.min(profile?.contextLimit ?? 32768, 32768);
  $('#profile-output').value = profile?.options?.num_predict ?? 2048;
  $('#model-options').replaceChildren(); $('#probe-feedback').textContent = '';
  settingsFeedback(''); $('#profile-name').focus();
  $('#profile-form').scrollIntoView({ block: 'nearest' });
}
function clearServerSecret() { $('#ssh-secret').value=''; $('#ssh-passphrase').value=''; $('#server-secret').value = ''; $('#server-user').value = ''; }
function authFields() {
  const auth = $('#server-auth').value;
  $('#server-user-field').hidden = auth !== 'basic'; $('#server-secret-field').hidden = auth === 'none';
  $('#server-secret-label').textContent = auth === 'basic' ? 'Passwort' : 'API-Schlüssel';
}
function editServer(profile) {
  clearServerSecret(); $('#server-form').hidden = false; $('#profile-form').hidden = true;
  $('#server-id').value = profile?.id ?? ''; $('#server-name').value = profile ? profile.name.split(' · ')[0].slice(0, 30) : '';
  $('#server-model-names').value='';
  $('#server-type').value = profile?.type ?? 'auto';
  $('#server-url').value = profile?.baseUrl ?? ''; $('#server-auth').value = profile?.authType ?? 'none';
  $('#server-provider').value=profile?.provider??'custom';$('#server-api-path').value=profile?.apiPath??'/v1';serverEndpointFields(false);
  $('#server-http').checked = profile?.allowHttp ?? false; $('#server-feedback').textContent = '';
  const ssh=profile?.ssh;$('#ssh-enabled').checked=!!ssh?.enabled;$('#ssh-host').value=ssh?.host??'192.168.0.175';$('#ssh-port').value=ssh?.port??22;$('#ssh-user').value=ssh?.username??'hancock';$('#ssh-target').value=ssh?.targetHost??'127.0.0.1';$('#ssh-target-port').value=ssh?.targetPort??8000;$('#ssh-local-port').value=ssh?.localPort??18000;$('#ssh-auth').value=ssh?.authType??'agent';$('#ssh-key-ref').value=ssh?.credentialsRef??'';$('#ssh-target-tls').checked=ssh?.targetTls??false;sshFields();
  authFields(); $('#server-name').focus(); $('#server-form').scrollIntoView({ block: 'nearest' });
}
function serverEndpointFields(applyPreset) {
  const compatible=$('#server-type').value==='openai-chat';$('#server-provider-fields').hidden=!compatible;
  const preset=compatible?kairosProviders.preset($('#server-provider').value):null;
  $('#server-url').readOnly=$('#server-api-path').readOnly=Boolean(preset);
  if(applyPreset && preset){clearServerSecret();$('#server-url').value=preset.baseUrl;$('#server-api-path').value=preset.apiPath;$('#server-name').value=preset.name;$('#server-auth').value='bearer';$('#server-http').checked=false;$('#ssh-enabled').checked=false;sshFields();authFields();}
}
function profileEndpointFields() {
  const compatible=$('#profile-type').value==='openai-chat';$('#profile-api-fields').hidden=!compatible;
  const provider=$('#profile-provider').value;$('#profile-provider-name').textContent=provider==='custom'?'Eigener kompatibler Anschluss':kairosProviders.preset(provider)?.name??provider;
  $('#profile-url').readOnly=$('#profile-api-path').readOnly=compatible&&provider!=='custom';
}
$('#server-provider').addEventListener('change',()=>{clearServerSecret();serverEndpointFields(true);});
$('#profile-type').addEventListener('change',profileEndpointFields);
function settingsTab(tab) {
  for (const name of ['local', 'tts-settings', 'security', 'litellm', 'updates']) { $(`#${name}-panel`).hidden = tab !== name; $(`#tab-${name}`).classList.toggle('selected', tab === name); }
  clearServerSecret();
  settingsFeedback('');
  $('#settings-dialog').scrollTop = 0;
}
$('#settings-button').addEventListener('click', () => { settingsTab('local'); if (!$('#settings-dialog').open) $('#settings-dialog').showModal(); });
$('#settings-close').addEventListener('click', () => $('#settings-dialog').close());
$('#settings-dialog').addEventListener('close', () => { clearServerSecret(); deletion = undefined; });
let backdropPointer = false;
const outsideDialog = event => { const box = $('#settings-dialog').getBoundingClientRect(); return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom; };
$('#settings-dialog').addEventListener('pointerdown', event => { backdropPointer = event.target === $('#settings-dialog') && outsideDialog(event); });
$('#settings-dialog').addEventListener('click', event => {
  if (backdropPointer && event.target === $('#settings-dialog') && outsideDialog(event)) $('#settings-dialog').close();
  backdropPointer = false;
});
$('#tab-local').addEventListener('click', () => settingsTab('local'));
$('#tab-tts-settings').addEventListener('click', () => settingsTab('tts-settings'));
$('#tab-security').addEventListener('click', () => settingsTab('security'));
$('#tab-litellm').addEventListener('click', () => settingsTab('litellm'));
$('#tab-updates').addEventListener('click', () => settingsTab('updates'));
$('#update-repository').addEventListener('input', () => { $('#update-source-feedback').textContent = ''; renderUpdates(); });
$('#update-source-reset').addEventListener('click', () => { $('#update-repository').value = appliedRepository ?? ''; $('#update-source-feedback').textContent = ''; renderUpdates(); });
$('#update-source-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await api.saveUpdateRepository($('#update-repository').value);
    $('#update-source-feedback').textContent = result.ok ? '' : result.error ?? 'Repository konnte nicht gespeichert werden.';
  } catch { $('#update-source-feedback').textContent = 'Repository konnte nicht gespeichert werden.'; }
  renderUpdates();
});
$('#update-beta').addEventListener('change', () => settingsAction(() => api.setBetaUpdates($('#update-beta').checked), 'Updatekanal gespeichert. Bitte erneut prüfen.'));
$('#update-check').addEventListener('click', () => settingsAction(() => api.checkUpdates()));
$('#update-open-release').addEventListener('click', () => settingsAction(() => api.openUpdateRelease()));
$('#add-server').addEventListener('click', () => editServer(null));
$('#server-form-close').addEventListener('click', () => { clearServerSecret(); $('#server-form').hidden = true; });
$('#server-auth').addEventListener('change', () => { clearServerSecret(); authFields(); });
$('#server-type').addEventListener('change', () => {
  serverEndpointFields(false);
  if ($('#server-type').value === 'comfyui' && !$('#server-url').value) {
    $('#server-url').value = 'http://192.168.0.175:8188';
  }
});
$('#server-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy || state.settingsBusy) return;
  const type = $('#server-auth').value;
  const request = {
    type: $('#server-type').value,
    ...($('#server-type').value==='openai-chat'?{provider:$('#server-provider').value,apiPath:$('#server-api-path').value}:{}),
    ...($('#server-model-names').value.trim()?{modelNames:$('#server-model-names').value.trim().split(/\r?\n/).map(n=>n.trim()).filter(Boolean)}:{}),
    id: $('#server-id').value || undefined, name: $('#server-name').value, baseUrl: $('#server-url').value, allowHttp: $('#server-http').checked,
    auth: { type, token: $('#server-secret').value, username: $('#server-user').value, password: $('#server-secret').value },
    ssh: sshConfig(), sshSecret: $('#ssh-secret').value,
    useStoredAuth: Boolean($('#server-id').value && type !== 'none' && !$('#server-secret').value),
  };
  clearServerSecret(); $('#server-feedback').textContent = 'Server und Modelle werden geprüft …';
  const result = await settingsAction(() => api.addServer(request), 'Server geprüft. Die Modelle werden automatisch aufgelistet. Neue Modelle kannst du jetzt aktivieren.');
  // Drop credential references held by this form after IPC has completed.
  request.sshSecret='';
  request.auth.token = ''; request.auth.password = ''; request.auth.username = '';
  $('#server-feedback').textContent = result.ok ? '' : result.error ?? 'Prüfung fehlgeschlagen.';
  if (result.ok) $('#server-form').hidden = true;
});
$('#add-profile').addEventListener('click', () => editProfile(null));
$('#profile-form-close').addEventListener('click', () => { $('#profile-form').hidden = true; });
$('#active-ai').addEventListener('change', () => { if ($('#active-ai').value) void settingsAction(() => api.selectProfile($('#active-ai').value), 'KI ausgewählt.'); });
$('#probe-server').addEventListener('click', async () => {
  if (probing) return;
  probing = true; const address = $('#profile-url').value; $('#probe-server').disabled = true; $('#probe-feedback').textContent = 'Verbindung wird geprüft …';
  try {
    const original = state.settings.profiles.find(p => p.id === $('#profile-id').value);
    const result = await api.probeServer(original?.baseUrl === address && original.type === $('#profile-type').value && (original.apiPath??'/v1')===$('#profile-api-path').value ? { id: original.id } : { type: $('#profile-type').value, baseUrl: address, allowHttp: $('#profile-http').checked,provider:$('#profile-provider').value,apiPath:$('#profile-api-path').value });
    if ($('#profile-url').value !== address) return;
    $('#model-options').replaceChildren();
    if (!result.ok) { $('#probe-feedback').textContent = result.error; return; }
    result.models.forEach(name => { const option = document.createElement('option'); option.value = name; $('#model-options').append(option); });
    $('#probe-feedback').textContent = result.models.length ? `${result.models.length} Modelle gefunden: ${result.models.slice(0, 6).join(' · ')}${result.models.length > 6 ? ' …' : ''}` : 'Verbindung erfolgreich. Auf dem Server sind noch keine Modelle installiert.';
    if (!$('#profile-model').value && result.models.length === 1) $('#profile-model').value = result.models[0];
  } catch { $('#probe-feedback').textContent = 'Die Verbindung konnte nicht geprüft werden.'; }
  finally { probing = false; $('#probe-server').disabled = Boolean(state.busy || state.settingsBusy); }
});
$('#profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = await settingsAction(() => api.saveProfile({
    id: $('#profile-id').value || undefined, name: $('#profile-name').value,
    type: $('#profile-type').value,
    ...($('#profile-type').value==='openai-chat'?{provider:$('#profile-provider').value,apiPath:$('#profile-api-path').value}:{}),
    baseUrl: $('#profile-url').value, model: $('#profile-model').value, enabled: $('#profile-enabled').checked,
    uploads: { files: $('#profile-files').checked, photos: $('#profile-photos').checked }, allowHttp: $('#profile-http').checked, options: { temperature: Number($('#profile-temperature').value), num_ctx: Number($('#profile-context').value), num_predict: Number($('#profile-output').value) },
  }), 'Verbindung gespeichert.');
  if (result.ok) $('#profile-form').hidden = true;
});
function sshConfig(){return $('#ssh-enabled').checked?{enabled:true,host:$('#ssh-host').value,port:Number($('#ssh-port').value),username:$('#ssh-user').value,targetHost:$('#ssh-target').value,targetPort:Number($('#ssh-target-port').value),localPort:Number($('#ssh-local-port').value),authType:$('#ssh-auth').value,credentialsRef:$('#ssh-key-ref').value||null,targetTls:$('#ssh-target-tls').checked}:null}
function sshFields(){const enabled=$('#ssh-enabled').checked;$('#ssh-fields').hidden=!enabled;$('#ssh-key-import').hidden=$('#ssh-auth').value!=='key';$('#ssh-passphrase-label').hidden=$('#ssh-auth').value!=='key';$('#ssh-secret-label').hidden=$('#ssh-auth').value!=='password';if(enabled&&!$('#server-url').value)$('#server-url').value='http://127.0.0.1:18000';}
$('#ssh-enabled').addEventListener('change',sshFields);$('#ssh-auth').addEventListener('change',()=>{$('#ssh-secret').value='';$('#ssh-key-ref').value='';sshFields()});
$('#ssh-key-import').addEventListener('click',async()=>{const config=sshConfig();const result=await settingsAction(()=>api.importSSHKey({...config,passphrase:$('#ssh-passphrase').value}));$('#ssh-passphrase').value='';if(result.ok&&result.credentialsRef)$('#ssh-key-ref').value=result.credentialsRef});
$('#ssh-trust-yes').addEventListener('click',async()=>{const id=trustId;if(id){const r=await api.trustSSHHost(id,true);if(!r.ok)settingsFeedback(r.error)}});
$('#ssh-trust-no').addEventListener('click',()=>{if(trustId)void api.trustSSHHost(trustId,false)});
$('#ssh-trust-dialog').addEventListener('cancel',event=>{event.preventDefault();if(trustId)void api.trustSSHHost(trustId,false)});
kairosProviders.init({
  openLink:url=>api.openLink(url),checkQuota:id=>settingsAction(()=>api.checkProviderQuota(id)),
  setup:id=>{editServer(null);$('#server-type').value='openai-chat';$('#server-provider').value=id;serverEndpointFields(true);$('#server-form').scrollIntoView({block:'nearest'});},
});
kairosHancockPanel.init({
  getDraft: () => input.value,
  setDraft: value => { input.value = value; updateSend(); },
  isCancelling: () => cancelling,
  submit: () => $('#chat-form').requestSubmit(),
  attach: () => $('#attach-file').click(),
  drop: async files => {
    for (const file of files) {
      if ($('#attach-file').disabled) {error('Anhänge sind hier gerade nicht möglich oder die Grenze von vier Dateien ist erreicht.');break;}
      try {
        const result = await api.dropAttachment(file);
        if (!result.ok) {error(result.error);break;}
        draftAttachments.push(result.attachment);renderAttachments();
      } catch {error('Die Datei konnte nicht angehängt werden.');break;}
    }
  },
  attachDisabled: () => $('#attach-file').disabled,
  attachmentNames: () => draftAttachments.map(a => a.name),
  selectProfile: id => api.selectProfile(id),
  selectChat: id => api.select(id),
  newChat: () => api.newChat(),
  savePreferences: value => api.saveHancock(value),
  showChat: async id => {
    if (id) {
      try {const result=await api.select(id);if(!result.ok){error(result.error);return;}}
      catch {error('Das Ergebnisgespräch konnte nicht geöffnet werden.');return;}
    }
    $('#chat-tab').click(); input.focus();
  },
  showJobs: () => $('#job-list').scrollIntoView({block:'nearest'}),
  showTts: () => $('#tts-toggle').click(),
});
api.onState(render);
api.state().then(render).catch(() => error('Das Programm konnte nicht initialisiert werden.'));
