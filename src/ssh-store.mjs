import {SecureFile} from './secure-file.mjs';
import {randomUUID,createHash} from 'node:crypto';
export function validateSSH(raw) {
  if(!raw?.enabled)return null;
  const host=v=>typeof v==='string'&&v.length>0&&v.length<=253&&/^[A-Za-z0-9_.:-]+$/.test(v);
  const port=v=>Number.isInteger(v)&&v>=1&&v<=65535;
  if(!host(raw.host)||!host(raw.targetHost)||!port(raw.port)||!port(raw.targetPort)||typeof raw.username!=='string'||!/^[A-Za-z0-9_.@-]{1,100}$/.test(raw.username)||!['agent','key','password'].includes(raw.authType))throw Error('Ungültige SSH-Tunneleinstellungen.');
  if(raw.credentialsRef!=null&&(typeof raw.credentialsRef!=='string'||raw.credentialsRef.length>100))throw Error('Ungültiger SSH-Zugang.');
  if(raw.localPort!=null&&raw.localPort!==0&&!port(raw.localPort))throw Error('Ungültiger lokaler Tunnelport.');
  return {enabled:true,host:raw.host,port:raw.port,username:raw.username,targetHost:raw.targetHost,targetPort:raw.targetPort,localPort:raw.localPort??0,authType:raw.authType,credentialsRef:raw.credentialsRef??null,targetTls:raw.targetTls===true};
}
export const sshScope=c=>JSON.stringify([c.host,c.port,c.username]);
export const fingerprint=key=>'SHA256:'+createHash('sha256').update(key).digest('base64').replace(/=+$/,'');
export class SSHStore {
  constructor(directory,cipher){this.storage=new SecureFile(directory,'ssh-credentials',cipher);this.db={version:1,credentials:{},hosts:{}};this.queue=Promise.resolve();}
  async load(){try{const db=JSON.parse(await this.storage.read());if(db.version!==1||!db.credentials||!db.hosts)throw Error('Ungültiger SSH-Tresor.');this.db=db}catch(e){if(e.code!=='ENOENT')throw e}}
  mutate(fn){const result=this.queue.catch(()=>{}).then(async()=>{const db=structuredClone(this.db);const value=fn(db);await this.storage.write(JSON.stringify(db));this.db=db;return value});this.queue=result;return result;}
  async add(config,raw={}){
    if(config.authType==='agent')return null;
    const auth=config.authType==='key'?{privateKey:raw.privateKey,passphrase:raw.passphrase??''}:{password:raw.password};
    if(config.authType==='key'&&(typeof auth.privateKey!=='string'||!auth.privateKey.trim()||auth.privateKey.length>65536||typeof auth.passphrase!=='string'||auth.passphrase.length>1000))throw Error('Bitte einen SSH-Schlüssel und gegebenenfalls dessen Passphrase angeben.');
    if(config.authType==='password'&&(typeof auth.password!=='string'||!auth.password||auth.password.length>1000))throw Error('Bitte ein SSH-Passwort angeben.');
    const id=randomUUID();await this.mutate(db=>{db.credentials[id]={scope:sshScope(config),type:config.authType,auth}});return id;
  }
  get(config){if(config.authType==='agent')return {agent:process.env.SSH_AUTH_SOCK||(process.platform==='win32'?'\\\\.\\pipe\\openssh-ssh-agent':undefined)};const entry=this.db.credentials[config.credentialsRef];if(!entry||entry.scope!==sshScope(config)||entry.type!==config.authType)throw Error('SSH-Zugang fehlt oder gehört zu einem anderen Server.');return structuredClone(entry.auth);}
  host(config){return this.db.hosts[JSON.stringify([config.host,config.port])]??null;}
  trust(config,value){return this.mutate(db=>{const key=JSON.stringify([config.host,config.port]);if(db.hosts[key]&&db.hosts[key]!==value)throw Error('Geänderter SSH-Hostschlüssel. Verbindung blockiert.');db.hosts[key]=value});}
}

export function apiDestination(p){const c=validateSSH(p.ssh);return c?JSON.stringify(['ssh',c.host,c.port,c.username,c.targetHost,c.targetPort,c.targetTls]):p.baseUrl;}
