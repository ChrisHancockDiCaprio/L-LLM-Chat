(() => {
  const $=id=>document.getElementById('tts-'+id);const api=window.qwenChat;
  let current;let lastAudio;let settingsProvider;
  const labels={custom:'Vorgegebene Stimme',design:'Stimme entwerfen',clone:'Stimme klonen'};
  const feedback=text=>{$('feedback').textContent=text??'';};
  function workspace(tts) {
    $('panel').hidden=!tts;document.getElementById('chat-workspace').hidden=tts;
    $('toggle').setAttribute('aria-selected',String(tts));$('toggle').classList.toggle('selected',tts);
    document.getElementById('chat-tab').setAttribute('aria-selected',String(!tts));document.getElementById('chat-tab').classList.toggle('selected',!tts);
  }
  function options(select,values,label=v=>v) {
    const before=select.value;
    select.replaceChildren(...values.map(value=>{const o=document.createElement('option');o.value=value;o.textContent=label(value);return o;}));
    if(values.includes(before))select.value=before;
  }
  const show=(id,visible)=>{$(id).hidden=!visible;};
  function fields() {
    const caps=current?.capabilities;const qwen=current?.provider==='qwen';
    const mode=caps?.modes?.find(m=>m.id===$('mode').value);
    show('mode-label',qwen);show('model-choice-label',!qwen);
    const voice=caps?.voices?.find(v=>v.id===$('speaker').value&&v.model===$('model-choice').value);
    if(qwen){options($('language'),mode?.languages??[]);options($('speaker'),mode?.speakers??[]);}
    else options($('language'),voice?.locales??[]);
    $('input-mode').querySelector('option[value=ssml]').disabled=!caps?.ssml;
    const text=$('input-mode').value==='text';
    $('generate').disabled=!text&&!caps?.ssml;
    $('text').maxLength=text?4000:60000;show('ssml-hint',!text);
    show('language-label',text&&(qwen||Boolean(voice?.locales.length)));
    show('speaker-label',text&&(!qwen||mode?.id==='custom'));
    show('model-choice-label',text&&!qwen);
    show('instruct-label',text&&(qwen?mode?.instruction:voice?.instruction));
    show('clone-fields',qwen&&mode?.id==='clone');show('ref-text-label',!$('xvector').checked);
    show('qwen-advanced',qwen);show('voice-parameters',text&&!qwen);
    show('speed-label',text&&(voice?.prosody||voice?.speed));show('pitch-label',text&&voice?.prosody);show('volume-label',text&&voice?.prosody);
    $('speed').min=voice?.speed?'0.25':'0.5';$('speed').max=voice?.speed?'4':'2';
    if(Number($('speed').value)<Number($('speed').min)||Number($('speed').value)>Number($('speed').max))$('speed').value='1';
    options($('style'),['',...(voice?.styles??[])],v=>v||'Standard');options($('role'),['',...(voice?.roles??[])],v=>v||'Standard');
    show('style-label',text&&Boolean(voice?.styles.length));show('role-label',text&&Boolean(voice?.roles.length)&&Boolean($('style').value));
    if($('role-label').hidden)$('role').value='';
    show('styledegree-label',text&&Boolean($('style').value)&&!voice?.hd);
    show('hd-temperature-label',text&&voice?.hd);$('hd-temperature').min=voice?.omni?'0.3':'0';
    for(const id of ['hd-top-p-label','hd-top-k-label','hd-cfg-label'])show(id,text&&voice?.omni);
    show('enhance-label',text&&voice?.hd);
    $('model').textContent=qwen?(mode?.model??'Verbindung zuerst laden.'):(text?(voice?.model??'Verbindung zuerst laden.'):'Voice und Parameter im SSML festlegen.');
    $('sampling').querySelectorAll('input').forEach(input=>{input.disabled=!$('advanced').checked;});
    show('use-result',qwen&&current?.resultFormat==='wav');show('reference-hint',qwen);
  }
  function voices() {
    const list=current?.capabilities?.voices?.filter(v=>v.model===$('model-choice').value)??[];
    if(current?.provider!=='qwen') {
      const before=$('speaker').value;
      options($('speaker'),list.map(v=>v.id),id=>list.find(v=>v.id===id)?.name+' · '+id);
      if(!before&&list.some(v=>v.id==='de-DE-Seraphina:DragonHDLatestNeural'))$('speaker').value='de-DE-Seraphina:DragonHDLatestNeural';
    }
    fields();
  }
  function settingsFields(load=false) {
    const provider=$('settings-provider').value;const qwen=provider==='qwen';const speech=provider==='azure-speech';
    if(load){
      const c=current?.connections?.[provider]??{};
      $('url').value=c.baseUrl??'';$('http').checked=c.allowHttp===true;$('region').value=c.region??'';
      $('deployment').value=c.deployment??'';$('family').value=c.model??'gpt-4o-mini-tts';$('api-version').value=c.apiVersion??'2025-04-01-preview';$('key').value='';
      $('key').placeholder=c.hasKey?'Gespeicherten Key behalten (leer lassen)':'API-Key eingeben';
      $('python').value=current?.provider===provider?current.python??'':'Verbindung auswählen oder speichern, um das passende Beispiel anzuzeigen.';
    }
    show('http-label',qwen);show('key-label',!qwen);show('region-label',!qwen);
    for(const id of ['deployment-label','family-label','api-version-label'])show(id,!qwen&&!speech);
    $('settings-hint').textContent=qwen?'KAIROS-Qwen-Serverbrücke. Fähigkeiten werden vom Server geladen.':speech?'Speech-Ressourcen-Endpoint oder regionale TTS-Adresse. Ohne Endpoint wird die Region verwendet. Vorgefertigte Stimmen; kein Custom-Voice-Deployment.':'Azure-OpenAI-Ressourcen-Endpoint, ohne API-Pfad. Deployment-Name und tatsächliche Modellfamilie angeben. Foundry-Projekt- und Chat-Audio-Endpunkte werden nicht verwendet. Speichern prüft die Konfiguration; Azure-Zugriff wird erst beim Erzeugen geprüft.';
  }
  function render(state) {
    const previous=current?.capabilities;current=state.tts;if(!current)return;
    $('provider').value=current.provider;
    if(previous!==current.capabilities){
      options($('mode'),current.capabilities?.modes?.map(m=>m.id)??[],v=>labels[v]);
      options($('model-choice'),current.capabilities?.models??[]);
      options($('format'),current.capabilities?.formats??['wav']);voices();
    }
    const locked=Boolean(current.busy||current.unavailable);
    $('fields').disabled=locked||!current.capabilities;
    for(const id of ['connect','url','http','settings-provider','region','deployment','family','api-version','key','provider','reload','export','use-result'])$(id).disabled=locked;
    $('cancel').hidden=!current.busy;$('settings-cancel').hidden=!current.busy;
    $('reference-name').textContent=current.referenceName??'';$('clear-reference').disabled=!current.referenceName;
    $('connection-status').textContent=current.unavailable??(!current.connection?'TTS-Verbindung in den Einstellungen anlegen.':!current.capabilities?'Gespeichert. Verbindung laden, um Stimmen und Parameter auszuwählen.':current.capabilities.verified===false?'Deployment konfiguriert. Azure-Zugriff wird erst beim Erzeugen geprüft.':'Verbindung geladen.');
    $('export-path').textContent=current.exportPath?'Zuletzt exportiert: '+current.exportPath:'';
    $('export').disabled=locked||!current.hasResult;
    if(settingsProvider===undefined){settingsProvider=current.provider;$('settings-provider').value=settingsProvider;settingsFields(true);}
    if(current.provider===$('settings-provider').value)$('python').value=current.python??'';
    fields();
    if(current.hasResult&&!lastAudio)void api.ttsAudio().then(showAudio).catch(()=>feedback('Audio konnte nicht geladen werden.'));
  }
  function showAudio(audio) {
    if(!audio||lastAudio===audio.id)return;lastAudio=audio.id;$('audio').src=audio.preview===false?'':audio.src;$('audio').hidden=audio.preview===false;$('result').hidden=false;
    if(audio.preview===false)feedback('PCM-Audio bereit. Rohdaten können exportiert, aber nicht direkt abgespielt werden.');
  }
  async function action(fn,message='') {
    feedback(message);
    try{const result=await fn();if(!result.ok){feedback(result.error);return null;}if(result.audio)showAudio(result.audio);return result;}
    catch{feedback('Sprachfunktion konnte nicht ausgeführt werden.');return null;}
  }
  $('toggle').addEventListener('click',()=>workspace(true));document.getElementById('chat-tab').addEventListener('click',()=>workspace(false));
  document.querySelector('.workspace-tabs').addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tts=event.key==='End'||event.key!=='Home'&&event.target.id==='chat-tab';workspace(tts);(tts?$('toggle'):document.getElementById('chat-tab')).focus();}
  });
  // Ordinary chat navigation returns to its workspace without touching TTS requests.
  document.getElementById('new-chat').addEventListener('click',()=>workspace(false));document.getElementById('session-list').addEventListener('click',()=>workspace(false));
  $('settings-open').addEventListener('click',()=>{document.getElementById('settings-button').click();document.getElementById('tab-tts-settings').click();});
  $('settings-provider').addEventListener('change',()=>{settingsProvider=$('settings-provider').value;settingsFields(true);});
  document.getElementById('settings-dialog').addEventListener('close',()=>{$('key').value='';});
  $('connect').addEventListener('click',async()=>{
    const config={provider:$('settings-provider').value,baseUrl:$('url').value,allowHttp:$('http').checked,region:$('region').value,deployment:$('deployment').value,model:$('family').value,apiVersion:$('api-version').value,apiKey:$('key').value};
    $('key').value='';$('settings-feedback').textContent='Verbindung wird geprüft …';
    const r=await action(()=>api.ttsConnect(config));
    $('settings-feedback').textContent=r?(r.verified?'Gespeichert. Fähigkeiten wurden geladen.':'Gespeichert. Zugriff wird erst beim Erzeugen geprüft.'):$('feedback').textContent;
    if(r)settingsFields(true);
  });
  $('provider').addEventListener('change',async()=>{const target=$('provider').value;const r=await action(()=>api.ttsSelect(target),'Verbindung wird geladen …');if(!r)$('provider').value=current.provider;});
  $('reload').addEventListener('click',()=>action(()=>api.ttsSelect($('provider').value),'Verbindung wird geladen …'));
  for(const id of ['mode','xvector','advanced','input-mode','style','speaker'])$(id).addEventListener('change',fields);
  $('model-choice').addEventListener('change',voices);
  $('import').addEventListener('click',async()=>{const r=await action(()=>api.ttsImport());if(r?.text!==undefined){$('text').value=r.text;$('input-mode').value=r.inputMode;$('import-name').textContent=r.name;fields();feedback('Datei importiert. Vor dem Erzeugen prüfen.');}});
  $('reference').addEventListener('click',()=>action(()=>api.ttsReference()));$('clear-reference').addEventListener('click',()=>action(()=>api.ttsClearReference()));
  $('export').addEventListener('click',async()=>{const r=await action(()=>api.ttsExport());if(r?.path)feedback('Audio gespeichert: '+r.path);});
  $('use-result').addEventListener('click',async()=>{const r=await action(()=>api.ttsUseResult());if(r){$('ref-text').value=r.refText;$('xvector').checked=false;if(current?.capabilities?.modes.some(m=>m.id==='clone')){$('mode').value='clone';fields();}feedback('Referenz übernommen.');}});
  for(const id of ['cancel','settings-cancel'])$(id).addEventListener('click',()=>api.ttsCancel());
  $('audio').addEventListener('error',()=>feedback('Dieses Audioformat kann hier nicht abgespielt werden. Audio exportieren oder WAV/MP3 wählen.'));
  $('generate').addEventListener('click',async()=>{
    const raw={provider:current.provider,inputMode:$('input-mode').value,text:$('text').value,format:$('format').value};
    if(current.provider==='qwen')Object.assign(raw,{mode:$('mode').value,language:$('language').value,speaker:$('speaker').value,instruct:$('instruct-label').hidden?'':$('instruct').value,ref_text:$('ref-text').value,x_vector_only_mode:$('xvector').checked,advanced:$('advanced').checked,do_sample:$('sample').checked,temperature:Number($('temperature').value),top_p:Number($('top-p').value),top_k:Number($('top-k').value),repetition_penalty:Number($('repetition').value),max_new_tokens:Number($('tokens').value)});
    else if(raw.inputMode==='text') {
      raw.model=$('model-choice').value;raw.speaker=$('speaker').value;
      for(const [key,id,type] of [['language','language','string'],['speed','speed','number'],['pitch','pitch','number'],['volume','volume','number'],['style','style','string'],['role','role','string'],['styledegree','styledegree','number'],['instruct','instruct','string'],['temperature','hd-temperature','number'],['top_p','hd-top-p','number'],['top_k','hd-top-k','number'],['cfg_scale','hd-cfg','number'],['enhancePronunciation','enhance','boolean']]) {
        if(!$(id+'-label').hidden)raw[key]=type==='number'?Number($(id).value):type==='boolean'?$(id).checked:$(id).value;
      }
    }
    const r=await action(()=>api.ttsGenerate(raw),'Sprache wird erzeugt …');if(r)feedback(r.audio.preview===false?'PCM-Audio bereit zum Export.':'Audio bereit zum Anhören und Exportieren.');
  });
  globalThis.kairosTts={render,useText(text){workspace(true);$('input-mode').value='text';$('text').value=text.slice(0,4000);fields();feedback(text.length>4000?'Antwort auf 4000 Zeichen gekürzt. Bitte prüfen.':'Chat-Antwort übernommen. Bitte prüfen.');$('text').focus();}};
})();
