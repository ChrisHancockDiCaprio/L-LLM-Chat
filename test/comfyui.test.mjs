import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { generateComfyImages, prepareComfyWorkflow, validateMapping, validateImageOptions } from '../src/comfyui-client.mjs';
import { WorkflowStore } from '../src/workflow-store.mjs';
import { testCipher } from './test-cipher.mjs';
const nodes = { '1': { class_type: 'Text', inputs: { text: 'ORIGINAL-POSITIVE' } }, '2': { class_type: 'Text', inputs: { text: 'ORIGINAL-NEGATIVE' } }, '3': { class_type: 'Latent', inputs: { width: 512, height: 512 } }, '4': { class_type: 'Sampler', inputs: { steps: 10, seed: 42, positive: ['1', 0] } }, '5': { class_type: 'SaveImage', inputs: { images: ['4', 0] } } };
const mapping = { prompt: { nodeId: '1', input: 'text' }, negativePrompt: { nodeId: '2', input: 'text' }, width: { nodeId: '3', input: 'width' }, height: { nodeId: '3', input: 'height' }, steps: { nodeId: '4', input: 'steps' }, seed: { nodeId: '4', input: 'seed' }, outputNode: '5' };
const options = { negativePrompt: 'blur', width: 1024, height: 768, steps: 25, seed: 7 };
const entry = { nodes, mapping, options };
const profile = { type: 'comfyui', baseUrl: 'https://comfy.example', enabled: true };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=', 'base64');
const json = data => new Response(JSON.stringify(data));
async function mockFetch(mock, run) { const previous = globalThis.fetch; globalThis.fetch = mock; try { return await run(); } finally { globalThis.fetch = previous; } }
function history(images, status = { completed: true, status_str: 'success' }) { return json({ 'prompt-id': { status, outputs: { '5': { images } } } }); }
const image = { filename: 'bild ü.png', subfolder: 'Qwen/generated', type: 'output' };

