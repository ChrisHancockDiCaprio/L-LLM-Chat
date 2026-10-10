import {test} from 'node:test';
import assert from 'node:assert/strict';
import ssh2 from 'ssh2';
import {generateKeyPairSync} from 'node:crypto';
import {createServer as tcpServer,connect} from 'node:net';
import {createServer as httpServer} from 'node:http';
import {mkdtemp,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {SSHStore,validateSSH} from '../src/ssh-store.mjs';
import {TunnelManager} from '../src/tunnel-manager.mjs';
import {secureHeaders} from '../src/connection-security.mjs';
import {makeTestCipher} from './test-cipher.mjs';
const key=()=>generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
const close=s=>new Promise(r=>s.close(r));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function fixture(t){
 let posts=0;const api=httpServer((req,res)=>{if(req.method==='POST')posts++;res.end('ok')});await listen(api);
 const clients=new Set();let privateKey=key();const userKey=key();const parsed=ssh2.utils.parseKey(userKey);let auths=0;
 const server=new ssh2.Server({hostKeys:[privateKey]},client=>{clients.add(client);client.on('error',()=>{});client.on('close',()=>clients.delete(client));client.on('authentication',ctx=>{auths++;if(ctx.username==='hancock'&&((ctx.method==='password'&&ctx.password==='secret-test')||(ctx.method==='publickey'&&ctx.key.data.equals(parsed.getPublicSSH())&&(!ctx.signature||parsed.verify(ctx.blob,ctx.signature,ctx.hashAlgo)))))ctx.accept();else ctx.reject()});client.on('ready',()=>{client.on('session',(_a,reject)=>reject());client.on('tcpip',(accept,reject,info)=>{if(info.destIP!=='127.0.0.1'||info.destPort!==api.address().port)return reject();const stream=accept();const socket=connect(info.destPort,'127.0.0.1');socket.on('error',()=>stream.destroy());stream.on('close',()=>socket.destroy());socket.pipe(stream).pipe(socket)})})});await listen(server);
 const base=fileURLToPath(new URL('../../.test-output/ssh-tests/',import.meta.url));await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,'case-'));const cipher=makeTestCipher();const store=new SSHStore(directory,cipher);await store.load();
 const config=validateSSH({enabled:true,host:'127.0.0.1',port:server.address().port,username:'hancock',authType:'password',targetHost:'127.0.0.1',targetPort:api.address().port,localPort:0});config.credentialsRef=await store.add(config,{password:'secret-test'});
 const profile={id:'own',baseUrl:'http://127.0.0.1:18000',allowHttp:false,ssh:config};const managers=[];const create=(st=store)=>{const m=new TunnelManager(st,{retryDelay:20});managers.push(m);return m};
 t.after(async()=>{for(const m of managers)m.close();for(const c of clients)c.end();await close(server);await close(api)});
 return {api,server,clients,store,cipher,directory,profile,create,userKey,get posts(){return posts},get auths(){return auths}};
}
async function approved(manager,profile){const pending=manager.ensure(profile);for(let i=0;i<100&&!manager.snapshot().pending.length;i++)await delay(10);const item=manager.snapshot().pending[0];assert.ok(item);assert.match(item.fingerprint,/^SHA256:/);await manager.confirm(item.id,true);return pending}
test('SSH first fingerprint approval, encrypted credentials, localhost forwarding and restart pin',async t=>{
 const f=await fixture(t);const m=f.create();const wire=await approved(m,f.profile);assert.equal(m.entries.values().next().value.server.address().address,'127.0.0.1');assert.equal(await (await fetch(wire.baseUrl)).text(),'ok');assert.equal(secureHeaders(wire,{type:'bearer',token:'api-test'}).Authorization,'Bearer api-test');assert.throws(()=>secureHeaders(f.profile,{type:'bearer',token:'api-test'}));
 const bytes=await readFile(f.store.storage.file);assert.equal(bytes.includes(Buffer.from('secret-test')),false);m.close();const reopened=new SSHStore(f.directory,f.cipher);await reopened.load();const second=f.create(reopened);await second.ensure(f.profile);assert.equal(second.snapshot().pending.length,0);assert.equal(f.posts,0);
});
test('SSH changed host key blocks before authentication and never replaces pinned key',async t=>{
 const f=await fixture(t);const m=f.create();await approved(m,f.profile);m.close();for(const c of f.clients)c.end();await close(f.server);const port=f.profile.ssh.port;let attemptedAuth=false;
 const changed=new ssh2.Server({hostKeys:[key()]},client=>{client.on('error',()=>{});client.on('authentication',ctx=>{attemptedAuth=true;ctx.reject()})});await new Promise(r=>changed.listen(port,'127.0.0.1',r));t.after(()=>close(changed));const saved=f.store.host(f.profile.ssh);const second=f.create();await assert.rejects(second.ensure(f.profile),/Hostschlüssel geändert/);assert.equal(attemptedAuth,false);assert.equal(f.store.host(f.profile.ssh),saved);assert.equal(second.snapshot().pending.length,0);
});
test('wrong password is rejected without leaking secret; occupied preferred port selects free localhost port',async t=>{
 const f=await fixture(t);const bad={...f.profile,ssh:{...f.profile.ssh,credentialsRef:await f.store.add(f.profile.ssh,{password:'wrong-secret'})}};const m=f.create();const pending=m.ensure(bad);for(let i=0;i<100&&!m.snapshot().pending.length;i++)await delay(10);await m.confirm(m.snapshot().pending[0].id,true);await assert.rejects(pending,e=>/fehlgeschlagen/.test(e.message)&&!e.message.includes('wrong-secret'));
 const occupied=tcpServer();await listen(occupied);t.after(()=>close(occupied));const p={...f.profile,ssh:{...f.profile.ssh,localPort:occupied.address().port}};const second=f.create();const wire=await second.ensure(p);assert.notEqual(new URL(wire.baseUrl).port,String(p.ssh.localPort));assert.equal(await(await fetch(wire.baseUrl)).text(),'ok');
});
test('tunnel loss reconnects only transport, no generation resubmission, closes only owned tunnel',async t=>{
 const f=await fixture(t);const m=f.create();await approved(m,f.profile);for(const client of f.clients)client.end();for(let i=0;i<150;i++){await delay(20);if(f.auths>=2&&m.snapshot().connections[0].tunnel==='ready')break}assert.ok(f.auths>=2);assert.equal(m.snapshot().connections[0].tunnel,'ready');const wire=await m.ensure(f.profile);assert.equal(await(await fetch(wire.baseUrl)).text(),'ok');assert.equal(f.posts,0);m.close();assert.equal(await(await fetch('http://127.0.0.1:'+f.api.address().port)).text(),'ok');
});




test('imported SSH private key works without plaintext key files or process arguments',async t=>{
 const f=await fixture(t);const config={...f.profile.ssh,authType:'key'};config.credentialsRef=await f.store.add(config,{privateKey:f.userKey});const m=f.create();const wire=await approved(m,{...f.profile,ssh:config});assert.equal(await(await fetch(wire.baseUrl)).text(),'ok');assert.equal((await readFile(f.store.storage.file)).includes(Buffer.from(f.userKey)),false);
});
