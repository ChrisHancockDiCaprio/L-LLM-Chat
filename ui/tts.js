(() => {
  const $=id=>document.getElementById('tts-'+id);const api=window.qwenChat;
  let current;let configured=false;let lastAudio;
  const labels={custom:'Vorgegebene Stimme',design:'Stimme entwerfen',clone:'Stimme klonen'};
  const feedback=text=>{$('feedback').textContent=text??'';};
  function open() {$('panel').hidden=false;$('toggle').setAttribute('aria-expanded','true');}
  function options(select,values,label=v=>v) {
    const before=select.value;select.replaceChildren(...values.map(value=>{const o=document.createElement('option');o.value=value;o.textContent=label(value);return o;}));
    if(values.includes(before))select.value=before;
  }
  function fields() {
    const mode=current?.capabilities?.modes.find(m=>m.id===$('mode').value);
    options($('language'),mode?.languages??[]);options($('speaker'),mode?.speakers??[]);
    $('speaker-label').hidden=mode?.id!=='custom';$('instruct-label').hidden=!mode?.instruction;
    $('clone-fields').hidden=mode?.id!=='clone';$('ref-text-label').hidden=$('xvector').checked;
    $('model').textContent=mode?.model??'Verbindung zuerst prüfen.';
    $('sampling').querySelectorAll('input').forEach(input=>{input.disabled=!$('advanced').checked;});
  }
  function render(state) {
    current=state.tts;
    if(!configured && current?.connection) {$('url').value=current.connection.baseUrl;$('http').checked=current.connection.allowHttp;configured=true;}
    const modes=current?.capabilities?.modes.map(m=>m.id)??[];
    if([...$('mode').options].map(o=>o.value).join()!==modes.join())options($('mode'),modes,v=>labels[v]);
    const locked=Boolean(current?.busy||state.busy||state.settingsBusy||state.jobAction);
    $('fields').disabled=locked||!modes.length||$('url').value.trim().replace(/\/$/,'')!==current?.connection?.baseUrl||$('http').checked!==current?.connection?.allowHttp;
    for(const id of ['connect','url','http','export','use-result'])$(id).disabled=locked;
    $('cancel').hidden=!current?.busy;$('cancel').disabled=!current?.busy;
    $('reference-name').textContent=current?.referenceName??'';
    $('clear-reference').disabled=!current?.referenceName;
    fields();
    if(current?.hasResult&&!lastAudio)void api.ttsAudio().then(showAudio).catch(()=>feedback('Audio konnte nicht geladen werden.'));
  }
  function showAudio(audio) {if(!audio||lastAudio===audio.id)return;lastAudio=audio.id;$('audio').src=audio.src;$('result').hidden=false;}
  async function action(fn,message='') {
    feedback(message);
    try{const result=await fn();if(!result.ok){feedback(result.error);return null;}if(result.audio)showAudio(result.audio);return result;}
    catch{feedback('Sprachfunktion konnte nicht ausgeführt werden.');return null;}
  }
  $('toggle').addEventListener('click',()=>{if($('panel').hidden)open();else{$('panel').hidden=true;$('toggle').setAttribute('aria-expanded','false');}});
  $('close').addEventListener('click',()=>{$('panel').hidden=true;$('toggle').setAttribute('aria-expanded','false');});
  $('connect').addEventListener('click',async()=>{const r=await action(()=>api.ttsConnect({baseUrl:$('url').value,allowHttp:$('http').checked}),'Serverfähigkeiten werden geprüft …');if(r)feedback('Verbunden. Verfügbare Modi und Stimmen wurden geladen.');});
  $('mode').addEventListener('change',fields);$('xvector').addEventListener('change',fields);$('advanced').addEventListener('change',fields);
  for(const id of ['url','http'])$(id).addEventListener('input',()=>{if(current){$('fields').disabled=true;feedback('Verbindung geändert. Bitte zuerst prüfen und speichern.');}});
  $('reference').addEventListener('click',()=>action(()=>api.ttsReference()));
  $('clear-reference').addEventListener('click',()=>action(()=>api.ttsClearReference()));
  $('export').addEventListener('click',()=>action(()=>api.ttsExport()));
  $('use-result').addEventListener('click',async()=>{const r=await action(()=>api.ttsUseResult());if(r){$('ref-text').value=r.refText;$('xvector').checked=false;if(current?.capabilities?.modes.some(m=>m.id==='clone')){$('mode').value='clone';fields();}feedback('Referenz übernommen. Das Transkript entspricht dem erzeugten Text.');}});
  $('cancel').addEventListener('click',()=>api.ttsCancel());
  $('generate').addEventListener('click',async()=>{
    const r=await action(()=>api.ttsGenerate({mode:$('mode').value,text:$('text').value,language:$('language').value,speaker:$('speaker').value,
      instruct:$('instruct-label').hidden?'':$('instruct').value,ref_text:$('ref-text').value,x_vector_only_mode:$('xvector').checked,
      advanced:$('advanced').checked,do_sample:$('sample').checked,temperature:Number($('temperature').value),top_p:Number($('top-p').value),
      top_k:Number($('top-k').value),repetition_penalty:Number($('repetition').value),max_new_tokens:Number($('tokens').value)}),'Sprache wird erzeugt. Der erste Modellstart und CPU-Betrieb können länger dauern …');
    if(r)feedback('Audio bereit. Du kannst es anhören, speichern oder als Referenz verwenden.');
  });
  globalThis.kairosTts={render,useText(text){open();$('text').value=text.slice(0,4000);feedback(text.length>4000?'Antwort auf 4000 Zeichen gekürzt. Bitte vor dem Erzeugen prüfen.':'Chat-Antwort übernommen. Bitte vor dem Erzeugen prüfen.');$('text').focus();}};
})();
