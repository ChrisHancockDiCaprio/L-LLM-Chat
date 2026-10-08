import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SecureFile} from '../src/secure-file.mjs';
import {testCipher} from './test-cipher.mjs';
import {registerTts} from '../src/tts-service.mjs';
import {providerConnection,providerCapabilities,providerRequest,providerSynthesize,speechPath,foundryPath,speechVoice,validateSsml,pythonExample,publicConnection} from '../src/tts-providers.mjs';

const key='FAKE-AZURE-KEY';
const speech={...providerConnection({provider:'azure-speech',baseUrl:'https://resource.cognitiveservices.azure.com'}),key};
const foundry={...providerConnection({provider:'azure-foundry',baseUrl:'https://resource.openai.azure.com',deployment:'my-tts',model:'gpt-4o-mini-tts'}),key};
const voices=[{ShortName:'de-DE-KatjaNeural',Locale:'de-DE',StyleList:['cheerful'],RolePlayList:['YoungAdultFemale']},
  {ShortName:'de-DE-Seraphina:DragonHDLatestNeural',Locale:'de-DE'},
  {ShortName:'en-US-Ava:DragonHDOmniLatestNeural',Locale:'en-US',SecondaryLocaleList:['de-DE'],StyleList:['excited']}];
const caps={voices:voices.map(speechVoice),ssml:true};
const raw={text:'Hallo <Welt> & alle',speaker:'de-DE-KatjaNeural',language:'de-DE',speed:1.2,pitch:5,volume:70,style:'cheerful',role:'YoungAdultFemale'};
const ssml='<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="de-DE"><voice name="de-DE-KatjaNeural">Hallo</voice></speak>';
function wav(){const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;}
test('Speech resources and regional TTS endpoints use distinct paths; Foundry uses explicit deployment',()=>{
  assert.equal(speechPath(speech,'generate'),'https://resource.cognitiveservices.azure.com/tts/cognitiveservices/v1');
  const regional=providerConnection({provider:'azure-speech',region:'westeurope'});
  assert.equal(speechPath(regional,'voices'),'https://westeurope.tts.speech.microsoft.com/cognitiveservices/voices/list');
  assert.equal(foundryPath(foundry),'https://resource.openai.azure.com/openai/deployments/my-tts/audio/speech?api-version=2025-04-01-preview');
  for(const baseUrl of ['http://resource.example','https://user:secret@resource.example','https://resource.example/api/projects/test'])assert.throws(()=>providerConnection({...speech,baseUrl}));
  assert.throws(()=>providerConnection({...speech,deployment:'custom'}));
  assert.equal(publicConnection(speech).key,undefined);assert.equal(publicConnection(speech).hasKey,true);
  assert.ok(!pythonExample(speech).includes(key));assert.ok(!pythonExample(foundry).includes(key));
});
test('Voice capabilities gate language, prosody, styles, roles and HD parameters; XML text is escaped',()=>{
  const request=providerRequest(speech,raw,caps);
  assert.match(request.body,/Hallo &lt;Welt&gt; &amp; alle/);assert.match(request.body,/rate="1.2"/);assert.match(request.body,/role="YoungAdultFemale"/);
  assert.throws(()=>providerRequest(speech,{...raw,language:'en-US'},caps));
  assert.throws(()=>providerRequest(speech,{...raw,style:'angry'},caps));
  assert.throws(()=>providerRequest(speech,{...raw,speed:2.1},caps));
  const hd={text:'Hallo',speaker:voices[1].ShortName,language:'de-DE',temperature:0.7};
  assert.match(providerRequest(speech,hd,caps).body,/parameters="temperature=0.7"/);
  for(const field of ['pitch','speed','volume','top_p'])assert.throws(()=>providerRequest(speech,{...hd,[field]:1},caps));
  assert.throws(()=>providerRequest(speech,{...hd,style:'cheerful'},caps));
  const omni={...hd,speaker:voices[2].ShortName,top_p:0.7,top_k:22,cfg_scale:1.4,style:'excited'};
  assert.match(providerRequest(speech,omni,caps).body,/cfg_scale=1.4/);
  assert.throws(()=>providerRequest(speech,{...omni,top_k:2.5},caps));
});
test('SSML remains unchanged; malformed XML, DTD, remote assets, unknown voices and unsupported HD tags are rejected',()=>{
  assert.equal(providerRequest(speech,{inputMode:'ssml',text:ssml},caps).body,ssml);
  for(const text of [ssml.replace('</voice>',''),ssml.replace('KatjaNeural','MissingNeural'),ssml.replace('Hallo','<audio src="https://remote.example/a.wav"/>'),ssml.replace('Hallo','<lexicon uri="file:///secret"/>'),'<!DOCTYPE speak [<!ENTITY x "y">]>'+ssml,ssml.replace('<voice','<voice junk=bad')])assert.throws(()=>validateSsml(text,caps));
  assert.throws(()=>validateSsml(ssml.replace('KatjaNeural','Seraphina:DragonHDLatestNeural').replace('Hallo','<prosody pitch="5%">Hallo</prosody>'),caps));
});
test('Speech voice discovery is authenticated, bounded and cancellable; Foundry does not make a paid connection probe',async()=>{
  let calls=0;
  const scanned=await providerCapabilities(speech,{fetchImpl:async(url,init)=>{calls++;assert.equal(url,speechPath(speech,'voices'));assert.equal(init.headers['Ocp-Apim-Subscription-Key'],key);assert.equal(init.redirect,'error');return new Response(JSON.stringify(voices));}});
  assert.equal(scanned.voices.length,3);assert.equal(scanned.voices[1].prosody,false);
  const fc=await providerCapabilities(foundry,{fetchImpl:()=>{throw Error('should not call');}});assert.equal(fc.ssml,false);assert.equal(fc.verified,false);
  assert.equal(calls,1);
  await assert.rejects(()=>providerCapabilities(speech,{fetchImpl:async()=>new Response('[]')}));
});
test('Foundry text requests separate deployment/model, never accept SSML/prosody and gate instructions',async()=>{
  const fc=await providerCapabilities(foundry);
  const request=providerRequest(foundry,{text:'Hallo',speaker:'coral',speed:1.5,instruct:'warm',format:'wav'},fc);
  assert.deepEqual(request.body,{model:'my-tts',input:'Hallo',voice:'coral',speed:1.5,instructions:'warm',response_format:'wav'});
  for(const extra of [{inputMode:'ssml'},{pitch:0},{language:'de-DE'},{speed:4.1}])assert.throws(()=>providerRequest(foundry,{text:'Hallo',speaker:'coral',...extra},fc));
  const old={...foundry,model:'tts-1'};const oldCaps=await providerCapabilities(old);
  assert.throws(()=>providerRequest(old,{text:'Hallo',speaker:'alloy',instruct:'warm'},oldCaps));
  assert.throws(()=>providerRequest(old,{text:'Hallo',speaker:'coral'},oldCaps));
});
test('Azure generation uses provider-specific headers/body and detects non-audio; errors/cancellation never retry',async()=>{
  const request=providerRequest(speech,raw,caps);let calls=0;
  const bytes=await providerSynthesize(speech,request,{fetchImpl:async(url,init)=>{calls++;assert.equal(init.headers['Content-Type'],'application/ssml+xml');assert.equal(init.headers['X-Microsoft-OutputFormat'],request.format);assert.equal(init.body,request.body);assert.equal(init.redirect,'error');return new Response(wav(),{headers:{'content-type':'audio/wav'}});}});
  assert.deepEqual(bytes,wav());
  await assert.rejects(()=>providerSynthesize(speech,request,{fetchImpl:async()=>{calls++;return new Response(key,{status:401});}}),error=>/401/.test(error.message)&&!error.message.includes(key));
  assert.equal(calls,2);
  await assert.rejects(()=>providerSynthesize(speech,request,{fetchImpl:async()=>new Response('<html>wrong</html>',{headers:{'content-type':'audio/wav'}})}));
  const controller=new AbortController();controller.abort();await assert.rejects(()=>providerSynthesize(speech,request,{signal:controller.signal,fetchImpl:async(_,init)=>{init.signal.throwIfAborted();}}));
});
test('Encrypted service saves keys without renderer leakage, binds them to endpoints, imports SSML and preserves providers',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'kairos-azure-'));const handlers={};const original=globalThis.fetch;
  const input=join(directory,'input.ssml');await writeFile(input,ssml);
  const output=join(directory,'output');
  globalThis.fetch=async url=>url.endsWith('/list')?new Response(JSON.stringify(voices)):new Response(wav(),{headers:{'content-type':'audio/wav'}});
  const args={register:(name,fn)=>{handlers[name]=fn;},directory,cipher:testCipher,window:{},publish:()=>{},isLocked:()=>false,dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[input]}),showSaveDialog:async()=>({canceled:false,filePath:output})}};
  try {
    const service=await registerTts(args);
    assert.equal((await handlers['tts:connect']({...speech,apiKey:key})).ok,true);
    assert.ok(!JSON.stringify(service.snapshot()).includes(key));assert.ok(!(await readFile(join(directory,'tts.vault'))).includes(Buffer.from(key)));
    assert.equal((await handlers['tts:import']()).text,ssml);
    assert.equal((await handlers['tts:generate']({...raw,provider:'azure-speech'})).ok,true);
    assert.equal((await handlers['tts:export']()).path,output+'.wav');assert.deepEqual(await readFile(output+'.wav'),wav());
    const before=service.snapshot().connection;
    assert.equal((await handlers['tts:connect']({...speech,baseUrl:'https://other.cognitiveservices.azure.com'})).ok,false);
    assert.deepEqual(service.snapshot().connection,before);
    assert.equal((await handlers['tts:connect']({...foundry,apiKey:key})).ok,true);
    assert.equal((await handlers['tts:import']()).ok,false);
    assert.equal((await handlers['tts:select']('azure-speech')).ok,true);
    const restored=await registerTts(args);assert.equal(restored.snapshot().connection.hasKey,true);assert.equal(restored.snapshot().capabilities,null);assert.ok(!JSON.stringify(restored.snapshot()).includes(key));
  }finally{globalThis.fetch=original;}
});
test('Corrupt TTS vault stays untouched and fails locally without preventing app registration',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'kairos-tts-corrupt-'));const file=join(directory,'tts.vault');await writeFile(file,'corrupt');const handlers={};
  const service=await registerTts({register:(name,fn)=>{handlers[name]=fn;},directory,cipher:testCipher,dialog:{},window:{},publish:()=>{},isLocked:()=>false});
  assert.match(service.snapshot().unavailable,/Chat/);assert.equal((await handlers['tts:select']('qwen')).ok,false);assert.equal(await readFile(file,'utf8'),'corrupt');
});
test('Old Qwen configuration/reference/result migrates without plaintext or audio loss',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'kairos-tts-legacy-'));const storage=new SecureFile(directory,'tts',testCipher);
  await storage.write(JSON.stringify({connection:{baseUrl:'http://127.0.0.1:8860',allowHttp:true},result:{id:'old',base64:wav().toString('base64'),text:'legacy'},reference:{name:'old.wav',base64:wav().toString('base64')}}));
  const handlers={};const service=await registerTts({register:(name,fn)=>{handlers[name]=fn;},directory,cipher:testCipher,dialog:{},window:{},publish:()=>{},isLocked:()=>false});
  assert.equal(service.snapshot().provider,'qwen');assert.equal(service.snapshot().resultFormat,'wav');assert.equal(service.snapshot().referenceName,'old.wav');assert.match(handlers['tts:audio']().src,/^data:audio\/wav/);
});
