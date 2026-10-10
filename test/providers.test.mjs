import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {apiUrl,endpointFields,normalizeApiPath,PROVIDERS} from '../src/api-endpoint.mjs';
import {apiDestination} from '../src/ssh-store.mjs';
import {connectionIdentity,boundJob} from '../src/job-store.mjs';
import {CredentialStore} from '../src/credential-store.mjs';
import {SettingsStore} from '../src/settings-store.mjs';
import {openaiModels,sendOpenaiChat} from '../src/openai-client.mjs';
import {readProviderQuota} from '../src/provider-status.mjs';
import {testCipher} from './test-cipher.mjs';
import {responseLimits,responseUsage} from '../src/response-metadata.mjs';
const profile=(provider='custom')=>({id:'model',type:'openai-chat',provider,...(PROVIDERS[provider]??{baseUrl:'https://test.example',apiPath:'/v1'}),name:'Test',model:'test',enabled:true,options:{num_ctx:8192,num_predict:512,temperature:0.4},capabilities:[]});
async function stores(){const root=fileURLToPath(new URL('../../.test-output/',import.meta.url));await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'providers-'));const credentials=new CredentialStore(dir,testCipher);const settings=new SettingsStore(dir,testCipher);await credentials.load();await settings.load();return {dir,credentials,settings};}
async function withFetch(mock,action){const old=globalThis.fetch;globalThis.fetch=mock;try{return await action();}finally{globalThis.fetch=old;}}

test('provider URLs use the exact official paths and reject traversal, encoded paths and provider impersonation',()=>{
  assert.equal(apiUrl(profile('groq'),'models'),'https://api.groq.com/openai/v1/models');
  assert.equal(apiUrl(profile('openrouter'),'chat/completions'),'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(apiUrl({...profile(),apiPath:'/gateway/v2'},'models'),'https://test.example/gateway/v2/models');
  for(const path of ['//host/v1','/v1/../key','/v1/%2e','/v1?token=x','https://x/v1','/v1#x','/v1/','/v1\\key','/'])assert.throws(()=>normalizeApiPath(path));
  for(const modified of [{baseUrl:'https://evil.example'},{baseUrl:'http://api.groq.com'},{apiPath:'/v1'},{ssh:{enabled:true}}])assert.throws(()=>endpointFields({...profile('groq'),...modified}));
});

test('old generic /v1 credentials and jobs retain identity; path/provider changes require a new binding',async()=>{
  const {credentials}=await stores();const old={...profile()};delete old.provider;delete old.apiPath;
  const ref=await credentials.add(old.baseUrl,{type:'bearer',token:'FIXTURE-LEGACY-KEY'});old.authRef=ref;
  assert.equal(credentials.get(old).token,'FIXTURE-LEGACY-KEY');assert.equal(apiDestination(old),old.baseUrl);
  assert.equal(connectionIdentity(old),connectionIdentity({...old,provider:'custom',apiPath:'/v1'}));
  assert.throws(()=>credentials.get({...old,apiPath:'/other/v1'}),/ander|Ziel/);
  const p={...profile('openrouter'),authRef:ref};assert.throws(()=>credentials.get(p));
  p.authRef=await credentials.add(p.baseUrl,{type:'bearer',token:'FIXTURE-ROUTER-KEY'},apiDestination(p));
  assert.equal(credentials.get(p).token,'FIXTURE-ROUTER-KEY');
  assert.throws(()=>credentials.get({...p,provider:'custom'}),/Ziel/);
  assert.equal(boundJob({connectionIdentity:connectionIdentity(p)},{...p,provider:'custom'}),false);
});

test('profile restart keeps paths encrypted, target changes clear access, and equal model names on different paths remain separate',async()=>{
  const {dir,settings}=await stores();const args={...profile(),enabled:false,name:'Server',models:[{name:'same',type:'openai-chat'}],authRef:'fixture-ref',authType:'bearer'};
  await settings.importServer(args);await settings.importServer({...args,apiPath:'/gateway/v1'});
  assert.equal(settings.db.profiles.length,2);
  const second=settings.db.profiles.find(p=>p.apiPath==='/gateway/v1');await settings.upsert({...second,apiPath:'/changed/v1'});
  assert.equal(settings.db.profiles.find(p=>p.id===second.id).authRef,null);
  const restored=new SettingsStore(dir,testCipher);await restored.load();assert.equal(restored.db.profiles[0].apiPath,'/v1');
  assert.equal((await readFile(settings.file)).includes(Buffer.from('gateway')),false);
});

test('large model catalogues are bounded separately from saved profiles and retain existing selection on refresh',async()=>{
  const {settings}=await stores();const p=profile('openrouter');
  const list=Array.from({length:350},(_,i)=>({id:'model-'+i,architecture:{input_modalities:['text','image']}}));
  const models=await withFetch(async(url,init)=>{assert.equal(url,apiUrl(p,'models'));assert.equal(init.redirect,'error');return new Response(JSON.stringify({data:list}));},()=>openaiModels(p,{type:'bearer',token:'FIXTURE'}));
  assert.equal(models.length,350);assert.ok(models[0].capabilities.includes('vision'));
  await settings.importServer({...p,name:'Router',models});assert.equal(settings.db.profiles.length,100);
  const chosen=settings.db.profiles.at(-1);await settings.toggle(chosen.id,true);await settings.select(chosen.id);
  await settings.importServer({...p,name:'Router',models:models.toReversed()});assert.equal(settings.active.id,chosen.id);assert.equal(settings.db.profiles.length,100);
  await withFetch(async()=>new Response(JSON.stringify({data:Array.from({length:3001},()=>({id:'x'}))})),async()=>assert.rejects(()=>openaiModels(p),/3000/));
});

test('connection discovery and key inspection are GET-only, redact account details, and distinguish unknown quota',async()=>{
  const p=profile('openrouter');let gets=0;
  const quota=await withFetch(async(url,init)=>{gets++;assert.equal(url,apiUrl(p,'key'));assert.equal(init.method,undefined);assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer FIXTURE');return new Response(JSON.stringify({data:{label:'PRIVATE-LABEL',hash:'PRIVATE-HASH',is_free_tier:true,limit:null,limit_remaining:0,usage:0,free_model_daily_requests:{limit:50,used:12,remaining:38},usage_daily:12}}));},()=>readProviderQuota(p,{type:'bearer',token:'FIXTURE'}));
  assert.equal(gets,1);assert.equal(quota.creditLimit,null);assert.equal(quota.creditRemaining,0);assert.equal(quota.freeDailyLimit,50);
  assert.equal(JSON.stringify(quota).includes('PRIVATE'),false);assert.equal(quota.freeDailyRemaining,38);assert.equal(quota.freeDailyUsed,12);
  await withFetch(async()=>new Response(JSON.stringify({data:{usage_daily:999,is_free_tier:false,free_model_daily_requests:50}})),async()=>{const unknown=await readProviderQuota(p,{type:'bearer',token:'FIXTURE'});assert.equal(unknown.freeDailyRemaining,null);assert.equal(unknown.freeDailyLimit,null);});
  await withFetch(async()=>{throw Error('MUST NOT FETCH');},async()=>assert.equal((await readProviderQuota(profile('groq'))).state,'unknown'));
  await withFetch(async()=>new Response('SECRET-ERROR',{status:401}),async()=>assert.rejects(()=>readProviderQuota(p,{type:'bearer',token:'FIXTURE'}),error=>!error.message.includes('SECRET-ERROR')&&error.message.includes('401')));
});

test('both provider adapters send only to the configured endpoint without redirects or extra calls',async()=>{
  for(const id of ['groq','openrouter']){
    let calls=0;const p=profile(id);
    await withFetch(async(url,init)=>{calls++;assert.equal(url,apiUrl(p,'chat/completions'));assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer FIXTURE');assert.equal(JSON.parse(init.body).model,'test');return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Fixture reply'}}]}));},async()=>assert.equal(await sendOpenaiChat([{role:'user',content:'Hello'}],{profile:p,auth:{type:'bearer',token:'FIXTURE'}}),'Fixture reply'));
    assert.equal(calls,1);
  }
});

