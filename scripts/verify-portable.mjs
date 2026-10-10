import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,cp,rename} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const version=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const output=resolve(root,'../.test-output');await mkdir(output,{recursive:true});
const test=await mkdtemp(join(output,'portable-package-'));
const inside=path=>{const rel=relative(test,resolve(path));assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel));return path;};
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
async function run(executable,args) {
  await new Promise((accept,reject)=>{
    const child=spawn(executable,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let errors='';
    child.stdout.on('data',()=>{});child.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4000);});
    const timeout=setTimeout(()=>{child.kill();reject(Error('Isolierter Pakettest hat das Zeitlimit überschritten.'));},120000);
    child.on('error',error=>{clearTimeout(timeout);reject(error);});
    child.on('close',code=>{clearTimeout(timeout);code===0?accept():reject(Error('Pakettest fehlgeschlagen: '+errors));});
  });
}
async function vault(name){const directory=inside(join(test,name));await mkdir(directory);await writeFile(join(directory,'.qwen-chat-test-root'),'Portable packaged verification\n');return directory;}
const first=inside(join(test,'edition-a'));const moved=inside(join(test,'edition-b'));
await cp(join(root,'dist-release/win-unpacked'),first,{recursive:true,errorOnExist:true,force:false});
const account=await vault('account');
await run(join(first,'KAIROS.exe'),['--release-test-root='+account,'--seed-release-test','--seed-release-attachments']);
// Windows may retain an executable handle briefly after Electron exits.
for(let attempt=0;;attempt++){
  try{await rename(inside(first),inside(moved));break;}
  catch(error){if(attempt>=20||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,250));}
}
await run(join(moved,'KAIROS.exe'),['--release-test-root='+account]);
const startup=JSON.parse(await readFile(join(account,'report.json'),'utf8'));assert.equal(startup.version,version);assert.equal(startup.credentialsPreserved,true);assert.equal(startup.attachmentsPreserved,1);
const ui=await vault('ui');await run(join(moved,'KAIROS.exe'),['--verify-update','--release-test-root='+ui]);
const uiReport=JSON.parse(await readFile(join(ui,'Vault/verification-update.json'),'utf8'));
assert.equal(uiReport.manualReleaseCheckAndSafeBrowserLink,true);assert.equal(uiReport.noInstallerOrProgramDownload,true);assert.equal(uiReport.encryptedRestartPreservesChangesAndChats,true);
const filename='KAIROS-Portable-'+version+'-x64.zip';
const archive=await readFile(join(root,'dist-release',filename));const sha256=createHash('sha256').update(archive).digest('hex');
await writeFile(join(root,'dist-release',filename+'.sha256'),sha256+'  '+filename+'\n');
const report={version,archive:filename,sha256,size:archive.length,portableStart:true,movedFolder:true,encrypted:true,credentialsPreserved:true,attachmentsPreserved:1,packagedUi:true,manualUpdateCheck:true,installerAbsent:true,liveProviderRequests:0,commit:process.env.GITHUB_SHA??null};
await writeFile(join(root,'dist-release','validation-'+version+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
