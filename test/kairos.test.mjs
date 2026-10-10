import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { WorkflowStore } from '../src/workflow-store.mjs';
import { prepareComfyWorkflow, validateWorkflow } from '../src/comfyui-client.mjs';
import { SettingsStore } from '../src/settings-store.mjs';
import { SessionStore } from '../src/session-store.mjs';
import { AttachmentStore } from '../src/attachments.mjs';
import { SecureFile } from '../src/secure-file.mjs';
import { UpdateManager } from '../src/update-manager.mjs';
import { testCipher } from './test-cipher.mjs';
const graph = { '31': { class_type: 'Encode', inputs: { text: 'EXAMPLE-ONLY' } }, '57': { class_type: 'Sampler', inputs: { cfg: 4, seed: 5 } }, '90': { class_type: 'SaveImage', inputs: { images: ['57',0] } } };
const mapping = { prompt: {nodeId:'31',input:'text'}, cfg: {nodeId:'57',input:'cfg'}, outputNode:'90' };
const profile = {id:'first-profile',type:'comfyui',baseUrl:'https://comfy.example'};
async function directory() { const base=fileURLToPath(new URL('../../.test-output/kairos-tests/',import.meta.url)); await mkdir(base,{recursive:true}); return mkdtemp(join(base,'case-')); }
test('independent workflow profiles on one server, optional CFG, limits and per-job copies', async()=>{
 const dir=await directory();const store=new WorkflowStore(dir,testCipher);await store.load();
 await store.import(profile,'first',graph);await store.configure(profile,mapping,{cfg:4},{cfg:{min:1,max:10,step:0.5}});
 const second={...profile,id:'second-profile'};await store.import(second,'second',graph);
 assert.equal(store.summary(second).ready,false);assert.equal(store.summary(profile).ready,true);
 assert.equal(store.get(profile).nodes['31'].inputs.text,''); assert.deepEqual(Object.keys(store.summary(profile).options),['cfg']);
 const before=store.get(profile);const job=prepareComfyWorkflow(before,'PRIVATE-JOB',{cfg:5});
 assert.equal(job.nodes['31'].inputs.text,'PRIVATE-JOB');assert.equal(job.nodes['57'].inputs.cfg,5);assert.equal(job.nodes['57'].inputs.seed,5);
 assert.equal(store.get(profile).nodes['31'].inputs.text,'');assert.throws(()=>prepareComfyWorkflow(before,'x',{cfg:10.5}));
 assert.throws(()=>prepareComfyWorkflow(before,'x',{cfg:4.25}));
 const disk=await readFile(store.storage.file);assert.equal(disk.includes(Buffer.from('EXAMPLE-ONLY')),false);assert.equal(disk.includes(Buffer.from('PRIVATE-JOB')),false);
 const reopened=new WorkflowStore(dir,testCipher);await reopened.load([profile,second]);assert.equal(reopened.summary(profile).ready,true);
 await reopened.collectUnused([second]);assert.equal(reopened.summary(profile),null);assert.ok(reopened.summary(second));
});
test('portable profile import validates origin and separates credentials from workflow nodes',async()=>{
 const store=new WorkflowStore(await directory(),testCipher);await store.load();
 await store.import(profile,'bundle',{backendType:'comfyui',baseUrl:profile.baseUrl,nodes:graph,mapping,options:{cfg:6},limits:{cfg:{min:0,max:8,step:0.5}},name:'Model B'});
 assert.equal(store.summary(profile).name,'Model B');assert.equal(store.get(profile).nodes['31'].inputs.text,'');
 await assert.rejects(()=>store.import(profile,'bad',{backendType:'ollama',baseUrl:profile.baseUrl,nodes:graph}));
 await assert.rejects(()=>store.import(profile,'bad',{backendType:'comfyui',baseUrl:'https://other.example',nodes:graph}));
 assert.throws(()=>validateWorkflow({'1':{class_type:'API',inputs:{api_key:'SECRET'}}}),/Zugangsdaten/);
});
test('legacy workflows migrate to distinct IDs without changing chats or retaining mapped example text',async()=>{
 const dir=await directory();await new SecureFile(dir,'workflows',testCipher).write(JSON.stringify({version:1,entries:{[profile.baseUrl]:{name:'legacy',nodes:graph,mapping,options:{cfg:4}}}}));
 const store=new WorkflowStore(dir,testCipher);const second={...profile,id:'other-profile'};await store.load([profile,second]);
 assert.equal(store.db.version,2);assert.equal(store.get(profile).nodes['31'].inputs.text,'');
 await store.import(second,'replacement',graph);assert.equal(store.summary(profile).ready,true);
});
test('upload permissions survive restart and omit disabled attachments from context',async()=>{
 const dir=await directory();const settings=new SettingsStore(dir,testCipher);await settings.load();await settings.upsert({...profile,id:undefined,name:'Image',model:'workflow',enabled:false,uploads:{files:false,photos:false}});
 const saved=settings.snapshot().profiles[0];await settings.duplicateImageProfile(saved.id);assert.equal(settings.db.profiles.length,2);
 const restored=new SettingsStore(dir,testCipher);await restored.load();assert.deepEqual(restored.db.profiles[0].uploads,{files:false,photos:false});
 const a=new AttachmentStore(dir,testCipher);a.items.set('text',{id:'text',kind:'text',text:'PRIVATE-ATTACHMENT',name:'file.txt'});a.items.set('photo',{id:'photo',kind:'image',base64:'bytes'});
 assert.deepEqual(a.wireMessage({role:'user',content:'hello',attachmentIds:['text','photo']},saved),{role:'user',content:'hello'});
});
test('chat deletion persists, preserves other chats and removes only unreferenced attachment vaults',async()=>{
 const dir=await directory();const history=new SessionStore(dir,testCipher);await history.load();const removed=history.active.id;await history.create();const kept=history.active.id;
 const files=new AttachmentStore(dir,testCipher); const orphan='00000000-0000-0000-0000-000000000001';const shared='00000000-0000-0000-0000-000000000002';
 for(const id of [orphan,shared]) {files.items.set(id,{id,kind:'text',text:'private',name:'x.txt'});await files.persist([id]);}
 await history.remove(removed);assert.equal(history.active.id,kept);await files.collectUnused([{attachmentIds:[shared]}]);assert.deepEqual((await readdir(dir)).filter(n=>n.startsWith('attachment-')),['attachment-'+shared+'.vault']);
 const restored=new SessionStore(dir,testCipher);await restored.load();assert.equal(restored.db.sessions.length,1);
 const old=restored.active.id; const write=restored.storage.write;restored.storage.write=async()=>{throw Error('disk full')};await assert.rejects(()=>restored.remove(old));assert.equal(restored.active.id,old);restored.storage.write=write;
 await restored.remove(old);assert.notEqual(restored.active.id,old);assert.equal(restored.active.messages.length,0);
});
test('beta selects highest newer version across stable, alpha and custom prerelease labels; hides drafts and older versions',async()=>{
 const u=new EventEmitter();u.setFeedURL=feed=>{u.feed=feed};u.checkForUpdates=async()=>u.emit('update-available',{version:'0.5.0-preview.2'});
 const source={provider:'github',owner:'Owner',repo:'Repo'};const manager=new UpdateManager({updater:u,packaged:true,source,version:'0.3.0'});
 assert.equal((await manager.saveBeta(true,async()=>{})).ok,true);assert.equal(manager.snapshot().beta,true);
 const fetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify([
  {tag_name:'v0.4.0',draft:false,prerelease:false,assets:[{name:'latest.yml'},{name:'KAIROS.exe'}]},
  {tag_name:'v0.5.0-preview.2',draft:false,prerelease:true,assets:[{name:'latest.yml'},{name:'KAIROS.exe'}]},
  {tag_name:'v0.6.0-alpha.1',draft:false,prerelease:true,assets:[]},
  {tag_name:'v9.0.0',draft:true,assets:[]},{tag_name:'v0.2.9',draft:false,assets:[]}
 ]));
 try{assert.equal((await manager.check()).ok,true);assert.equal(manager.snapshot().targetVersion,'0.6.0-alpha.1');assert.equal(manager.snapshot().releases.length,3);
 assert.equal((await manager.saveBeta(false,async()=>{})).ok,true);assert.equal(manager.snapshot().beta,false);assert.equal(manager.snapshot().targetVersion,null);
 await assert.rejects(async()=>{const value=await manager.saveBeta(true,async()=>{throw Error('disk')});assert.ok(value.ok)});
 assert.equal(manager.snapshot().beta,false);
 }finally{globalThis.fetch=fetch}
});