test('provider usage and rate headers expose only bounded numeric values, including a real zero',()=>{
  assert.deepEqual(responseUsage({prompt_tokens:8,completion_tokens:4,total_tokens:12,cost:0,private_label:'secret'}),{promptTokens:8,completionTokens:4,totalTokens:12,reportedCost:0});
  assert.deepEqual(responseUsage({prompt_tokens:-1,completion_tokens:1.5,total_tokens:'12',cost:Infinity}),{promptTokens:null,completionTokens:null,totalTokens:null,reportedCost:null});
  const limits=responseLimits(new Response('',{headers:{'x-ratelimit-remaining-requests':'0','x-ratelimit-remaining-tokens':'secret','retry-after':'999999'}}));
  assert.equal(limits.requestsRemaining,0);assert.equal(limits.tokensRemaining,null);assert.equal(limits.retryAfterSeconds,86400);
  const unknown=responseLimits(new Response(''));assert.equal(unknown.requestsRemaining,null);assert.equal(unknown.retryAfterSeconds,null);
});

test('rate limit response reports wait time without exposing the error body or resubmitting generation',async()=>{
  let calls=0;let headers;
  await withFetch(async()=>{calls++;return new Response('SECRET-ERROR-BODY',{status:429,headers:{'retry-after':'15','x-ratelimit-remaining-requests':'0'}});},async()=>assert.rejects(()=>sendOpenaiChat([{role:'user',content:'Hello'}],{profile:profile('groq'),auth:{type:'bearer',token:'FIXTURE'},onHeaders:value=>{headers=value;}}),error=>error.message.includes('15 Sekunden')&&!error.message.includes('SECRET-ERROR-BODY')));
  assert.equal(calls,1);assert.equal(headers.requestsRemaining,0);
});
