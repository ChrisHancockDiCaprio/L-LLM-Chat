import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SettingsStore, inspectServer } from '../src/settings-store.mjs';
import { CredentialStore } from '../src/credential-store.mjs';
import { WorkflowStore } from '../src/workflow-store.mjs';
import { comfyEndpoints, inspectComfyUI, validateWorkflow } from '../src/comfyui-client.mjs';
import { sendOpenaiChat } from '../src/openai-client.mjs';
import { testCipher } from './test-cipher.mjs';

const profile = { type: 'auto', baseUrl: 'https://gateway.example', allowHttp: false };
const auth = { type: 'bearer', token: 'FAKE-UPDATE-SECRET' };
const json = value => new Response(JSON.stringify(value));
const graph = { '1': { class_type: 'CLIPTextEncode', inputs: { text: 'PRIVATE-WORKFLOW-PROMPT' } }, '2': { class_type: 'SaveImage', inputs: { images: ['1', 0] } } };
async function withFetch(mock, action) { const previous = globalThis.fetch; globalThis.fetch = mock; try { return await action(); } finally { globalThis.fetch = previous; } }
async function stores() {
  const base = fileURLToPath(new URL('../../.test-output/qwen-chat-update-tests/', import.meta.url));
  await mkdir(base, { recursive: true }); const directory = await mkdtemp(join(base, 'vault-'));
  const settings = new SettingsStore(directory, testCipher); const credentials = new CredentialStore(directory, testCipher);
  await settings.load(); await credentials.load(); return { directory, settings, credentials };
}

