import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {SettingsStore} from './settings-store.mjs';
import {SessionStore} from './session-store.mjs';

export async function verifyProviders({window,store,settings,cipher,dataDir,publish,snapshot}) {
  const run=code=>window.webContents.executeJavaScript(code);
  const call=(method,...args)=>run(`window.qwenChat.${method}(...${JSON.stringify(args)})`);
  const until=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Provider verification timeout');};
  const originalFetch=globalThis.fetch;let posts=0;let keys=0;let gets=0;
  globalThis.fetch=async(url,init)=>{
    assert.equal(init.redirect,'error');
    assert.ok(url.startsWith('https://openrouter.ai/api/v1/')||url.startsWith('https://api.groq.com/openai/v1/'));
    assert.equal(init.headers.Authorization,'Bearer PROVIDER-FIXTURE-KEY');
    if(url.endsWith('/models')){gets++;return new Response(JSON.stringify({data:[{id:'fixture-a'},{id:'fixture-b'}]}));}
    if(url.endsWith('/key')){keys++;assert.equal(init.method,undefined);return new Response(JSON.stringify({data:{label:'PRIVATE-ACCOUNT-LABEL',hash:'PRIVATE-HASH',limit:null,limit_remaining:0,is_free_tier:true,free_model_daily_requests:{limit:50,used:12,remaining:38}}}));}
    assert.ok(url.endsWith('/chat/completions'));assert.equal(init.method,'POST');posts++;
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Antwort aus dem getrennten Anbietertest.'}}],usage:{prompt_tokens:8,completion_tokens:4,total_tokens:12,cost:0}}),{headers:{'x-ratelimit-remaining-requests':'99','x-ratelimit-remaining-tokens':'1234'}});
  };
  try {
    await settings.commit({version:1,activeId:null,profiles:[]});await store.create();publish();
    await until(()=>run('document.querySelector("#provider-catalog").textContent.includes("OpenRouter")'));
    await run('document.querySelector("#settings-button").click();document.querySelector("#provider-offers").open=true;Array.from(document.querySelectorAll(".provider-offer")).find(n=>n.querySelector("h3").textContent==="OpenRouter").querySelector(".server-actions button:last-child").click()');
    assert.equal(await run('document.querySelector("#server-url").value'),'https://openrouter.ai');
    assert.equal(await run('document.querySelector("#server-api-path").value'),'/api/v1');
    assert.equal(await run('document.querySelector("#server-url").readOnly'),true);
    await run('document.querySelector("#server-secret").value="PROVIDER-FIXTURE-KEY";document.querySelector("#server-model-names").value="fixture-b";document.querySelector("#server-form").requestSubmit()');
    await until(()=>settings.db.profiles.length===1);await until(()=>run('document.querySelector("#server-form").hidden'));
    assert.equal(settings.db.profiles[0].model,'fixture-b');assert.equal(settings.db.profiles[0].enabled,false);assert.equal(posts,0);assert.equal(keys,0);assert.equal(gets,1);
    assert.equal(await run('document.querySelector("#server-secret").value'),'');
    const router=settings.db.profiles[0];
    assert.equal((await call('checkProviderQuota',router.id)).ok,true);assert.equal(keys,1);assert.equal(posts,0);
    await until(()=>run('document.querySelector("#provider-catalog").textContent.includes("38")'));
    const projected=JSON.stringify(await call('state'));assert.ok(!projected.includes('PROVIDER-FIXTURE-KEY'));assert.ok(!projected.includes('PRIVATE-ACCOUNT'));assert.ok(!projected.includes('PRIVATE-HASH'));
    const before=gets;
    const refused=await call('addServer',{id:router.id,type:'openai-chat',provider:'custom',apiPath:'/changed/v1',baseUrl:router.baseUrl,name:'Wrong target',useStoredAuth:true,auth:{type:'bearer'}});
    assert.equal(refused.ok,false);assert.equal(gets,before);
    assert.equal((await call('addServer',{type:'openai-chat',provider:'openrouter',apiPath:'/api/v1',baseUrl:'https://other.example',name:'Wrong origin',auth:{type:'bearer',token:'PROVIDER-FIXTURE-KEY'}})).ok,false);assert.equal(gets,before);
    assert.equal((await call('toggleProfile',router.id,true)).ok,true);assert.equal((await call('selectProfile',router.id)).ok,true);assert.equal(posts,0);
    assert.equal((await call('send','Anbieter-Test')).ok,true);assert.equal(posts,1);assert.equal(store.active.messages.at(-1).usage.totalTokens,12);
    await until(()=>run('document.querySelector("#messages").textContent.includes("12 Tokens")'));
    const groqRequest={type:'openai-chat',provider:'groq',apiPath:'/openai/v1',baseUrl:'https://api.groq.com',name:'Groq',modelNames:['fixture-a'],auth:{type:'bearer',token:'PROVIDER-FIXTURE-KEY'}};
    assert.equal((await call('addServer',groqRequest)).ok,true);const groq=settings.db.profiles.find(p=>p.provider==='groq');
    assert.equal((await call('toggleProfile',groq.id,true)).ok,true);assert.equal((await call('selectProfile',groq.id)).ok,true);
    assert.equal((await call('send','Groq-Test')).ok,true);assert.equal(posts,2);assert.equal(keys,1);
    assert.equal(snapshot().providerQuota[groq.id].requestsRemaining,99);assert.equal(snapshot().providerQuota[groq.id].tokensRemaining,1234);
    const restoredSettings=new SettingsStore(dataDir,cipher);await restoredSettings.load();assert.equal(restoredSettings.db.profiles.find(p=>p.provider==='groq').apiPath,'/openai/v1');
    const restoredHistory=new SessionStore(dataDir,cipher);await restoredHistory.load();assert.equal(restoredHistory.active.messages.at(-1).usage.totalTokens,12);
    assert.equal((await readFile(join(dataDir,'history.vault'))).includes(Buffer.from('Anbieter-Test')),false);
    assert.equal((await readFile(join(dataDir,'credentials.vault'))).includes(Buffer.from('PROVIDER-FIXTURE-KEY')),false);
    assert.equal(await run('typeof require'),'undefined');
    await run('document.querySelector("#settings-button").click();document.querySelector("#provider-offers").open=true');
    await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(r=>setTimeout(r,300));
    await writeFile(join(dataDir,'providers-integrated.png'),(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
    const report={presets:true,modelSelection:true,disabledOnImport:true,getOnlyChecks:true,quotaProjection:true,keyTargetBinding:true,usagePersisted:true,groqHeaders:true,encrypted:true,rendererIsolated:true,fixturePosts:posts,fixtureKeyChecks:keys,liveProviderRequests:0};
    await writeFile(join(dataDir,'verification-providers.json'),JSON.stringify(report,null,2)+'\n');return report;
  }finally{globalThis.fetch=originalFetch;}
}
