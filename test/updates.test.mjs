import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dataPaths} from '../src/data-paths.mjs';
import {UpdateManager} from '../src/update-manager.mjs';
import {githubSource,probeUpdateRepository} from '../src/update-source.mjs';
import {SettingsStore} from '../src/settings-store.mjs';
import {backupVault} from '../src/update-backup.mjs';
import {testCipher} from './test-cipher.mjs';
const source={provider:'github',owner:'Owner',repo:'Repo'};
const json=value=>new Response(JSON.stringify(value));
const release=(tag,draft=false,prerelease=false)=>({tag_name:tag,draft,prerelease,html_url:'https://evil.example',assets:[{name:'KAIROS-Portable-'+tag.slice(1)+'-x64.zip'}]});
async function withFetch(mock,action){const old=globalThis.fetch;globalThis.fetch=mock;try{return await action();}finally{globalThis.fetch=old;}}

test('portable folder moves preserve the existing external encrypted Windows vault',()=>{
  const a=dataPaths({root:'C:/old-app',appData:'C:/Users/Test/AppData/Roaming'});
  const b=dataPaths({root:'D:/portable-app',appData:'C:/Users/Test/AppData/Roaming'});
  assert.equal(a.dataDir,b.dataDir);assert.equal(a.appDataDir,b.appDataDir);
});

test('manual release check is metadata GET only; filters drafts and beta; reconstructs safe GitHub page',async()=>{
  const manager=new UpdateManager({source,version:'0.5.0'});let gets=0;
  await withFetch(async(url,init)=>{gets++;assert.ok(url.startsWith('https://api.github.com/repos/Owner/Repo/releases?'));assert.equal(init.method,undefined);assert.equal(init.headers.Authorization,undefined);assert.equal(init.redirect,'error');return json([release('v0.6.0'),release('v0.7.0-beta.1',false,true),release('v9.0.0',true),release('v0.4.0')]);},async()=>{
    assert.equal((await manager.check()).ok,true);assert.equal(manager.snapshot().targetVersion,'0.6.0');assert.equal(manager.releasePage(),'https://github.com/Owner/Repo/releases/tag/v0.6.0');
    assert.equal(typeof manager.download,'undefined');assert.equal(typeof manager.install,'undefined');
    assert.equal((await manager.saveBeta(true,async()=>{})).ok,true);assert.equal((await manager.check()).ok,true);assert.equal(manager.snapshot().targetVersion,'0.7.0-beta.1');
  });assert.equal(gets,2);
});

test('missing ZIP, empty list, malformed or failed responses remain clear and never trust server errors',async()=>{
  const manager=new UpdateManager({source,version:'0.5.0'});
  await withFetch(async()=>json([{...release('v0.6.0'),assets:[{name:'KAIROS-Setup.exe'},{name:'latest.yml'}]}]),async()=>{await manager.check();assert.equal(manager.snapshot().state,'available');assert.equal(manager.snapshot().releases[0].downloadable,false);assert.match(manager.snapshot().message,/keine portable/);});
  await withFetch(async()=>json([]),async()=>{await manager.check();assert.equal(manager.snapshot().state,'current');assert.throws(()=>manager.releasePage());});
  for(const response of [()=>new Response('SECRET-BODY',{status:403}),()=>json({private:'SECRET'}),()=>{throw Error('SECRET-TOKEN');}])await withFetch(response,async()=>{assert.equal((await manager.check()).ok,false);assert.equal(manager.snapshot().state,'error');assert.ok(!JSON.stringify(manager.snapshot()).includes('SECRET'));assert.throws(()=>manager.releasePage());});
});

test('checks lock concurrent source changes and unlock after failure; beta save failure preserves channel',async()=>{
  const manager=new UpdateManager({source,version:'0.5.0'});let finish;
  await withFetch(()=>new Promise(resolve=>{finish=resolve;}),async()=>{
    const checking=manager.check();assert.equal((await manager.check()).ok,false);assert.equal((await manager.saveRepository('https://github.com/u/r',()=>assert.fail())).ok,false);assert.equal((await manager.saveBeta(true,()=>assert.fail())).ok,false);finish(json([]));await checking;
  });assert.equal(manager.snapshot().operationBusy,false);
  assert.equal((await manager.saveBeta(true,async()=>{throw Error('PRIVATE-DISK');})).ok,false);assert.equal(manager.snapshot().beta,false);
});

