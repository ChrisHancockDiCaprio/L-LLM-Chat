import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {SettingsStore} from '../src/settings-store.mjs';
import {testCipher} from './test-cipher.mjs';
const html = await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
const scripts = await Promise.all(['hancock.js','hancock-panel.js'].map(name=>readFile(new URL('../ui/'+name,import.meta.url),'utf8')));
function setup() {
  const dom = new JSDOM(html,{runScripts:'outside-only',url:new URL('../ui/index.html',import.meta.url).href}); const w=dom.window;
  w.matchMedia=()=>({matches:false}); scripts.forEach(script=>w.eval(script));
  let draft='';let submissions=0;let attachments=0;let navigations=0;
  const state={activeId:'chat',sessions:[{id:'chat',title:'Eigenes Gespräch'}],settings:{activeId:'model',hancock:{visible:true,paused:false},profiles:[{id:'model',enabled:true,type:'openai-chat',name:'Mein Modell',baseUrl:'https://example.com'}]},jobs:[],busy:false,settingsBusy:false};
  const hooks={getDraft:()=>draft,setDraft:value=>{draft=value;w.kairosHancockPanel.syncDraft()},submit:()=>submissions++,attach:()=>attachments++,attachDisabled:()=>false,attachmentNames:()=>[],isCancelling:()=>false,selectProfile:async()=>({ok:true}),savePreferences:async value=>{state.settings.hancock=value;w.kairosHancockPanel.render(state);return {ok:true}},showChat:()=>navigations++,showJobs:()=>{},showTts:()=>navigations++};
  w.kairosHancockPanel.init(hooks);w.kairosHancockPanel.render(state);
  const click=id=>w.document.getElementById('hancock-'+id).click();
  return {dom,w,state,click,counts:()=>({submissions,attachments,navigations}),draft:()=>draft};
}
test('Hancock opening, hovering and typing never sends; explicit submit uses shared draft',()=>{
  const {dom,w,click,counts,draft}=setup();click('show');
  assert.equal(w.document.getElementById('hancock-card').hidden,false);
  const input=w.document.getElementById('hancock-message');input.value='Hallo';input.dispatchEvent(new w.Event('input'));
  assert.equal(draft(),'Hallo');assert.equal(counts().submissions,0);click('send');assert.equal(counts().submissions,1);
  click('close');assert.equal(w.document.getElementById('hancock-card').hidden,true);assert.equal(draft(),'Hallo');dom.window.close();
});
test('busy state disables entry/actions, exposes explicit cancel and settings remain typed',async()=>{
  const {dom,w,state,click,counts}=setup();state.busy=true;w.kairosHancockPanel.render(state);
  assert.equal(w.document.getElementById('hancock-message').disabled,true);
  assert.equal(w.document.getElementById('hancock-send').textContent,'Nicht mehr warten');
  click('send');assert.equal(counts().submissions,1);
  assert.equal(w.document.querySelector('[data-hancock-action=image]').disabled,true);
  state.busy=false;w.kairosHancockPanel.render(state);click('pause');await Promise.resolve();
  assert.equal(state.settings.hancock.paused,true);assert.equal(w.document.getElementById('hancock-pet').hasAttribute('paused'),true);dom.window.close();
});
test('missing image setup explains prerequisites; provider labels and job titles are text, not HTML',()=>{
  const {dom,w,state,click,counts}=setup();click('show');w.document.querySelector('[data-hancock-action=image]').click();
  assert.match(w.document.getElementById('hancock-feedback').textContent,/Bildprofil/);assert.equal(counts().submissions,0);
  state.jobs=[{id:'done',chatId:'chat',providerName:'<img src=x onerror=bad()>',state:'completed'}];w.kairosHancockPanel.render(state);
  assert.equal(w.document.getElementById('hancock-jobs').querySelectorAll('img').length,0);
  assert.equal(w.document.getElementById('hancock-pet').getAttribute('state'),'done');dom.window.close();
});
test('Hancock preferences migrate, persist encrypted and reject malformed input without alteration',async()=>{
  const base=fileURLToPath(new URL('../../.test-output/',import.meta.url));await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,'hancock-'));
  const settings=new SettingsStore(dir,testCipher);await settings.load();assert.deepEqual(settings.db.hancock,{visible:true,paused:false});
  await settings.setHancock({visible:false,paused:true});const restored=new SettingsStore(dir,testCipher);await restored.load();assert.deepEqual(restored.db.hancock,{visible:false,paused:true});
  await assert.rejects(()=>restored.setHancock({visible:'true',paused:false}));assert.deepEqual(restored.db.hancock,{visible:false,paused:true});
});