test('automatic discovery merges gateway-only aliases with native Ollama and deduplicates overlapping IDs', async () => {
  await withFetch(async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer FAKE-UPDATE-SECRET'); assert.equal(init.redirect, 'error');
    if (url.endsWith('/api/tags')) return json({ models: [{ name: 'native' }] });
    if (url.endsWith('/api/show')) return json({ capabilities: ['completion'], model_info: { 'x.context_length': 32768 } });
    return json({ data: [{ id: 'native' }, { id: 'colibri-alias' }] });
  }, async () => assert.deepEqual((await inspectServer(profile, auth)).map(m => [m.name, m.type]), [['native', 'ollama'], ['colibri-alias', 'openai-chat']]));
});
test('automatic discovery supports a gateway without Ollama and does not invent vision capabilities', async () => {
  await withFetch(async url => url.endsWith('/api/tags') ? new Response('', { status: 404 }) : json({ data: [{ id: 'qwen-image-looking-name' }] }), async () => {
    const models = await inspectServer(profile); assert.equal(models[0].type, 'openai-chat'); assert.deepEqual(models[0].capabilities, []);
  });
});
test('authentication errors stop auto-discovery without retries, fallback or exposed upstream text', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return new Response('FAKE-SECRET-UPSTREAM', { status: 401 }); }, async () => {
    await assert.rejects(() => inspectServer(profile, auth), error => /401/.test(error.message) && !/SECRET/.test(error.message)); assert.equal(calls, 1);
  });
});
test('refresh preserves active selection, custom parameters and known metadata when details are unavailable', async () => {
  const { settings } = await stores();
  await settings.importServer({ ...profile, name: 'Gateway', authRef: 'ref', authType: 'bearer', models: [{ name: 'm', type: 'ollama', capabilities: ['vision'], contextLimit: 32768 }] });
  const p = settings.db.profiles[0]; await settings.upsert({ ...p, enabled: true, options: { num_ctx: 16384, num_predict: 1024, temperature: 0.4 } }); await settings.select(p.id);
  await settings.importServer({ ...profile, name: 'Gateway', authRef: 'ref', authType: 'bearer', models: [{ name: 'm', type: 'ollama', detailsAvailable: false }, { name: 'new', type: 'openai-chat' }] });
  assert.equal(settings.active.id, p.id); assert.equal(settings.active.options.num_ctx, 16384); assert.deepEqual(settings.active.capabilities, ['vision']); assert.equal(settings.active.authRef, 'ref'); assert.equal(settings.db.profiles[1].enabled, false);
});
test('removal persists no active fallback and excluded models stay removed across automatic refresh and restart', async () => {
  const { settings, directory } = await stores(); const args = { ...profile, name: 'Gateway', models: [{ name: 'a', type: 'openai-chat' }, { name: 'b', type: 'openai-chat' }] };
  await settings.importServer(args); const p = settings.db.profiles[0]; await settings.toggle(p.id, true); await settings.select(p.id);
  await settings.remove(p.id); assert.equal(settings.active, null); await settings.importServer(args); assert.equal(settings.db.profiles.length, 1);
  const restored = new SettingsStore(directory, testCipher); await restored.load(); await restored.importServer(args); assert.equal(restored.db.profiles.length, 1);
  await restored.importServer({ ...args, restoreRemoved: true }); assert.equal(restored.db.profiles.length, 2);
});
test('server removal reclaims only unused credentials and preserves credentials shared by remaining models', async () => {
  const { settings, credentials } = await stores(); const ref = await credentials.add(profile.baseUrl, auth);
  await settings.importServer({ ...profile, name: 'Gateway', authRef: ref, authType: 'bearer', models: [{ name: 'a', type: 'openai-chat' }, { name: 'b', type: 'openai-chat' }] });
  await settings.remove(settings.db.profiles[0].id); await credentials.collectUnused(settings.db.profiles); assert.equal(credentials.get(settings.db.profiles[0]).token, auth.token);
  await settings.remove(settings.db.profiles[0].id, true); await credentials.collectUnused(settings.db.profiles); assert.equal(Object.keys(credentials.db.entries).length, 0);
  const restored = new CredentialStore(settings.directory, testCipher); await restored.load(); assert.equal(Object.keys(restored.db.entries).length, 0);
});
test('credential deletion rolls back in memory on failed encrypted persistence', async () => {
  const { credentials } = await stores(); const ref = await credentials.add(profile.baseUrl, auth);
  credentials.save = async () => { throw new Error('Disk failure'); };
  await assert.rejects(() => credentials.collectUnused([]), /Disk failure/);
  assert.equal(credentials.get({ ...profile, authRef: ref }).token, auth.token);
  await assert.rejects(() => credentials.remove(ref)); assert.ok(credentials.db.entries[ref]);
});
test('OpenAI-compatible transport sends bounded history, parameters and origin-bound auth and rejects truncated responses', async () => {
  const p = { ...profile, type: 'openai-chat', model: 'alias', enabled: true, options: { num_ctx: 8192, num_predict: 512, temperature: 0.4 } };
  await withFetch(async (url, init) => {
    assert.equal(url, profile.baseUrl + '/v1/chat/completions'); assert.equal(init.redirect, 'error'); assert.equal(init.headers.Authorization, 'Bearer FAKE-UPDATE-SECRET');
    const body = JSON.parse(init.body); assert.deepEqual(body.messages, [{ role: 'user', content: 'hello' }]); assert.equal(body.max_tokens, 512); assert.equal(body.temperature, 0.4); assert.equal(body.num_ctx, undefined);
    return json({ choices: [{ finish_reason: 'stop', message: { content: 'reply' } }] });
  }, async () => assert.equal(await sendOpenaiChat([{ role: 'user', content: 'hello', secret: 'drop' }], { profile: p, auth }), 'reply'));
  await withFetch(async () => json({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }), async () => assert.rejects(() => sendOpenaiChat([{ role: 'user', content: 'hello' }], { profile: p }), /abgeschnitten/));
});
test('all new providers reject HTTP credentials before network access', async () => {
  let calls = 0; const insecure = { ...profile, baseUrl: 'http://192.168.0.175:8188', allowHttp: true };
  await withFetch(async () => { calls++; }, async () => {
    await assert.rejects(() => inspectServer(insecure, auth), /HTTPS|Zugangsdaten/);
    await assert.rejects(() => inspectComfyUI(insecure, auth), /HTTPS|Zugangsdaten/);
    await assert.rejects(() => sendOpenaiChat([{ role: 'user', content: 'hello' }], { profile: { ...insecure, type: 'openai-chat', enabled: true, model: 'm', options: {} }, auth }), /HTTPS|Zugangsdaten/);
    assert.equal(calls, 0);
  });
});
test('ComfyUI checks native stats and object_info, inventories GGUF models and remains disabled', async () => {
  const p = { ...profile, type: 'comfyui' };
  await withFetch(async (url, init) => {
    assert.equal(init.redirect, 'error'); assert.ok(!url.includes('/v1/') && !url.includes('/api/'));
    return json(url.endsWith('/system_stats') ? { system: { os: 'linux' } } : { UnetLoaderGGUF: { input: { required: { unet_name: [['Qwen-Image-2.1.gguf']] } } } });
  }, async () => {
    const models = await inspectServer(p); assert.equal(models[0].serverInfo.ggufAvailable, true); assert.deepEqual(models[0].serverInfo.modelFiles, ['Qwen-Image-2.1.gguf']);
    const { settings } = await stores(); await settings.importServer({ ...p, name: 'ComfyUI', models }); assert.equal(settings.db.profiles[0].enabled, false);
    await settings.toggle(settings.db.profiles[0].id, true);
    await settings.importServer({ ...p, name: 'ComfyUI', models }); assert.equal(settings.db.profiles[0].enabled, true);
  });
  const urls = comfyEndpoints({ baseUrl: 'https://comfy.example' }, 'client-id', 'prompt-id');
  assert.equal(urls.ws, 'wss://comfy.example/ws?clientId=client-id'); assert.equal(urls.prompt, 'https://comfy.example/prompt'); assert.equal(urls.history, 'https://comfy.example/history/prompt-id');
});
test('API workflows are encrypted, validated, restored and removed only when their ComfyUI connection is deleted', async () => {
  const { directory } = await stores(); const workflows = new WorkflowStore(directory, testCipher); await workflows.load();
  assert.throws(() => validateWorkflow({ nodes: [] }), /API-Format/); assert.throws(() => validateWorkflow({ '1': { type: 'wrong' } }), /Ungültiger/);
  await workflows.import({...profile,id:"image-profile",type:"comfyui"}, 'qwen.json', graph); assert.equal((await readFile(workflows.storage.file)).includes(Buffer.from('PRIVATE-WORKFLOW-PROMPT')), false);
  const restored = new WorkflowStore(directory, testCipher); await restored.load(); assert.equal(restored.summary({...profile,id:"image-profile",type:"comfyui"}).nodeCount, 2);
  await restored.collectUnused([{ ...profile, id: "image-profile", type: 'comfyui' }]); assert.ok(restored.summary({...profile,id:"image-profile",type:"comfyui"}));
  await restored.collectUnused([]); assert.equal(restored.summary({...profile,id:"image-profile",type:"comfyui"}), null);
});

test('different SSH targets sharing a local URL remain separate and deleting one server keeps the other',async()=>{
 const {settings}=await stores();const ssh={enabled:true,host:'192.168.0.175',port:22,username:'hancock',authType:'agent',targetHost:'127.0.0.1',targetPort:8000};
 const input={name:'SSH',baseUrl:'http://127.0.0.1:18000',allowHttp:true,type:'openai-chat',models:[{name:'same-model',type:'openai-chat'}],authType:'none'};
 await settings.importServer({...input,ssh});await settings.importServer({...input,ssh:{...ssh,targetPort:9000}});assert.equal(settings.db.profiles.length,2);
 const first=settings.db.profiles[0];await settings.remove(first.id,true);assert.equal(settings.db.profiles.length,1);assert.equal(settings.db.profiles[0].ssh.targetPort,9000);
 await settings.load();await settings.importServer({...input,ssh});assert.equal(settings.db.profiles.length,1);
});
