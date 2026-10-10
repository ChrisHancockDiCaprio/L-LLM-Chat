/* KAIROS-owned quick access. Reuses the main composer; no independent API calls. */
(() => {
  const $ = id => document.getElementById('hancock-' + id);
  let hooks; let current; let opened = false; let wasBusy = false; let lastState = 'idle';
  const completed = new Set(); let initialized = false; let lastTtsResult; let latestResult;
  const feedback = text => { $('feedback').textContent = text; };
  const profile = () => current?.settings.profiles.find(p => p.id === current.settings.activeId && p.enabled);
  function open() {
    if (!hooks) return;
    opened = true; $('dock').hidden = false; $('card').hidden = false; $('dock').classList.add('expanded');
    $('message').value = hooks.getDraft(); render(current); $('message').focus();
  }
  function close(restore = true) {
    opened = false; $('card').hidden = true; $('dock').classList.remove('expanded');
    if (restore && !$('dock').hidden) $('pet').shadowRoot.querySelector('button').focus();
  }
  function render(next) {
    if (!next || !hooks) return;
    current = next;
    const preferences = next.settings.hancock ?? { visible:true, paused:false };
    $('dock').hidden = !preferences.visible;
    if (!preferences.visible && opened) close(false);
    $('pet').toggleAttribute('paused', preferences.paused);
    $('pause').setAttribute('aria-pressed', String(preferences.paused));
    $('pause').textContent = preferences.paused ? 'Bewegung fortsetzen' : 'Ruhemodus';
    const running = Boolean(next.busy || next.tts?.busy);
    if (!initialized) {
      for (const job of next.jobs ?? []) if (job.state === 'completed') completed.add(job.id);
      lastTtsResult = next.tts?.resultId;
      initialized = true;
    }
    const finished = (next.jobs ?? []).filter(job => job.state === 'completed' && !completed.has(job.id));
    finished.forEach(job => completed.add(job.id));
    const newlyDone = finished.length > 0 || Boolean(next.tts?.resultId && next.tts.resultId !== lastTtsResult);
    if (finished.length) latestResult = {type:'chat',chatId:finished.at(-1).chatId};
    if (next.tts?.resultId && next.tts.resultId !== lastTtsResult) latestResult = {type:'tts'};
    lastTtsResult = next.tts?.resultId;
    const needsDecision = Boolean(next.tunnels?.pending?.length);
    if (needsDecision) lastState = 'attention';
    else if (running) lastState = 'waiting';
    else if (newlyDone) lastState = 'done';
    else if (wasBusy) lastState = next.notice || next.tts?.error ? 'error' : 'idle';
    else if (lastState === 'attention') lastState = 'idle';
    wasBusy = running;
    $('pet').setAttribute('state', lastState);
    $('status').textContent = needsDecision ? 'Bitte den SSH-Hostschlüssel im Sicherheitsdialog prüfen. Ein Klick auf Hancock erteilt keine Freigabe.' : running ? 'Wartet auf Antwort. Der Serverstatus ist nicht bestätigt.' : lastState === 'done' ? 'Ein Ergebnis ist fertig. Du kannst es in KAIROS öffnen.' : lastState === 'error' ? 'Der Vorgang konnte nicht abgeschlossen werden. Bitte prüfe den Hinweis in KAIROS.' : 'Hancock ist bereit.';
    const chat = next.sessions.find(s => s.id === next.activeId); const p = profile();
    $('context').textContent = (chat?.title ?? 'Gespräch') + ' · ' + (p ? p.name + ' · ' + p.baseUrl : 'Keine KI ausgewählt');
    $('conversation').replaceChildren(...next.sessions.map(session=>{
      const option=document.createElement('option');option.value=session.id;option.textContent=session.title;return option;
    }));
    $('conversation').value=next.activeId;
    $('conversation').disabled=$('new').disabled=Boolean(next.busy || next.settingsBusy);
    $('message').value = hooks.getDraft();
    $('message').disabled = Boolean(next.busy || next.settingsBusy);
    $('send').textContent = next.busy ? 'Nicht mehr warten' : ['comfyui','image-api'].includes(p?.type) ? 'Bild erzeugen' : 'Senden';
    $('send').disabled = Boolean(next.settingsBusy || hooks.isCancelling() || (!next.busy && (!p || !hooks.getDraft().trim())));
    $('attach').disabled = hooks.attachDisabled();
    $('attachments').textContent = hooks.attachmentNames().length ? 'Anhänge: ' + hooks.attachmentNames().join(' · ') : '';
    $('pause').disabled = $('hide').disabled = Boolean(next.busy || next.settingsBusy || next.jobAction);
    for (const button of document.querySelectorAll('[data-hancock-action]')) {
      button.disabled = Boolean(next.busy || next.settingsBusy);
    }
    const jobs = (next.jobs ?? []).filter(j => j.chatId === next.activeId).slice(-5).reverse();
    $('jobs').replaceChildren(...jobs.map(job => {
      const line = document.createElement('button'); line.type = 'button';
      line.textContent = job.providerName + ' · ' + ({completed:'Fertig',unknown:'Status unbekannt',queued:'Wartet',running:'Läuft',failed:'Fehler',cancelled:'Abgebrochen',missing:'Nicht auffindbar'}[job.state] ?? job.state);
      line.addEventListener('click', async () => { close(false); await hooks.showChat(job.chatId); hooks.showJobs(); });
      return line;
    }));
  }
  async function save(update) {
    try {
      const result = await hooks.savePreferences({ ...(current.settings.hancock ?? {visible:true,paused:false}), ...update });
      if (!result.ok) feedback(result.error ?? 'Die Einstellung konnte nicht gespeichert werden.');
    } catch {feedback('Die Einstellung konnte nicht gespeichert werden.');}
  }
  globalThis.kairosHancockPanel = {
    render,
    notice(message) { feedback(message ?? ''); },
    syncDraft() { if (hooks && current) render(current); },
    init(callbacks) {
      hooks = callbacks;
      $('pet').addEventListener('hancock-open', () => opened ? close() : open());
      $('show').addEventListener('click', async () => {
        if (current?.settings.hancock?.visible === false) await save({visible:true});
        if (current?.settings.hancock?.visible !== false) open();
      });
      $('close').addEventListener('click', () => close());
      const changeConversation = async action => {
        try {const result=await action();if(!result.ok)feedback(result.error??'Das Gespräch konnte nicht geöffnet werden.');}
        catch {feedback('Das Gespräch konnte nicht geöffnet werden.');}
      };
      $('conversation').addEventListener('change',()=>void changeConversation(()=>hooks.selectChat($('conversation').value)));
      $('new').addEventListener('click',()=>void changeConversation(()=>hooks.newChat()));
      $('message').addEventListener('input', () => { hooks.setDraft($('message').value); });
      $('message').addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!$('send').disabled && !current.busy) hooks.submit(); }
      });
      $('send').addEventListener('click', () => { if (!$('send').disabled) hooks.submit(); });
      $('attach').addEventListener('click', () => hooks.attach());
      $('dock').addEventListener('dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = hooks.attachDisabled() ? 'none' : 'copy';
      });
      $('dock').addEventListener('drop', event => {
        event.preventDefault();
        if (hooks.attachDisabled()) {feedback('Dateien können gerade nicht angehängt werden.');return;}
        const files = Array.from(event.dataTransfer.files).slice(0,4);
        if (!files.length) {feedback('Bitte eine lokale Datei ablegen.');return;}
        open(); void hooks.drop(files);
      });
      $('large').addEventListener('click', () => {
        close(false);
        if (lastState === 'done' && latestResult?.type === 'tts') hooks.showTts();
        else hooks.showChat(lastState === 'done' ? latestResult?.chatId : undefined);
      });
      $('pause').addEventListener('click', () => void save({paused:!current.settings.hancock?.paused}));
      $('hide').addEventListener('click', () => void save({visible:false}));
      $('card').addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
      for (const button of document.querySelectorAll('[data-hancock-action]')) button.addEventListener('click', async () => {
        feedback(''); $('jobs').hidden = true;
        if (button.dataset.hancockAction === 'chat') {
          if (!['ollama','openai-chat'].includes(profile()?.type)) {
            const p = current.settings.profiles.find(p => p.enabled && ['ollama','openai-chat'].includes(p.type));
            if (!p) { feedback('Bitte zuerst eine Chat-KI in den Einstellungen einrichten.'); return; }
            const result = await hooks.selectProfile(p.id); if (!result.ok) { feedback(result.error); return; }
          }
          hooks.showChat(); $('message').focus();
        } else if (button.dataset.hancockAction === 'image') {
          const images = current.settings.profiles.filter(p => p.enabled && ['comfyui','image-api'].includes(p.type));
          if (!images.length) { feedback('Bitte zuerst ein Bildprofil in den Einstellungen einrichten.'); return; }
          if (!images.some(p => p.id === profile()?.id)) {
            const result = await hooks.selectProfile(images[0].id); if (!result.ok) { feedback(result.error); return; }
          }
          close(false); hooks.showChat();
        } else if (button.dataset.hancockAction === 'tts') {
          close(false); hooks.showTts();
        } else { $('jobs').hidden = false; feedback('Aufträge des angezeigten Gesprächs.'); }
      });
    },
  };
})();
