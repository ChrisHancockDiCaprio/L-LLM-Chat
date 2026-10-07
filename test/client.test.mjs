import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendChat as sendWithProfile } from '../src/ollama-client.mjs';
const profile = { type: 'ollama', enabled: true, baseUrl: 'http://localhost:11434', allowHttp: true, model: 'qwen3.5:4b' };
const sendChat = (messages, options = {}) => sendWithProfile(messages, { profile, ...options });
import { createOllamaRequest } from '../src/ollama-request.mjs';

// No generated proposal is evaluated dynamically. The inspected module is
// imported normally; fetch is replaced to test its observable network contract.
const messages = () => [{ role: 'user', content: 'Hallo' }, { role: 'assistant', content: 'Hi' }, { role: 'user', content: 'Weiter?' }];
async function withFetch(mock, body) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await body(); } finally { globalThis.fetch = original; }
}
const success = { done: true, done_reason: 'stop', message: { content: 'Antwort' } };
const response = (data = success, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('sends fixed target/model, full ordered history, and returns only answer text', async () => {
  const history = messages(); const before = JSON.stringify(history);
  let calls = 0;
  await withFetch(async (url, init) => {
    calls++;
    assert.equal(String(url), 'http://localhost:11434/api/chat');
    assert.equal(init.method, 'POST');
    assert.match(new Headers(init.headers).get('Content-Type'), /application\/json/);
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'qwen3.5:4b');
    assert.equal(body.stream, false); assert.equal(body.think, false);
    assert.deepEqual(body.messages, history);
    assert.ok(init.signal instanceof AbortSignal);
    return response();
  }, async () => {
    assert.equal(await sendChat(history), 'Antwort');
    assert.equal(JSON.stringify(history), before); assert.equal(calls, 1);
  });
});

test('rejects invalid history before network access', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return response(); }, async () => {
    for (const history of [[], null, [{ role: 'tool', content: 'x' }], [{ role: 'user', content: 42 }], [{ role: 'user', content: '  ' }]]) {
      await assert.rejects(() => sendChat(history));
    }
    assert.equal(calls, 0);
  });
});

test('HTTP error is not returned as a normal chat reply or retried', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return response({ error: 'fail' }, 503); }, async () => {
    await assert.rejects(() => sendChat(messages()), /503/);
    assert.equal(calls, 1);
  });
});

test('rejects unfinished, truncated, missing, wrong-type and blank answers', async () => {
  for (const data of [
    { ...success, done: false }, { ...success, done_reason: 'length' },
    { done: true }, { done: true, message: { content: 42 } },
    { done: true, message: { content: '  ' } },
  ]) {
    await withFetch(async () => response(data), async () => {
      await assert.rejects(() => sendChat(messages()));
    });
  }
});

test('invalid upstream JSON remains an error', async () => {
  await withFetch(async () => new Response('not JSON'), async () => {
    await assert.rejects(() => sendChat(messages()));
  });
});

test('caller cancellation reaches fetch', async () => {
  const caller = new AbortController();
  await withFetch(async (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    caller.abort();
  }), async () => {
    await assert.rejects(() => sendChat(messages(), { signal: caller.signal }));
  });
});

test('generation does not set an automatic deadline',async()=>{
 const original=AbortSignal.timeout;let calls=0;AbortSignal.timeout=()=>{calls++;throw Error('No generation deadline allowed')};
 try{await withFetch(async()=>response(),async()=>assert.equal(await sendChat(messages()),'Antwort'));assert.equal(calls,0)}finally{AbortSignal.timeout=original}
});

test('network failure stays an error without retry', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; throw new TypeError('fetch failed'); }, async () => {
    await assert.rejects(() => sendChat(messages())); assert.equal(calls, 1);
  });
});

test('copies each message and sends only role/content, not unrelated metadata', () => {
  const history = messages();
  history[0].internalNote = 'This must remain local';
  const payload = createOllamaRequest(history);
  assert.notEqual(payload.messages, history);
  assert.notEqual(payload.messages[0], history[0]);
  assert.deepEqual(Object.keys(payload.messages[0]).sort(), ['content', 'role']);
  assert.equal(history[0].internalNote, 'This must remain local');
});

test('null message has an understandable validation error', () => {
  assert.throws(() => createOllamaRequest([null]), /Eintrag.*Objekt/);
});