test('ComfyUI replaces only explicitly mapped scalar inputs and retains graph and source', () => {
  const prepared = prepareComfyWorkflow(entry, 'new prompt', options);
  assert.equal(prepared.nodes['1'].inputs.text, 'new prompt'); assert.equal(prepared.nodes['2'].inputs.text, 'blur');
  assert.equal(prepared.nodes['3'].inputs.width, 1024); assert.equal(prepared.nodes['3'].inputs.height, 768);
  assert.equal(prepared.nodes['4'].inputs.seed, 7); assert.equal(prepared.nodes['4'].inputs.steps, 25);
  assert.deepEqual(prepared.nodes['4'].inputs.positive, ['1', 0]); assert.equal(nodes['1'].inputs.text, 'ORIGINAL-POSITIVE');
  const random = prepareComfyWorkflow(entry, 'x', { ...options, seed: -1 }); assert.ok(Number.isInteger(random.options.seed) && random.options.seed >= 0 && random.options.seed <= 4294967295);
});
test('mapping refuses linked/missing/duplicate targets and invalid image parameters before submission', () => {
  assert.throws(() => validateMapping(nodes, { ...mapping, prompt: { nodeId: '4', input: 'positive' } }));
  assert.throws(() => validateMapping(nodes, { ...mapping, seed: mapping.steps }));
  assert.throws(() => validateMapping(nodes, { ...mapping, outputNode: '404' }));
  for (const value of [{ width: 1025 }, { height: 9000 }, { steps: 0 }, { seed: 4294967296 }]) assert.throws(() => validateImageOptions({ ...options, ...value }));
  assert.throws(() => prepareComfyWorkflow({ ...entry, mapping: { ...mapping, negativePrompt: null } }, 'x', options));
});
test('native prompt/history/view flow waits, fetches only mapped outputs and returns image bytes', async () => {
  const urls = []; let polls = 0; const progress = [];
  const result = await mockFetch(async (url, init) => {
    urls.push(url); assert.equal(init.redirect, 'error'); assert.equal(init.headers.Authorization, 'Bearer FAKE-COMFY-KEY');
    if (url.endsWith('/prompt')) { const body = JSON.parse(init.body); assert.equal(body.prompt['4'].inputs.seed, 7); assert.match(body.client_id, /^[a-f0-9-]{36}$/); return json({ prompt_id: 'prompt-id', node_errors: {} }); }
    if (url.endsWith('/history/prompt-id')) return ++polls === 1 ? json({}) : history([image]);
    if (url.endsWith('/queue'))return json({queue_running:[[0,'prompt-id']],queue_pending:[]});
    const parsed = new URL(url); assert.equal(parsed.pathname, '/view'); assert.equal(parsed.searchParams.get('filename'), image.filename); assert.equal(parsed.searchParams.get('type'), 'output'); return new Response(png);
  }, () => generateComfyImages('hello', { profile, auth: { type: 'bearer', token: 'FAKE-COMFY-KEY' }, entry, pollInterval: 1, onProgress: p => progress.push(p.state) }));
  assert.equal(result.images[0].base64, png.toString('base64')); assert.equal(result.seed, 7);
  assert.deepEqual(progress, ['submitting', 'queued', 'running', 'receiving']); assert.equal(urls.length, 5); assert.ok(urls.every(u => !u.includes('/v1') && !u.includes('/api/')));
});
test('ComfyUI rejects execution errors and unsafe/oversized/nonimage outputs without fetching foreign URLs', async () => {
  for (const descriptor of [{ ...image, filename: '../bad.png' }, { ...image, subfolder: '../private' }, { ...image, type: 'temp' }]) {
    let fetched = 0;
    await mockFetch(async url => { if (url.endsWith('/prompt')) return json({ prompt_id: 'prompt-id' }); if (url.includes('/history/')) return history([descriptor]); fetched++; throw Error('No view allowed'); }, async () => { await assert.rejects(() => generateComfyImages('x', { profile, entry })); assert.equal(fetched, 0); });
  }
  await mockFetch(async url => url.endsWith('/prompt') ? json({ prompt_id: 'prompt-id' }) : history([], { status_str: 'error', messages: [['execution_error', { exception_message: 'PRIVATE-BODY' }]] }), async () => assert.rejects(() => generateComfyImages('x', { profile, entry }), e => !e.message.includes('PRIVATE-BODY')));
  for (const bytes of [Buffer.from('not image'), Buffer.alloc(8 * 1024 * 1024 + 1)]) await mockFetch(async url => url.endsWith('/prompt') ? json({ prompt_id: 'prompt-id' }) : url.includes('/history/') ? history([image]) : new Response(bytes), async () => assert.rejects(() => generateComfyImages('x', { profile, entry })));
});
test('ComfyUI cancellation stops polling and HTTP secrets never reach network', async () => {
  const controller = new AbortController(); let calls = 0;
  await mockFetch(async url => { calls++; if (url.endsWith('/prompt')) return json({ prompt_id: 'prompt-id' }); controller.abort(); return json({}); }, async () => assert.rejects(() => generateComfyImages('x', { profile, entry, signal: controller.signal }), /möglicherweise weiter/));
  assert.equal(calls, 2); calls = 0;
  await mockFetch(async () => { calls++; }, async () => assert.rejects(() => generateComfyImages('x', { profile: { ...profile, baseUrl: 'http://192.168.0.175:8188', allowHttp: true }, entry, auth: { type: 'bearer', token: 'FAKE' } }), /HTTPS/)); assert.equal(calls, 0);
});
test('workflow, mapping and defaults persist encrypted; reimport clears mapping and failed saves preserve it', async () => {
  const base = fileURLToPath(new URL('../../.test-output/qwen-chat-update-tests/', import.meta.url)); await mkdir(base, { recursive: true }); const dir = await mkdtemp(join(base, 'comfy-'));
  const store = new WorkflowStore(dir, testCipher); await store.load(); await store.import(profile.baseUrl, 'fixture.json', nodes); await store.configure(profile.baseUrl, mapping, options);
  assert.equal((await readFile(store.storage.file)).includes(Buffer.from('ORIGINAL-POSITIVE')), false);
  const restored = new WorkflowStore(dir, testCipher); await restored.load(); assert.equal(restored.summary(profile.baseUrl).ready, true); assert.deepEqual(restored.get(profile.baseUrl).mapping, mapping);
  assert.ok(!JSON.stringify(restored.summary(profile.baseUrl)).includes('ORIGINAL-POSITIVE'));
  const write = restored.storage.write; restored.storage.write = async () => { throw Error('disk full'); }; await assert.rejects(() => restored.configure(profile.baseUrl, mapping, { ...options, steps: 50 })); assert.equal(restored.get(profile.baseUrl).options.steps, 25); restored.storage.write = write;
  await restored.import(profile.baseUrl, 'replacement.json', nodes); assert.equal(restored.summary(profile.baseUrl).ready, false);
});
