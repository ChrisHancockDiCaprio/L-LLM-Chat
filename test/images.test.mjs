import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AttachmentStore, imageAttachment } from '../src/attachments.mjs';
import { generateImage, imageModels } from '../src/image-client.mjs';
import { sendChat } from '../src/ollama-client.mjs';
import { selectContext, SessionStore } from '../src/session-store.mjs';
import { testCipher } from './test-cipher.mjs';
const png = (await readFile(new URL('../assets/icon.png', import.meta.url))).toString('base64');
const profile = { type: 'image-api', enabled: true, model: 'sd-cpp-local', baseUrl: 'https://images.example', allowHttp: false };
async function folder() { const base = fileURLToPath(new URL('../../../work/qwen-chat-image-tests/', import.meta.url)); await mkdir(base, { recursive: true }); return mkdtemp(join(base, 'test-')); }
async function mockFetch(mock, run) { const before = globalThis.fetch; globalThis.fetch = mock; try { await run(); } finally { globalThis.fetch = before; } }
const response = data => new Response(JSON.stringify(data));
test('attachments persist only encrypted, restore images/files and keep absolute paths out of previews', async () => {
  const dir = await folder(); const store = new AttachmentStore(dir, testCipher);
  const imagePath = join(dir, 'picture.png'); await writeFile(imagePath, Buffer.from(png, 'base64'));
  const preview = await store.importFile(imagePath); const file = join(dir, 'note.md'); await writeFile(file, 'PRIVATE-DOCUMENT'); const doc = await store.importFile(file);
  assert.equal(JSON.stringify(preview).includes(dir), false); assert.equal(doc.text, undefined);
  await store.persist([preview.id, doc.id]);
  assert.equal((await readFile(join(dir, `attachment-${preview.id}.vault`))).includes(Buffer.from(png)), false);
  assert.equal((await readFile(join(dir, `attachment-${doc.id}.vault`))).includes(Buffer.from('PRIVATE-DOCUMENT')), false);
  const restored = new AttachmentStore(dir, testCipher); await restored.restore([{ attachmentIds: [preview.id, doc.id] }]);
  assert.equal(restored.get(preview.id).base64, png); assert.equal(restored.get(doc.id).text, 'PRIVATE-DOCUMENT');
  const request = restored.wireMessage({ role: 'user', content: 'Beschreibe', attachmentIds: [preview.id, doc.id] }, {}); assert.match(request.content, /PRIVATE-DOCUMENT/); assert.deepEqual(request.images, [png]);
});
test('SVG/executable/binary/oversized text attachments are rejected', async () => {
  const dir = await folder(); const store = new AttachmentStore(dir, testCipher);
  for (const [name, bytes] of [['x.svg','<svg/>'],['x.exe','binary'],['x.txt','a\0b'],['large.txt','x'.repeat(17000)],['bad.png','<html>']]) { const file = join(dir,name); await writeFile(file,bytes); await assert.rejects(() => store.importFile(file)); }
  assert.throws(() => imageAttachment('data:image/png;base64,' + png));
});
test('vision capability is required before network access; image payload survives context selection', async () => {
  const ollama = { ...profile, type: 'ollama' }; let calls = 0;
  const message = { role: 'user', content: 'Bild?', images: [png] };
  await mockFetch(async (_,init) => { calls++; assert.deepEqual(JSON.parse(init.body).messages[0].images, [png]); return response({ done:true, message:{content:'Ein Kompass'} }); }, async () => {
    await assert.rejects(() => sendChat([message], { profile: ollama }), /Bildeingaben/); assert.equal(calls,0);
    assert.equal(await sendChat([message], { profile:{...ollama,capabilities:['vision']} }), 'Ein Kompass');
  });
  const context = selectContext([], 'Bild?', 100, {images:[png]}); assert.deepEqual(context.messages[0].images,[png]);
});
test('image generation uses origin-bound HTTPS auth, one image, no redirects or remote image fetching', async () => {
  let calls = 0;
  await mockFetch(async (url,init) => { calls++; assert.equal(url,'https://images.example/v1/images/generations'); assert.equal(init.headers.Authorization,'Bearer fake-key'); assert.equal(init.redirect,'error'); assert.deepEqual(JSON.parse(init.body),{model:'sd-cpp-local',prompt:'Kompass',n:1,size:'1024x1024',response_format:'b64_json'}); return response({data:[{b64_json:png}]}); }, async () => {
    const image = await generateImage('Kompass',{profile,auth:{type:'bearer',token:'fake-key'}}); assert.equal(image.base64,png); assert.equal(calls,1);
  });
  await mockFetch(async () => response({data:[{url:'https://untrusted.example/image.png'}]}), async () => { await assert.rejects(() => generateImage('Kompass',{profile}),/b64_json/); });
});
test('image edit uploads image bytes as multipart, and never sends text documents', async () => {
  const reference = imageAttachment(png);
  await mockFetch(async (url,init) => { assert.match(url,/\/edits$/); assert.equal(init.headers['Content-Type'],undefined); assert.equal(init.body.get('image[]').size,Buffer.from(png,'base64').length); return response({data:[{b64_json:png}]}); }, async () => { await generateImage('Blauer Kompass',{profile,references:[reference]}); });
  await assert.rejects(() => generateImage('Test',{profile,references:[{kind:'text'}]}),/Textdateien/);
  await assert.rejects(() => generateImage('Test',{profile:{...profile,baseUrl:'http://192.168.0.2',allowHttp:true},auth:{type:'bearer',token:'key'}}),/HTTPS/);
});
test('server models are discovered without assuming the GGUF filename is the API model id', async () => {
  await mockFetch(async (url,init) => { assert.equal(url,'https://images.example/v1/models'); assert.equal(init.redirect,'error'); return response({data:[{id:'sd-cpp-local'}]}); }, async () => { assert.deepEqual(await imageModels(profile),['sd-cpp-local']); });
});
