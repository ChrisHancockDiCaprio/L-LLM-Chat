import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function verifyMath({root,dataDir=root,window,store,publish}) {
  const run=code=>window.webContents.executeJavaScript(code);
  const content=String.raw`## Formeln im Chat

Der Flächenanteil beträgt $\frac{\pi r^2}{(2r)^2}=\frac{\pi}{4}$.

$$\frac{1}{\pi}=\frac{2\sqrt{2}}{9801}\sum_{k=0}^{\infty}\frac{(4k)!(1103+26390k)}{(k!)^4 396^{4k}}$$

Auch \(x_1^2+x_2^2=r^2\) und abgesetzte Formeln funktionieren:

\[\int_0^1 x^2\,dx=\frac{1}{3}\]

| Ausdruck | Ergebnis |
|---|---|
| $\sqrt{16}$ | $4$ |`;
  store.active.messages.push({id:'math-fixture',role:'assistant',state:'complete',createdAt:new Date().toISOString(),content});publish();
  for(let i=0;i<100;i++){if(await run('document.querySelectorAll(".math-formula .katex").length===6'))break;await new Promise(r=>setTimeout(r,30));}
  const report=await run(`(async()=>{
    await document.fonts.load('16px KaTeX_Main');await document.fonts.ready;
    const body=document.querySelector('.message:last-child .message-body');
    const math=body.querySelectorAll('.katex');
    return {count:math.length,blocks:body.querySelectorAll('.math-display').length,fonts:document.fonts.check('16px KaTeX_Main'),
      styled:math[0]&&getComputedStyle(math[0]).fontFamily.includes('KaTeX_Main'),
      fractions:body.querySelectorAll('.frac-line').length,fallbacks:body.querySelectorAll('.math-fallback').length,
      contextUnchanged:window.kairosRichText.text(body).includes('\\\\frac')};
  })()`);
  assert.equal(report.count,6);assert.equal(report.blocks,2);assert.ok(report.fonts&&report.styled&&report.contextUnchanged);
  assert.ok(report.fractions>=3);assert.equal(report.fallbacks,0);
  await run(`document.querySelector('#chat-tab').click();document.querySelector('#image-options').open=false;document.querySelector('.message:last-child').scrollIntoView({block:'start',behavior:'instant'});`);
  await new Promise(resolve=>setTimeout(resolve,200));
  const preview=await Promise.race([window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),new Promise(resolve=>setTimeout(()=>resolve(null),5000))]);
  if(preview)await writeFile(join(dataDir,'preview-math.png'),preview.toPNG());
  return {mathInElectron:report};
}