test('repository probe recognizes portable ZIP without updater YAML and refuses unsafe sources',async()=>{
  for(const url of ['http://github.com/u/r','https://github.com.evil/u/r','https://user:secret@github.com/u/r','https://github.com/u/r?token=x','https://github.com/u/r/releases','https://github.com/u/r#secret'])assert.throws(()=>githubSource(url));
  for(const current of [null,{draft:false,prerelease:false,assets:[]},release('v0.6.0')])await withFetch(async(url,init)=>{assert.equal(init.redirect,'error');return url.endsWith('/releases/latest')?current?json(current):new Response('',{status:404}):json({private:false,full_name:'Owner/Repo'});},async()=>{const result=await probeUpdateRepository('https://github.com/Owner/Repo');assert.equal(result.ready,Boolean(current?.assets.length));});
});

test('changing update source persists encrypted, clears old target and preserves previous source if persistence fails',async()=>{
  const base=fileURLToPath(new URL('../../.test-output/portable-updates/',import.meta.url));await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,'vault-'));
  const settings=new SettingsStore(dir,testCipher);await settings.load();const manager=new UpdateManager({source,version:'0.5.0'});
  await withFetch(async()=>json([release('v0.6.0')]),()=>manager.check());
  await withFetch(async url=>url.endsWith('/releases/latest')?new Response('',{status:404}):json({private:false,full_name:'Owner/Other'}),async()=>{
    assert.equal((await manager.saveRepository('https://github.com/Owner/Other',value=>settings.setUpdateRepository(value))).ok,true);assert.equal(manager.snapshot().targetVersion,null);assert.throws(()=>manager.releasePage());
  });assert.equal((await readFile(settings.file)).includes(Buffer.from('Owner/Other')),false);
  const restored=new SettingsStore(dir,testCipher);await restored.load();assert.equal(restored.db.updateRepository,'https://github.com/Owner/Other');
  await withFetch(async url=>url.endsWith('/releases/latest')?new Response('',{status:404}):json({private:false,full_name:'Owner/Repo'}),async()=>assert.equal((await manager.saveRepository('https://github.com/Owner/Repo',async()=>{throw Error('PRIVATE');})).ok,false));
  assert.equal(manager.snapshot().repository,'https://github.com/Owner/Other');
});
test('backup copies exact ciphertext, encrypts inventory and refuses unreadable vault', async () => {
  const base = fileURLToPath(new URL('../../.test-output/qwen-chat-update-tests/', import.meta.url));
  await mkdir(base, { recursive: true }); const dir = await mkdtemp(join(base, 'vault-'));
  const names = ['history', 'settings', 'credentials', 'workflows', 'jobs', 'ssh', 'tts', 'attachment-12345678-1234-1234-1234-123456789abc'];
  for (const name of names) await writeFile(join(dir, `${name}.vault`), await testCipher.encrypt('PRIVATE-' + name));
  await writeFile(join(dir, 'ignored.txt'), 'not a vault'); await mkdir(join(dir, 'ignored.vault'));
  const backup = await backupVault(dir, testCipher, '0.2.0');
  for (const name of names) assert.deepEqual(await readFile(join(backup, `${name}.vault`)), await readFile(join(dir, `${name}.vault`)));
  const inventory = JSON.parse(await testCipher.decrypt(await readFile(join(backup, 'inventory.vault')))); assert.equal(inventory.entries.length, names.length);
  await writeFile(join(dir, 'history.vault'), 'corrupt'); await assert.rejects(() => backupVault(dir, testCipher, '0.2.0'));
  assert.equal((await readdir(join(dir, 'BeforeUpdate'))).filter(n => !n.endsWith('.pending')).length, 1);
});
