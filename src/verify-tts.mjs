import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {dialog} from 'electron';

export async function verifyTts({window,store,publish,dataDir}) {
  const run=code=>window.webContents.executeJavaScript(code);
  const previousFetch=globalThis.fetch;const previousDialog=dialog.showSaveDialog;const previousOpen=dialog.showOpenDialog;
  const audio=Buffer.alloc(46);audio.write('RIFF');audio.writeUInt32LE(38,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(24000,24);audio.writeUInt32LE(48000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(2,40);
  const requests=[];let delayed=false;
  const caps={protocol:'kairos-qwen-tts-v1',modes:[
    {id:'custom',model:'0.6B-CustomVoice',languages:['german'],speakers:['ryan'],instruction:false},
    {id:'design',model:'1.7B-VoiceDesign',languages:['german'],speakers:[],instruction:true},
    {id:'clone',model:'0.6B-Base',languages:['german'],speakers:[],instruction:false},
  ]};
  globalThis.fetch=async(url,init)=>{
    if(url.endsWith('/capabilities'))return new Response(JSON.stringify(caps));
    assert.ok(url.endsWith('/v1/tts/generate'));assert.equal(init.redirect,'error');requests.push(JSON.parse(init.body));
    if(delayed)return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
    return new Response(audio,{headers:{'content-type':'audio/wav'}});
  };
  const exportFile=join(dataDir,'tts-fixture.wav');dialog.showSaveDialog=async()=>({canceled:false,filePath:exportFile});
  const until=async predicate=>{for(let i=0;i<100;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,30));}throw Error('TTS UI timeout');};
  try{
    store.active.messages.push({id:'rich-fixture',role:'assistant',state:'complete',createdAt:new Date().toISOString(),content:'# Sprache\n\n- Hallo\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\n<script>bad()</script>\n```\n\n<img src="https://tracker" onerror="bad()"><a href="javascript:bad()">bad</a>'});publish();
    await until(()=>run('Boolean(document.querySelector(".message:last-child .message-body table"))'));
    assert.equal(await run('document.querySelectorAll(".message-body script,.message-body img,.message-body a[href]").length'),0);
    await run('document.querySelector(".message:last-child .message-main > button").click()');
    assert.ok(await run('!document.querySelector("#tts-panel").hidden && document.querySelector("#tts-text").value.includes("Hallo")'));
    assert.equal((await run('window.qwenChat.ttsConnect({baseUrl:"http://127.0.0.1:8860",allowHttp:true})')).ok,true);
    await until(()=>run('!document.querySelector("#tts-fields").disabled'));
    assert.equal(await run('document.querySelector("#tts-instruct-label").hidden'),true);
    await run('document.querySelector("#tts-mode").value="design";document.querySelector("#tts-mode").dispatchEvent(new Event("change"));document.querySelector("#tts-instruct").value="warm";document.querySelector("#tts-text").value="PRIVATE-TTS-UI";document.querySelector("#tts-generate").click()');
    await until(()=>run('!document.querySelector("#tts-result").hidden && !document.querySelector("#tts-fields").disabled'));
    assert.equal(requests.length,1);assert.equal(requests[0].instruct,'warm');assert.equal(requests[0].temperature,undefined);
    await run('document.querySelector("#tts-use-result").click()');
    await until(()=>run('document.querySelector("#tts-mode").value==="clone"'));
    assert.equal(await run('document.querySelector("#tts-ref-text").value'),'PRIVATE-TTS-UI');
    await run('document.querySelector("#tts-generate").click()');await until(()=>requests.length===2);await until(()=>run('!document.querySelector("#tts-fields").disabled'));
    assert.equal(requests[1].ref_audio,audio.toString('base64'));assert.equal(requests[1].ref_text,'PRIVATE-TTS-UI');assert.equal(requests[1].instruct,undefined);
    assert.equal((await run('window.qwenChat.ttsExport()')).ok,true);assert.deepEqual(await readFile(exportFile),audio);
    assert.equal((await readFile(join(dataDir,'tts.vault'))).includes(Buffer.from('PRIVATE-TTS-UI')),false);
    delayed=true;const pending=run('window.qwenChat.ttsGenerate({mode:"clone",text:"Hi",language:"german",x_vector_only_mode:true})');
    await until(()=>requests.length===3);await run('window.qwenChat.ttsCancel()');assert.equal((await pending).ok,false);assert.equal(requests.length,3);
    const azureRequests=[];let azureDelay=false;
    globalThis.fetch=async(url,init)=>{
      assert.equal(init.redirect,'error');
      if(url.endsWith('/voices/list'))return new Response(JSON.stringify([
        {ShortName:'de-DE-KatjaNeural',Locale:'de-DE',StyleList:['cheerful'],RolePlayList:['YoungAdultFemale']},
        {ShortName:'de-DE-Seraphina:DragonHDLatestNeural',Locale:'de-DE'},
      ]));
      assert.ok(url.endsWith('/tts/cognitiveservices/v1'));assert.equal(init.headers['Ocp-Apim-Subscription-Key'],'FAKE-AZURE-UI-KEY');
      azureRequests.push(init.body);
      if(azureDelay)return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
      return new Response(audio,{headers:{'content-type':'audio/wav'}});
    };
    await run('document.querySelector("#tts-settings-open").click();document.querySelector("#tts-settings-provider").value="azure-speech";document.querySelector("#tts-settings-provider").dispatchEvent(new Event("change"));document.querySelector("#tts-url").value="https://speech-fixture.cognitiveservices.azure.com";document.querySelector("#tts-key").value="FAKE-AZURE-UI-KEY";document.querySelector("#tts-connect").click()');
    await until(()=>run('document.querySelector("#tts-provider").value==="azure-speech" && !document.querySelector("#tts-fields").disabled'));
    assert.equal(await run('document.querySelector("#tts-key").value'),'');
    assert.equal(await run('document.querySelector("#tts-python").value.includes("FAKE-AZURE-UI-KEY")'),false);
    await run('document.querySelector("#settings-close").click();document.querySelector("#tts-model-choice").value="Dragon HD";document.querySelector("#tts-model-choice").dispatchEvent(new Event("change"))');
    for(const id of ['speed','pitch','volume','style','role'])assert.equal(await run(`document.querySelector('#tts-${id}-label').hidden`),true);
    assert.equal(await run('document.querySelector("#tts-hd-temperature-label").hidden'),false);
    await run('document.querySelector("#tts-text").value="Hallo HD";document.querySelector("#tts-generate").click()');
    await until(()=>azureRequests.length===1);await until(()=>run('!document.querySelector("#tts-fields").disabled'));
    assert.match(azureRequests[0],/Seraphina:DragonHDLatestNeural/);assert.ok(!azureRequests[0].includes('prosody'));
    const xml='<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="de-DE"><voice name="de-DE-KatjaNeural">Hallo SSML</voice></speak>';
    const importFile=join(dataDir,'input.ssml');await writeFile(importFile,xml);
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[importFile]});
    await run('document.querySelector("#tts-import").click()');await until(()=>run('document.querySelector("#tts-input-mode").value==="ssml"'));
    assert.equal(await run('document.querySelector("#tts-text").value'),xml);
    await run('document.querySelector("#tts-generate").click()');await until(()=>azureRequests.length===2);await until(()=>run('!document.querySelector("#tts-fields").disabled'));
    assert.equal(azureRequests[1],xml);
    const preview=await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await writeFile(join(dataDir,'preview-tts-studio.png'),preview.toPNG());
    azureDelay=true;const azurePending=run(`window.qwenChat.ttsGenerate({inputMode:'ssml',text:${JSON.stringify(xml)}})`);
    await until(()=>azureRequests.length===3);
    await run('document.querySelector("#chat-tab").click()');
    assert.equal(await run('document.querySelector("#chat-workspace").hidden'),false);
    assert.equal(await run('document.querySelector("#tts-panel").hidden'),true);
    await run('window.qwenChat.ttsCancel()');assert.equal((await azurePending).ok,false);assert.equal(azureRequests.length,3);
    assert.equal((await readFile(join(dataDir,'tts.vault'))).includes(Buffer.from('FAKE-AZURE-UI-KEY')),false);
    const configured=await run('window.qwenChat.ttsConnect({provider:"azure-foundry",baseUrl:"https://foundry-fixture.openai.azure.com",deployment:"speech",model:"tts-1",apiKey:"FAKE-FOUNDRY-KEY"})');
    assert.equal(configured.ok,true);
    await until(()=>run('document.querySelector("#tts-provider").value==="azure-foundry"'));
    assert.equal(await run('document.querySelector("#tts-generate").disabled'),true);
    await run('document.querySelector("#tts-input-mode").value="text";document.querySelector("#tts-input-mode").dispatchEvent(new Event("change"))');
    assert.equal(await run('document.querySelector("#tts-instruct-label").hidden'),true);
    assert.equal(await run('document.querySelector("#tts-pitch-label").hidden'),true);
    return {richTextInElectron:true,unsafeHtmlRemoved:true,ttsDesignAndCloneUI:true,ttsEncryptedExport:true,ttsCancelWithoutRetry:true,azureSpeechUI:true,azureHDParameterGating:true,ssmlImportAndSynthesis:true,ttsIndependentWorkspace:true,azureFoundryParameterGating:true};
  }finally{globalThis.fetch=previousFetch;dialog.showSaveDialog=previousDialog;dialog.showOpenDialog=previousOpen;}
}
