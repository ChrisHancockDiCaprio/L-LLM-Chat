// Copies original notices from the installed, locked production dependencies.
// No downloaded code, inferred copyright statements or license substitutions.
import {readFile,readdir,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
const records=[];
for(const [path,entry] of Object.entries(lock.packages)) {
  if(!path.startsWith('node_modules/') || entry.dev) continue;
  const directory=join(root,path);let pkg;let names;
  try {pkg=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));names=await readdir(directory);} catch(error) {
    if(entry.optional && error.code==='ENOENT') continue;
    throw error;
  }
  if(pkg.version!==entry.version) throw Error('Installed version differs from lock: '+path);
  const id=path.replaceAll('/','__');
  const notices=names.filter(name=>/^(licen[cs]e|copying|notice|copyright|authors)(\.|-|$)/i.test(name));
  const missingLicense = !notices.length;
  if(missingLicense) throw Error('Original license file missing: '+path);
  const files=[];
  for(const name of notices) {
    const target=join(root,'licenses',id,name);
    await mkdir(dirname(target),{recursive:true});await copyFile(join(directory,name),target);
    files.push('licenses/'+id+'/'+name);
  }
  records.push({name:pkg.name,version:pkg.version,packagePath:path,license:pkg.license??entry.license??'See original notice',repository:pkg.repository?.url??pkg.repository??null,missingLicense,files});
}
records.sort((a,b)=>a.name.localeCompare(b.name)||a.packagePath.localeCompare(b.packagePath));
await mkdir(join(root,'licenses'),{recursive:true});
await writeFile(join(root,'licenses','inventory.json'),JSON.stringify({generated:'2026-10-10',records},null,2)+'\n');
const escape=s=>String(s??'').replaceAll('|','\\|').replace(/[\r\n]/g,' ');
const lines=records.map(r=>`| ${escape(r.name)} | ${r.version} | ${escape(r.license)}${r.missingLicense?' – Lizenztext fehlt':''} | ${r.files.map(f=>`[${escape(f.split('/').at(-1))}](${f})`).join(', ')} |`);
await writeFile(join(root,'THIRD_PARTY_NOTICES.md'),`# KAIROS – Open-Source-Nachweise\n\nStand: 10.10.2026. Originale Lizenz-, Copyright- und Hinweistexte der installierten Produktionsabhängigkeiten sind unverändert unter \`licenses/\` enthalten. Versions- und Herkunftsangaben stehen in \`licenses/inventory.json\`. Dies inventarisiert die vorhandene Installation; es ersetzt keine Prüfung einer später geänderten Paketierung.\n\nHancock (SVG, Stile, Animationen und Schnellchat-Karte) wurde für KAIROS eigenständig erstellt. Von Herald-OS, Coucou/Mochi und awesome-free-llm-apis wurden für diesen Lieferumfang keine Quelltexte, Katalogdaten, Grafiken oder Sounds übernommen. Ihre Funktionsideen sind im Herkunftsregister des Projekts dokumentiert.\n\nElectron ${lock.packages['node_modules/electron'].version} ist die App-Laufzeit. Der Windows-Paketierer liefert deren originale \`LICENSE.electron.txt\` und \`LICENSES.chromium.html\` beim Programm mit. Die Texte stammen aus \`node_modules/electron/dist/\`; Chromium enthält weitere Komponenten. Build-Werkzeuge gehören nicht zur App-Laufzeit.\n\n| Paket | Version | Lizenz laut Paket | Originaltexte |\n|---|---|---|---|\n${lines.join('\n')}\n`);
await mkdir(join(root,'ui'),{recursive:true});
if(records.some(r=>r.missingLicense)) {
  const file=join(root,'THIRD_PARTY_NOTICES.md');const text=await readFile(file,'utf8');
  await writeFile(file,text.replace('\n\nHancock','\n\n**Offener Nachweis:** lazy-val 1.0.5 nennt MIT, liefert jedoch keinen vollständigen Lizenztext. Das geprüfte Original-Repository https://github.com/develar/lazy-val enthält ebenfalls keine separate Lizenzdatei. Originale Paketmetadaten (Autor: Vladimir Krivosheev) und README sind erhalten. Vor Veröffentlichung klären; kein Copyright-Text wurde ergänzt oder erfunden.\n\nHancock'));
}
const enc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cards=records.map(r=>`<article><h2>${enc(r.name)} ${enc(r.version)}</h2><p>${enc(r.license)}${r.missingLicense?' – Original-Lizenztext fehlt im vorhandenen Paket und im geprüften Repository. Die unveränderten Metadaten nennen Vladimir Krivosheev als Autor. Vor einer Veröffentlichung klären; kein Copyright-Text wurde erfunden.':''}</p>${r.files.map(f=>`<p><a href="../${enc(f)}">${enc(f.split('/').at(-1))} – vollständiger Originaltext</a></p>`).join('')}</article>`).join('\n');
await writeFile(join(root,'ui','open-source.html'),`<!doctype html><html lang="de"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'self'; object-src 'none'; base-uri 'none'"><title>KAIROS – Open Source</title><link rel="stylesheet" href="open-source.css"><main><h1>KAIROS – Open Source</h1><p>Hancock ist eine eigene KAIROS-Figur. Es wurden keine Coucou-/Mochi-Grafiken oder Sounds übernommen.</p><p>Die folgenden Originaltexte enthalten die Lizenz- und Copyright-Hinweise der bestehenden Bibliotheken. Electron und Chromium liefern ihre vollständigen Laufzeit-Nachweise zusätzlich im Programmordner mit.</p><p><a href="../THIRD_PARTY_NOTICES.md">Gesamtnachweis</a></p>${cards}</main></html>`);
console.log(JSON.stringify({productionPackages:records.length,originalTexts:records.reduce((n,r)=>n+r.files.length,0)}));
