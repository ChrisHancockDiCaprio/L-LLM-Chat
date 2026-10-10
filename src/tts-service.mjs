import { SecureFile } from './secure-file.mjs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateWav, MAX_AUDIO } from './tts-client.mjs';
import { PROVIDERS, providerConnection, publicConnection, apiKey, providerCapabilities, providerRequest, providerSynthesize, validateAudio, validateSsml, pythonExample } from './tts-providers.mjs';

export async function registerTts({register,directory,cipher,dialog,window,publish,isLocked}) {
  const storage=new SecureFile(directory,'tts',cipher);
  let db={connections:{},provider:'azure-speech'};let caps=null;let busy=false;let controller;let unavailable;
  try {
    db=JSON.parse(await storage.read());
    // Preserve the existing encrypted Qwen configuration and reference/audio.
    if(!db.connections)db={...db,connections:db.connection?{qwen:providerConnection(db.connection)}:{},provider:'qwen'};
    delete db.connection;
    if(!PROVIDERS.includes(db.provider))throw Error('Ungültiger Provider.');
    for(const [id,c] of Object.entries(db.connections)) {
      if(!PROVIDERS.includes(id)||id!==(c.provider??'qwen'))throw Error('Ungültige Verbindung.');
      db.connections[id]={...providerConnection(c),...(c.key?{key:apiKey(c.key)}:{})};
    }
    if(db.reference)validateWav(Buffer.from(db.reference.base64,'base64'));
    if(db.result){db.result.extension??='wav';db.result.mime??='audio/wav';validateAudio(Buffer.from(db.result.base64,'base64'),db.result.extension);}
  }catch(error){if(error.code!=='ENOENT'){unavailable='Der TTS-Tresor konnte nicht geöffnet werden. Er bleibt erhalten. Chat ist weiterhin verfügbar.';db={connections:{},provider:'azure-speech'};}}
  const connection=()=>db.connections[db.provider];
  const snapshot=()=>({provider:db.provider,unavailable,connection:publicConnection(connection()),connections:Object.fromEntries(Object.entries(db.connections).map(([id,c])=>[id,publicConnection(c)])),capabilities:caps,busy,referenceName:db.reference?.name??'',hasResult:Boolean(db.result),resultId:db.result?.id,resultFormat:db.result?.extension,exportPath:db.exportPath??'',python:pythonExample(connection())});
  const available=()=>{if(unavailable)throw Error(unavailable);if(busy||isLocked())throw Error('Bitte den laufenden TTS-Vorgang abschließen.');};
  async function operation(fn) {
    try{available();}catch(error){return {ok:false,error:error.message};}
    try{busy=true;controller=new AbortController();publish();return {ok:true,...await fn()};}
    catch(error){return {ok:false,error:controller.signal.aborted?'TTS abgebrochen. Der Server kann weiterrechnen; es wird nichts automatisch erneut gesendet.':error.message};}
    finally{busy=false;controller=undefined;publish();}
  }
  async function save(next) {await storage.write(JSON.stringify(next));db=next;}
  register('tts:connect',raw=>operation(async()=>{
    const candidate=providerConnection(raw);const previous=db.connections[candidate.provider];
    const sameEndpoint=previous?.baseUrl===candidate.baseUrl;
    if(candidate.provider!=='qwen') {
      // A stored key never follows a changed endpoint without explicit re-entry.
      candidate.key=raw.apiKey?apiKey(raw.apiKey):sameEndpoint?previous.key:undefined;
      if(!candidate.key)throw Error('Bitte den API-Key für diesen Endpoint eingeben.');
    }
    const capabilities=await providerCapabilities(candidate,{signal:controller.signal});
    controller.signal.throwIfAborted();
    await save({...db,provider:candidate.provider,connections:{...db.connections,[candidate.provider]:candidate}});
    caps=capabilities;return {state:snapshot(),verified:capabilities.verified!==false};
  }));
  register('tts:select',provider=>operation(async()=>{
    if(!PROVIDERS.includes(provider))throw Error('Unbekannter Provider.');
    const candidate=db.connections[provider];
    const capabilities=candidate?await providerCapabilities(candidate,{signal:controller.signal}):null;
    controller.signal.throwIfAborted();await save({...db,provider});caps=capabilities;return {state:snapshot()};
  }));
  register('tts:import',()=>operation(async()=>{
    const selected=await dialog.showOpenDialog(window,{title:'Text / SSML importieren',properties:['openFile'],filters:[{name:'UTF-8-Text und SSML',extensions:['txt','ssml','xml']}]});
    if(selected.canceled)return {};
    const path=selected.filePaths[0];if((await stat(path)).size>60000)throw Error('Datei darf höchstens 60000 Bytes groß sein.');
    const bytes=await readFile(path);if(bytes.length>60000)throw Error('Datei zu groß.');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const inputMode=/\.(ssml|xml)$/i.test(path)?'ssml':'text';
    if(inputMode==='ssml') {
      if(!caps?.ssml)throw Error('SSML-Import erfordert eine geladene Azure-Speech-Verbindung.');
      validateSsml(text,caps);
    }else if(text.length>4000)throw Error('Textdatei darf höchstens 4000 Zeichen enthalten.');
    return {text,inputMode,name:basename(path)};
  }));
  register('tts:reference',()=>operation(async()=>{
    const selected=await dialog.showOpenDialog(window,{title:'Referenzstimme als WAV',properties:['openFile'],filters:[{name:'WAV',extensions:['wav']}]});
    if(selected.canceled)return {};
    const path=selected.filePaths[0];if((await stat(path)).size>MAX_AUDIO)throw Error('Referenz darf höchstens 16 MB groß sein.');
    const bytes=validateWav(await readFile(path));
    await save({...db,reference:{name:basename(path),base64:bytes.toString('base64')}});return {state:snapshot()};
  }));
  register('tts:clear-reference',()=>operation(async()=>{const next={...db};delete next.reference;await save(next);return {state:snapshot()};}));
  register('tts:generate',raw=>operation(async()=>{
    if(raw.provider && raw.provider!==db.provider)throw Error('Provider wurde geändert. Bitte erneut prüfen.');
    if(!connection())throw Error('Bitte eine TTS-Verbindung in den Einstellungen anlegen.');
    const request=providerRequest(connection(),raw,caps,db.reference);
    const bytes=await providerSynthesize(connection(),request,{signal:controller.signal});
    controller.signal.throwIfAborted();
    const result={id:randomUUID(),base64:bytes.toString('base64'),text:raw.text,extension:request.extension,mime:request.mime};
    await save({...db,result});return {audio:audio()};
  }));
  const audio=()=>db.result?{id:db.result.id,src:`data:${db.result.mime};base64,${db.result.base64}`,extension:db.result.extension,preview:db.result.extension!=='pcm'}:null;
  register('tts:audio',audio);
  register('tts:use-result',()=>operation(async()=>{
    if(!db.result||db.result.extension!=='wav')throw Error('Bitte zuerst ein WAV erzeugen.');
    await save({...db,reference:{name:'Entworfene Stimme.wav',base64:db.result.base64}});
    return {state:snapshot(),refText:db.result.text};
  }));
  register('tts:export',()=>operation(async()=>{
    if(!db.result)throw Error('Kein Audio vorhanden.');
    const ext=db.result.extension;
    const selected=await dialog.showSaveDialog(window,{title:'Audio speichern',defaultPath:db.exportPath?.endsWith('.'+ext)?db.exportPath:`KAIROS-Sprache.${ext}`,filters:[{name:ext.toUpperCase(),extensions:[ext]}]});
    if(selected.canceled)return {};
    let path=selected.filePath;if(!path.toLowerCase().endsWith('.'+ext))path+='.'+ext;
    await writeFile(path,Buffer.from(db.result.base64,'base64'));await save({...db,exportPath:path});return {path};
  }));
  register('tts:cancel',()=>{controller?.abort();return {ok:true};});
  return {snapshot,get busy(){return busy;},get queue(){return storage.queue;},abort:()=>controller?.abort()};
}
