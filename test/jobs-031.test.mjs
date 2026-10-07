import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {sendChat} from '../src/ollama-client.mjs';
import {sendOpenaiChat} from '../src/openai-client.mjs';
import {JobStore,boundJob} from '../src/job-store.mjs';
import {queryComfyJob,cancelComfyJob,fetchComfyResult} from '../src/comfyui-client.mjs';
import {testCipher} from './test-cipher.mjs';
const profile={id:'comfy',name:'Comfy',type:'comfyui',baseUrl:'https://comfy.example',model:'workflow',enabled:true};
const json=data=>new Response(JSON.stringify(data));
const job={serverId:'own-id',clientId:'own-client',outputNode:'5'};
async function mockFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run()}finally{globalThis.fetch=old}}
async function dir(){const base=fileURLToPath(new URL('../../../work/job-tests-031/',import.meta.url));await mkdir(base,{recursive:true});return mkdtemp(join(base,'case-'))}
for(const type of ['ollama','openai-chat'])test(type+' waits beyond 240 and 300 seconds for one original reply with honest unknown status',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let finish;let calls=0;let sentSignal;const notices=[];
 const p={...profile,type,options:{temperature:0.7,num_predict:100},model:'m'};
 await mockFetch(async(_url,init)=>{calls++;sentSignal=init.signal;assert.ok(init.dispatcher);return new Promise(resolve=>{finish=resolve})},async()=>{
  const pending=(type==='ollama'?sendChat:sendOpenaiChat)([{role:'user',content:'hello'}],{profile:p,onSlow:text=>notices.push(text)});
  t.mock.timers.tick(240001);assert.equal(sentSignal.aborted,false);assert.match(notices[0],/Serverstatus lässt sich nicht prüfen/);assert.equal(calls,1);
  t.mock.timers.tick(90000);assert.equal(calls,1);assert.equal(sentSignal.aborted,false);
  finish(json(type==='ollama'?{done:true,message:{content:'Late answer'}}:{choices:[{finish_reason:'stop',message:{content:'Late answer'}}]}));assert.equal(await pending,'Late answer');
 });
});
test('manual stop and network loss are unknown outcomes and never retry',async()=>{
 for(const cancel of [true,false]){const controller=new AbortController();let calls=0;
  await mockFetch(async(_url,init)=>{calls++;if(!cancel)throw TypeError('fetch failed');return new Promise((_,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});controller.abort()})},async()=>assert.rejects(()=>sendChat([{role:'user',content:'x'}],{profile:{...profile,type:'ollama'},signal:controller.signal}),/Server rechnet möglicherweise weiter/));assert.equal(calls,1);
 }
});
test('accepted job persists encrypted; restart preserves server ID and binding while waiting becomes unknown',async()=>{
 const directory=await dir();const store=new JobStore(directory,testCipher);await store.load();const own=await store.create(profile,'chat','message');await store.update(own.id,{serverId:'own-id',clientId:'own-client',outputNode:'5',state:'running',recoverable:true});
 const bytes=await readFile(store.storage.file);assert.equal(bytes.includes(Buffer.from('own-id')),false);assert.equal(bytes.includes(Buffer.from(profile.baseUrl)),false);
 const reopened=new JobStore(directory,testCipher);await reopened.load();const restored=reopened.get(own.id);assert.equal(restored.state,'unknown');assert.equal(restored.waiting,false);assert.equal(restored.serverId,'own-id');assert.equal(boundJob(restored,profile),true);assert.equal(boundJob(restored,{...profile,baseUrl:'https://foreign.example'}),false);
 const ssh={...profile,ssh:{enabled:true,host:'host',port:22,username:'u',targetHost:'127.0.0.1',targetPort:8000}};const tunneled=await reopened.create(ssh,'c','m');assert.equal(boundJob(tunneled,{...ssh,baseUrl:'http://127.0.0.1:12345'}),true);assert.equal(boundJob(tunneled,{...ssh,ssh:{...ssh.ssh,targetPort:9999}}),false);
});
test('ComfyUI uses only history and queue to recover completed and pending own jobs, without POST prompt',async()=>{
 let requests=[];await mockFetch(async(url,init)=>{requests.push([url,init.method??'GET']);if(url.includes('/history/'))return json({});return json({queue_running:[[0,'foreign-id']],queue_pending:[[1,'own-id',{}, {client_id:'own-client'}]]})},async()=>assert.equal((await queryComfyJob(job,{profile})).state,'queued'));assert.ok(requests.every(([url])=>!url.endsWith('/prompt')));
 requests=[];await mockFetch(async(url,init)=>{requests.push(url);return json({'own-id':{status:{completed:true,status_str:'success'},outputs:{'5':{images:[]}}}})},async()=>assert.equal((await queryComfyJob(job,{profile})).state,'completed'));assert.equal(requests.length,1);
});
test('ComfyUI never interrupts foreign or running jobs and queue removal handles a running race',async()=>{
 for(const running of [true,false]){let deleted=false;let calls=[];
  await mockFetch(async(url,init)=>{calls.push([url,init]);if(url.includes('/history/'))return json({});if(init.method==='POST'){assert.deepEqual(JSON.parse(init.body),{delete:['own-id']});deleted=true;return new Response('')}
   return json({queue_running:running||deleted?[[0,'own-id'],[1,'foreign-id']]:[[1,'foreign-id']],queue_pending:running||deleted?[]:[[2,'own-id']]})},async()=>{const result=await cancelComfyJob(job,{profile});assert.equal(result.confirmed,false);assert.equal(result.state,'running')});assert.ok(calls.every(([url])=>!url.endsWith('/interrupt')&&!url.endsWith('/prompt')));
 }
});
test('ComfyUI targeted pending removal confirms queue disappearance and an execution_interrupted history confirms abort',async()=>{
 let deleted=false;await mockFetch(async(url,init)=>{if(url.includes('/history/'))return json({});if(init.method==='POST'){deleted=true;assert.deepEqual(JSON.parse(init.body),{delete:['own-id']});return new Response('')};return json({queue_running:[[0,'foreign-id']],queue_pending:deleted?[]:[[1,'own-id']]})},async()=>{const result=await cancelComfyJob(job,{profile});assert.equal(result.confirmed,true);assert.equal(result.state,'cancelled')});
 await mockFetch(async()=>json({'own-id':{status:{status_str:'error',messages:[['execution_interrupted',{}]]}}}),async()=>assert.equal((await queryComfyJob(job,{profile})).state,'cancelled'));
});
test('missing server history differs from network loss and deleted image files remain errors',async()=>{
 await mockFetch(async url=>url.endsWith('/queue')?json({queue_running:[],queue_pending:[]}):json({}),async()=>assert.equal((await queryComfyJob(job,{profile})).state,'missing'));
 await mockFetch(async()=>{throw TypeError('network')},async()=>assert.rejects(()=>queryComfyJob(job,{profile})));
 await mockFetch(async()=>new Response('',{status:404}),async()=>assert.rejects(()=>fetchComfyResult(job,{outputs:{'5':{images:[{filename:'expired.png',type:'output'}]}}},{profile}),/404/));
});
