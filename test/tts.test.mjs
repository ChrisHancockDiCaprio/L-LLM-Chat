import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const tmpdir = () => fileURLToPath(new URL('../../.test-output/', import.meta.url));
import {join} from 'node:path';
import {ttsConnection,ttsCapabilities,ttsRequest,synthesize,validateWav,boundedBody} from '../src/tts-client.mjs';
import {registerTts} from '../src/tts-service.mjs';
import {testCipher} from './test-cipher.mjs';
export function wav() {
  const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;
}
const caps={protocol:'kairos-qwen-tts-v1',modes:[
  {id:'custom',model:'CustomVoice-0.6B',languages:['auto','german'],speakers:['ryan'],instruction:false},
  {id:'design',model:'VoiceDesign',languages:['german'],speakers:[],instruction:true},
  {id:'clone',model:'Base',languages:['german'],speakers:[],instruction:false},
]};
const profile={baseUrl:'http://127.0.0.1:8860',allowHttp:true};
test('TTS request is capability-bound, defaults are omitted and clone requires a transcript except x-vector mode',()=>{
  const raw={mode:'custom',text:'Hallo',language:'german',speaker:'ryan',instruct:''};
  assert.deepEqual(ttsRequest(raw,caps),{mode:'custom',text:'Hallo',language:'german',speaker:'ryan'});
  assert.throws(()=>ttsRequest({...raw,instruct:'warm'},caps),/Stil/);
  assert.throws(()=>ttsRequest({...raw,language:'klingon'},caps));assert.throws(()=>ttsRequest(raw,null));
  assert.throws(()=>ttsRequest({mode:'design',text:'Hi',language:'german',instruct:''},caps));
  const clone={mode:'clone',text:'Hi',language:'german'};
  assert.throws(()=>ttsRequest(clone,caps),/Referenz/);assert.throws(()=>ttsRequest(clone,caps,{base64:'ref'}),/Transkript/);
  assert.equal(ttsRequest({...clone,x_vector_only_mode:true},caps,{base64:'ref'}).ref_text,undefined);
  assert.throws(()=>ttsRequest({...raw,advanced:true,temperature:NaN},caps));
});
test('TTS transport enforces private HTTP opt-in, protocol, bounded WAV, no redirects, no retry and caller cancellation',async()=>{
  assert.throws(()=>ttsConnection({baseUrl:'http://example.com',allowHttp:true}));assert.throws(()=>ttsConnection({baseUrl:profile.baseUrl}));
  let calls=0;
  const scanned=await ttsCapabilities(profile,{fetchImpl:async(url,init)=>{assert.equal(init.redirect,'error');return new Response(JSON.stringify(caps));}});assert.equal(scanned.modes.length,3);
  await assert.rejects(()=>ttsCapabilities(profile,{fetchImpl:async()=>new Response('{"modes":[]}')}));
  assert.deepEqual(await synthesize(profile,{text:'Hi'},{fetchImpl:async(url,init)=>{calls++;assert.equal(init.redirect,'error');assert.ok(url.endsWith('/v1/tts/generate'));return new Response(wav(),{headers:{'content-type':'audio/wav'}});}}),wav());
  await assert.rejects(()=>synthesize(profile,{}, {fetchImpl:async()=>{calls++;return new Response('bad',{status:500});}}));assert.equal(calls,2);
  await assert.rejects(()=>synthesize(profile,{}, {fetchImpl:async()=>new Response('bad',{headers:{'content-type':'text/html'}})}));
  assert.throws(()=>validateWav(Buffer.from('RIFFbad')));const broken=wav();broken.writeUInt32LE(100,40);assert.throws(()=>validateWav(broken));
  await assert.rejects(()=>boundedBody(new Response('12345'),4));
  const controller=new AbortController();controller.abort();await assert.rejects(()=>synthesize(profile,{}, {signal:controller.signal,fetchImpl:async(_,init)=>{init.signal.throwIfAborted();}}),{name:'AbortError'});
});
test('TTS service persists encrypted references/results, reloads, exports and prevents simultaneous operations',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'kairos-tts-'));const handlers={};const original=globalThis.fetch;
  let resolveScan;
  globalThis.fetch=async url=>url.endsWith('/capabilities')?new Response(JSON.stringify(caps)):new Response(wav(),{headers:{'content-type':'audio/wav'}});
  const exportPath=join(directory,'export.wav');
  const args={register:(name,fn)=>{handlers[name]=fn;},directory,cipher:testCipher,window:{},publish:()=>{},isLocked:()=>false,
    dialog:{showOpenDialog:async()=>({canceled:true}),showSaveDialog:async()=>({canceled:false,filePath:exportPath})}};
  try{
    const service=await registerTts(args);assert.equal((await handlers['tts:connect'](profile)).ok,true);
    assert.equal((await handlers['tts:generate']({mode:'design',text:'PRIVATE-SPEECH',language:'german',instruct:'warm'})).ok,true);
    assert.equal((await handlers['tts:use-result']()).refText,'PRIVATE-SPEECH');assert.equal((await handlers['tts:export']()).ok,true);assert.deepEqual(await readFile(exportPath),wav());
    assert.equal((await readFile(join(directory,'tts.vault'))).includes(Buffer.from('PRIVATE-SPEECH')),false);
    const restored=await registerTts(args);assert.ok(restored.snapshot().hasResult);assert.ok(restored.snapshot().referenceName);assert.equal(restored.snapshot().capabilities,null);
    globalThis.fetch=async()=>new Promise(resolve=>{resolveScan=()=>resolve(new Response(JSON.stringify(caps)));});
    const pending=handlers['tts:connect'](profile);assert.equal(restored.busy,true);assert.equal((await handlers['tts:clear-reference']()).ok,false);assert.equal(restored.busy,true);
    resolveScan();await pending;assert.equal(restored.busy,false);assert.equal((await handlers['tts:clear-reference']()).ok,true);assert.equal(restored.snapshot().referenceName,'');
    await service.queue;
  }finally{globalThis.fetch=original;}
});
