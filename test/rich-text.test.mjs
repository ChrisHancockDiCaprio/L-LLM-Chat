import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import createDOMPurify from 'dompurify';
import {marked} from 'marked';
const script=await readFile(new URL('../ui/rich-text.js',import.meta.url),'utf8');
function setup() {
  const dom=new JSDOM('<div id="body"></div>',{runScripts:'outside-only',url:'file:///ui/index.html'});
  dom.window.marked=marked;dom.window.DOMPurify=createDOMPurify(dom.window);
  const links=[];dom.window.qwenChat={openLink:href=>links.push(href)};dom.window.eval(script);
  return {window:dom.window,body:dom.window.document.getElementById('body'),links};
}
test('headings, lists, tables, fenced code and HTML are rendered without changing source',()=>{
  const {window,body}=setup();const source='# Titel\n\n- eins\n- zwei\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\n<script>alert(1)</script>\n```\n\n<strong>HTML</strong>';
  window.kairosRichText.render(body,source);
  assert.equal(body.querySelector('h1').textContent,'Titel');assert.equal(body.querySelectorAll('li').length,2);
  assert.equal(body.querySelectorAll('td').length,2);assert.match(body.querySelector('pre code').textContent,/<script>/);
  assert.equal(body.querySelector('strong').textContent,'HTML');assert.equal(body.querySelectorAll('script').length,0);
});
test('XSS, SVG, CSS, images, frames, handlers, clobbering and unsafe links never survive rendering',()=>{
  const {window,body,links}=setup();
  window.kairosRichText.render(body,`<script>alert(1)</script><img src="https://tracker" onerror="alert(1)"><iframe srcdoc="bad"></iframe><svg onload="alert(1)"></svg><style>body{display:none}</style><p id="tts-generate" style="color:red" onclick="alert(1)">safe</p><a href="javascript:alert(1)">bad</a><a href="file:///secret">file</a><a href="data:text/html,bad">data</a><a href="//evil">relative</a>[good](https://example.com)`);
  assert.equal(body.querySelectorAll('script,img,iframe,svg,style').length,0);
  for(const node of body.querySelectorAll('*'))for(const attr of node.attributes)assert.ok(['href','title','start'].includes(attr.name));
  window.kairosRichText.render(body,body.innerHTML+'\n\n[good](https://example.com)');
  assert.equal(body.querySelectorAll('a[href]').length,1);body.querySelector('a[href]').click();assert.deepEqual(links,['https://example.com']);
  window.kairosRichText.render(body,'plain < text & hello');assert.match(body.textContent,/plain < text & hello/);
});
