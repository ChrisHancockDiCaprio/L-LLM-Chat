const api = window.qwenChat;
const $ = selector => document.querySelector(selector);
let state; let cancelling = false; let probing = false; let draftAttachments = []; let deletion;
const input = $('#message-input');
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
  $('#attach-file').disabled = Boolean(state?.busy || state?.settingsBusy || draftAttachments.length >= 4);
}
$('#attach-file').addEventListener('click', async () => {
  $('#attach-file').disabled = true;
  try { const result = await api.attach(); if (!result.ok) error(result.error); else if (result.attachment) { draftAttachments.push(result.attachment); renderAttachments(); } }
  catch { error('Die Datei konnte nicht angehängt werden.'); }
  finally { renderAttachments(); }
});
const time = iso => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(iso));
const date = iso => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' }).format(new Date(iso));

function error(message) { $('#notice').textContent = message; $('#notice').hidden = !message; }
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
  input.placeholder = profile ? `Nachricht an ${profile.name} …` : 'Wähle eine KI in den Einstellungen …';
  $('#attachment-help').textContent = profile?.type === 'image-api' ? 'Bilder anhängen zum Bearbeiten · Text beschreibt dein Wunschbild' : profile?.capabilities?.includes('vision') ? 'Bilder, Text und Code · dieses Modell versteht Bilder' : 'Text und Code · dieses Modell versteht keine Bilder';
  $('#attach-file').disabled = state.busy || state.settingsBusy || draftAttachments.length >= 4;
  $('#attachment-list').querySelectorAll('button').forEach(button => { button.disabled = state.busy; });
  $('#waiting strong').textContent = profile?.model ?? 'KI';
  $('#chat-title').textContent = active.title;
  $('#connection-check').className = `connection ${state.connection.state}`;
  $('#connection-label').textContent = state.connection.state === 'online' ? (profile?.baseUrl.startsWith('http:') ? 'HTTP · Heimnetz' : 'HTTPS · Verbunden') : state.connection.message;
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
    const avatar = document.createElement('span'); avatar.className = message.role === 'assistant' ? 'avatar qwen-avatar' : 'avatar'; avatar.textContent = message.role === 'assistant' ? 'q' : 'Du';
    const main = document.createElement('div'); main.className = 'message-main';
    const header = document.createElement('div'); header.className = 'message-header';
    const author = document.createElement('strong'); author.textContent = message.role === 'assistant' ? (message.model ?? 'Qwen') : 'Du';
    const stamp = document.createElement('time'); stamp.textContent = time(message.createdAt); stamp.dateTime = message.createdAt;
    header.append(author, stamp);
    const body = document.createElement('div'); body.className = 'message-body'; body.textContent = message.content;
    main.append(header, body);
    for (const attachment of message.attachments ?? []) {
      const block = document.createElement('div'); block.className = 'chat-attachment';
      if (attachment.kind === 'image') { const image = document.createElement('img'); image.src = attachment.src; image.alt = attachment.name; image.loading = 'lazy'; block.append(image); }
      const caption = document.createElement('span'); caption.textContent = attachment.name; block.append(caption); main.append(block);
    }
    if (message.state !== 'complete') {
      const status = document.createElement('div'); status.className = 'message-state';
      status.textContent = { pending: 'Wird beantwortet …', failed: 'Nicht beantwortet · Nachricht kann erneut gesendet werden', cancelled: 'Anfrage abgebrochen' }[message.state];
      main.append(status);
    }
    row.append(avatar, main); return row;
  });
  $('#messages').replaceChildren(...messages);
  $('#waiting').hidden = !state.busy;
  error(state.notice);
  $('#context-note').hidden = !state.omittedRounds;
  $('#context-note').textContent = 'Ältere Nachrichten bleiben gespeichert. Für diese Antwort erhält Qwen nur den neuesten Teil des Gesprächs.';
  updateSend();
  renderSettings();
  const update = state.updates;
  $('#app-version').textContent = update?.version ?? '';
  $('#update-status').textContent = update?.message ?? 'Updates werden vorbereitet.';
  $('#update-progress').value = update?.progress ?? 0;
  $('#update-progress').hidden = update?.state !== 'downloading';
  $('#update-check').disabled = !update || ['disabled','checking','downloading','installing','downloaded'].includes(update.state);
  $('#update-download').disabled = update?.state !== 'available';
  $('#update-install').disabled = update?.state !== 'downloaded' || !update.installAllowed || state.busy || state.settingsBusy || Boolean(input.value.trim());
  $('#conversation').scrollTop = $('#conversation').scrollHeight;
}
function updateSend() {
  const busy = Boolean(state?.busy);
  const profile = state?.settings.profiles.find(p => p.id === state.settings.activeId);
  $('#send-button').disabled = cancelling || (!busy && (!input.value.trim() || !state?.settings.activeId || state?.settingsBusy));
  $('#send-button').classList.toggle('cancel', busy);
  $('#send-label').textContent = busy ? (cancelling ? 'Abbrechen …' : 'Abbrechen') : profile?.type === 'image-api' ? 'Bild erzeugen' : 'Senden';
  $('#send-icon').textContent = busy ? '×' : '↗';
}
input.addEventListener('input', updateSend);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!state?.busy) $('#chat-form').requestSubmit(); }
});
$('#chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state) return;
  if (state.busy) { cancelling = true; updateSend(); await api.cancel(); return; }
  const text = input.value.trim();
  if (!text) return;
  if (!state.settings.activeId) { error('Bitte in den Einstellungen eine KI aktivieren und für den Chat auswählen.'); return; }
  input.value = ''; state.busy = true; updateSend();
  let sendError = '';
  try {
    const result = await api.send(text, draftAttachments.map(a => a.id));
    if (result.ok || result.submitted) { draftAttachments = []; renderAttachments(); }
    if (!result.ok) { sendError = result.error; if (!input.value) input.value = text; }
  } catch { sendError = 'Die Nachricht konnte nicht gesendet werden.'; if (!input.value) input.value = text; }
  finally { render(await api.state()); if (sendError) error(sendError); input.focus(); }
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
  const locked = state.busy || state.settingsBusy;
  $('#vault-location').textContent = state.security?.vaultDirectory ?? '';
  $('#add-server').disabled = locked;
  $('#add-profile').disabled = locked;
  $('#refresh-servers').disabled = locked || !state.settings.profiles.length;
  $('#delete-confirm').hidden = !deletion;
  $('#delete-confirm-text').textContent = deletion ? `${deletion.wholeServer ? 'Server mit allen Modellverbindungen' : 'Modellverbindung'} „${deletion.name}“ entfernen? Deine Gespräche und die Modelle auf dem Server bleiben erhalten.` : '';
  $('#delete-confirm-yes').disabled = locked;
  $('#server-form').querySelectorAll('input,button,select').forEach(field => { field.disabled = locked; });
  $('#profile-form').querySelectorAll('input,button,select').forEach(field => { field.disabled = locked || field.id === 'probe-server' && probing; });
  const cards = state.settings.profiles.map(profile => {
    const card = document.createElement('article'); card.className = `profile-card${profile.enabled ? '' : ' disabled'}`;
    const head = document.createElement('div'); head.className = 'profile-card-head';
    const details = document.createElement('div'); details.className = 'profile-details';
    const title = document.createElement('strong'); title.textContent = profile.name;
    const model = document.createElement('span'); model.textContent = profile.model;
    const address = document.createElement('small'); address.textContent = profile.baseUrl;
    const protection = document.createElement('small'); protection.className = profile.baseUrl.startsWith('http:') ? 'transport-warning' : '';
    protection.textContent = `${profile.baseUrl.startsWith('https:') ? 'HTTPS · verschlüsselte Übertragung' : 'HTTP · unverschlüsselte Heimnetz-Ausnahme'} · ${profile.authType === 'none' ? 'Ohne Zugangsdaten' : 'Zugang im Tresor'}`;
    const capabilities = document.createElement('small'); capabilities.textContent = `${profile.capabilities?.length ? 'Gemeldete Fähigkeiten: ' + profile.capabilities.join(', ') : 'Fähigkeiten noch nicht abgefragt'}${profile.contextLimit ? ' · Kontextgrenze: ' + profile.contextLimit.toLocaleString('de-DE') + ' Tokens' : ''}`;
    details.append(title, model, address, protection, capabilities);
    const toggleLabel = document.createElement('label'); toggleLabel.className = 'toggle-label';
    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.className = 'profile-toggle'; toggle.id = `toggle-${profile.id}`; toggle.checked = profile.enabled; toggle.disabled = locked;
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
    const test = document.createElement('button'); test.type = 'button'; test.className = 'secondary-button'; test.textContent = 'Prüfen'; test.disabled = locked || !profile.enabled;
    test.addEventListener('click', async () => {
      test.disabled = true;
      const result = await settingsAction(() => api.probeServer({ id: profile.id }));
      if (result.ok) settingsFeedback(result.models.includes(profile.model) ? `${profile.name} ist erreichbar; das Modell ist vorhanden.` : `Server erreichbar, aber ${profile.model} wurde nicht gefunden.`, result.models.includes(profile.model));
      test.disabled = false;
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'profile-remove secondary-button danger-button'; remove.dataset.profile = profile.id; remove.textContent = 'Entfernen'; remove.disabled = locked;
    remove.addEventListener('click', () => confirmDeletion(profile, false));
    if (profile.type === 'comfyui') {
      const workflow = document.createElement('button'); workflow.type = 'button'; workflow.className = 'secondary-button'; workflow.textContent = 'API-Workflow importieren'; workflow.disabled = locked;
      workflow.addEventListener('click', () => settingsAction(() => api.importWorkflow(profile.id), 'Workflow verschlüsselt importiert. Die Bildausführung wird anschließend eingerichtet.'));
      actions.append(workflow);
      const note = document.createElement('p'); note.className = 'settings-hint';
      const imported = state.workflows?.[profile.baseUrl];
      note.textContent = `ComfyUI vorbereitet · ${profile.serverInfo?.ggufAvailable ? 'GGUF-Knoten erkannt' : 'GGUF-Knoten nicht gemeldet'} · ${profile.serverInfo?.modelFiles?.length ?? 0} Modelldateien gemeldet. ${imported ? `Workflow: ${imported.name} (${imported.nodeCount} Knoten).` : 'Noch kein API-Workflow importiert.'} Prompt-Zuordnung und Bildlauf folgen.`;
      details.append(note); use.disabled = true; test.disabled = locked;
      toggle.disabled = true;
    }
    actions.append(use, edit, test, remove); card.append(head, actions); return card;
  });
  const grouped = []; const origins = new Set();
  state.settings.profiles.forEach((profile, index) => {
    if (!origins.has(profile.baseUrl)) {
      origins.add(profile.baseUrl);
      const header = document.createElement('div'); header.className = 'server-group-heading';
      const name = document.createElement('strong'); name.textContent = profile.baseUrl;
      const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'secondary-button'; refresh.textContent = 'Modelle & Zugang aktualisieren'; refresh.disabled = locked;
      refresh.textContent = 'Modelle laden';
      refresh.addEventListener('click', () => settingsAction(() => api.refreshServer(profile.id), 'Modellliste aktualisiert. Neue Modelle kannst du jetzt aktivieren.'));
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary-button'; edit.textContent = 'Zugang bearbeiten'; edit.disabled = locked; edit.addEventListener('click', () => editServer(profile));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'server-remove secondary-button danger-button'; remove.dataset.profile = profile.id; remove.textContent = 'Server löschen'; remove.disabled = locked; remove.addEventListener('click', () => confirmDeletion(profile, true));
      const actions = document.createElement('div'); actions.className = 'server-actions'; actions.append(refresh, edit, remove);
      header.append(name, actions); grouped.push(header);
      state.settings.profiles.forEach((p, i) => { if (p.baseUrl === profile.baseUrl) grouped.push(cards[i]); });
    }
  });
  $('#profile-list').replaceChildren(...grouped);
}
function confirmDeletion(profile, wholeServer) {
  deletion = { id: profile.id, name: wholeServer ? profile.baseUrl : profile.name, wholeServer };
  renderSettings(); $('#delete-confirm').scrollIntoView({ block: 'nearest' }); $('#delete-confirm-cancel').focus();
}
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
  $('#profile-model').value = profile?.model ?? '';
  $('#profile-enabled').checked = profile?.enabled ?? true;
  $('#profile-http').checked = profile?.allowHttp ?? false;
  $('#profile-temperature').value = profile?.options?.temperature ?? 0.7;
  $('#profile-context').value = profile?.options?.num_ctx ?? 8192;
  $('#profile-context').max = Math.min(profile?.contextLimit ?? 32768, 32768);
  $('#profile-output').value = profile?.options?.num_predict ?? 2048;
  $('#model-options').replaceChildren(); $('#probe-feedback').textContent = '';
  settingsFeedback(''); $('#profile-name').focus();
  $('#profile-form').scrollIntoView({ block: 'nearest' });
}
function clearServerSecret() { $('#server-secret').value = ''; $('#server-user').value = ''; }
function authFields() {
  const auth = $('#server-auth').value;
  $('#server-user-field').hidden = auth !== 'basic'; $('#server-secret-field').hidden = auth === 'none';
  $('#server-secret-label').textContent = auth === 'basic' ? 'Passwort' : 'API-Schlüssel';
}
function editServer(profile) {
  clearServerSecret(); $('#server-form').hidden = false; $('#profile-form').hidden = true;
  $('#server-id').value = profile?.id ?? ''; $('#server-name').value = profile ? profile.name.split(' · ')[0].slice(0, 30) : '';
  $('#server-type').value = profile?.type ?? 'auto';
  $('#server-url').value = profile?.baseUrl ?? ''; $('#server-auth').value = profile?.authType ?? 'none';
  $('#server-http').checked = profile?.allowHttp ?? false; $('#server-feedback').textContent = '';
  authFields(); $('#server-name').focus(); $('#server-form').scrollIntoView({ block: 'nearest' });
}
function settingsTab(tab) {
  for (const name of ['local', 'security', 'litellm', 'updates']) { $(`#${name}-panel`).hidden = tab !== name; $(`#tab-${name}`).classList.toggle('selected', tab === name); }
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
$('#tab-security').addEventListener('click', () => settingsTab('security'));
$('#tab-litellm').addEventListener('click', () => settingsTab('litellm'));
$('#tab-updates').addEventListener('click', () => settingsTab('updates'));
$('#update-check').addEventListener('click', () => settingsAction(() => api.checkUpdates()));
$('#update-download').addEventListener('click', () => settingsAction(() => api.downloadUpdate()));
$('#update-install').addEventListener('click', () => settingsAction(() => api.installUpdate()));
$('#add-server').addEventListener('click', () => editServer(null));
$('#server-form-close').addEventListener('click', () => { clearServerSecret(); $('#server-form').hidden = true; });
$('#server-auth').addEventListener('change', () => { clearServerSecret(); authFields(); });
$('#server-type').addEventListener('change', () => {
  if ($('#server-type').value === 'comfyui' && !$('#server-url').value) {
    const known = state.settings.profiles.find(p => p.type === 'ollama');
    if (known) { const url = new URL(known.baseUrl); url.port = '8188'; $('#server-url').value = url.origin; }
  }
});
$('#server-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy || state.settingsBusy) return;
  const type = $('#server-auth').value;
  const request = {
    type: $('#server-type').value,
    id: $('#server-id').value || undefined, name: $('#server-name').value, baseUrl: $('#server-url').value, allowHttp: $('#server-http').checked,
    auth: { type, token: $('#server-secret').value, username: $('#server-user').value, password: $('#server-secret').value },
    useStoredAuth: Boolean($('#server-id').value && type !== 'none' && !$('#server-secret').value),
  };
  clearServerSecret(); $('#server-feedback').textContent = 'Server und Modelle werden geprüft …';
  const result = await settingsAction(() => api.addServer(request), 'Server geprüft. Die Modelle werden automatisch aufgelistet. Neue Modelle kannst du jetzt aktivieren.');
  // Drop credential references held by this form after IPC has completed.
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
    const result = await api.probeServer(original?.baseUrl === address && original.type === $('#profile-type').value ? { id: original.id } : { type: $('#profile-type').value, baseUrl: address, allowHttp: $('#profile-http').checked });
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
    baseUrl: $('#profile-url').value, model: $('#profile-model').value, enabled: $('#profile-enabled').checked,
    allowHttp: $('#profile-http').checked, options: { temperature: Number($('#profile-temperature').value), num_ctx: Number($('#profile-context').value), num_predict: Number($('#profile-output').value) },
  }), 'Verbindung gespeichert.');
  if (result.ok) $('#profile-form').hidden = true;
});
api.onState(render);
api.state().then(render).catch(() => error('Das Programm konnte nicht initialisiert werden.'));
