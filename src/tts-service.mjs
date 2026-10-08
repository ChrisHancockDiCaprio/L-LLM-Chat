import { SecureFile } from './secure-file.mjs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ttsConnection, ttsCapabilities, ttsRequest, synthesize, validateWav, MAX_AUDIO } from './tts-client.mjs';

export async function registerTts({register,directory,cipher,dialog,window,publish,isLocked}) {
  const storage=new SecureFile(directory,'tts',cipher);
  let db={}; let caps=null; let busy=false; let controller;
  try {db=JSON.parse(await storage.read());if(db.connection)db.connection=ttsConnection(db.connection);
    for(const key of ['reference','result'])if(db[key])validateWav(Buffer.from(db[key].base64,'base64'));
  }catch(error){if(error.code!=='ENOENT')throw Error('Der TTS-Tresor konnte nicht geöffnet werden. Er bleibt erhalten.');}
  const snapshot=()=>({connection:db.connection??null,capabilities:caps,busy,referenceName:db.reference?.name??'',hasResult:Boolean(db.result)});
  const available=()=>{if(busy||isLocked())throw Error('Bitte den laufenden Vorgang abschließen.');};
  async function operation(fn) {
    try{available();}catch(error){return {ok:false,error:error.message};}
    try{busy=true;publish();return {ok:true,...await fn()};}
    catch(error){return {ok:false,error:controller?.signal.aborted?'Warten beendet. Der Server kann weiterrechnen; es wird nichts automatisch erneut gesendet.':error.message};}
    finally{busy=false;controller=undefined;publish();}
  }
  async function save(next) {await storage.write(JSON.stringify(next));db=next;}
  register('tts:connect',raw=>operation(async()=>{
    caps=null;
    const connection=ttsConnection(raw);const capabilities=await ttsCapabilities(connection);
    await save({...db,connection});caps=capabilities;return {state:snapshot()};
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
    const request=ttsRequest(raw,caps,db.reference);controller=new AbortController();
    const bytes=await synthesize(db.connection,request,{signal:controller.signal});
    const result={id:randomUUID(),base64:bytes.toString('base64'),text:request.text};
    await save({...db,result});return {audio:{id:result.id,src:'data:audio/wav;base64,'+result.base64}};
  }));
  register('tts:audio',()=> db.result ? {id:db.result.id,src:'data:audio/wav;base64,'+db.result.base64} : null);
  register('tts:use-result',()=>operation(async()=>{
    if(!db.result)throw Error('Bitte zuerst Sprache erzeugen.');
    await save({...db,reference:{name:'Entworfene Stimme.wav',base64:db.result.base64}});
    return {state:snapshot(),refText:db.result.text};
  }));
  register('tts:export',()=>operation(async()=>{
    if(!db.result)throw Error('Kein Audio vorhanden.');
    const selected=await dialog.showSaveDialog(window,{title:'Sprache als WAV speichern',defaultPath:'KAIROS-Stimme.wav',filters:[{name:'WAV',extensions:['wav']}]});
    if(!selected.canceled)await writeFile(selected.filePath,Buffer.from(db.result.base64,'base64'));return {};
  }));
  register('tts:cancel',()=>{controller?.abort();return {ok:true};});
  return {snapshot,get busy(){return busy;},get queue(){return storage.queue;},abort:()=>controller?.abort()};
}
