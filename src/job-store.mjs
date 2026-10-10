import { SecureFile } from './secure-file.mjs';
import { randomUUID } from 'node:crypto';
import {endpointScope} from './api-endpoint.mjs';
export const JOB_STATES = ['unknown','queued','running','completed','failed','cancelled','missing'];
export function connectionIdentity(profile) {
  const identity=[profile.id, profile.type, profile.model, profile.ssh?.enabled ? ['ssh',profile.ssh.host,profile.ssh.port,profile.ssh.username,profile.ssh.targetHost,profile.ssh.targetPort,profile.ssh.targetTls === true] : profile.baseUrl];
  const scope=endpointScope(profile);if(scope)identity.push(scope);return JSON.stringify(identity);
}
export function boundJob(job, profile) { return !!profile && connectionIdentity(profile) === job.connectionIdentity; }
export class JobStore {
  constructor(directory, cipher) { this.storage = new SecureFile(directory,'jobs',cipher); this.db = {version:1,jobs:[]}; this.queue = Promise.resolve(); }
  async load() {
    try {
      const db=JSON.parse(await this.storage.read());
      if(db.version!==1 || !Array.isArray(db.jobs) || db.jobs.length>10000) throw Error('Ungültiger Auftragstresor.');
      for(const j of db.jobs) if(typeof j.id!=='string' || !/^[a-f0-9-]{36}$/.test(j.id) || !JOB_STATES.includes(j.state) || typeof j.profileId!=='string' || typeof j.connectionIdentity!=='string' || !['ollama','openai-chat','comfyui','image-api'].includes(j.backend) || (j.serverId!==null && (typeof j.serverId!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(j.serverId)))) throw Error('Ungültiger Auftrag.');
      this.db=db;
      for(const j of this.db.jobs) { j.waiting=false; if(!['completed','failed','cancelled'].includes(j.state)) {j.state='unknown';j.detail='KAIROS wurde geschlossen. Der Serverauftrag kann weiterlaufen.';} }
      await this.storage.write(JSON.stringify(this.db));
    }catch(e){if(e.code!=='ENOENT')throw e;}
  }
  snapshot(){return structuredClone(this.db.jobs);}
  get(id){const job=this.db.jobs.find(j=>j.id===id);if(!job)throw Error('Auftrag nicht gefunden.');return structuredClone(job);}
  mutate(fn) {
    const result=this.queue.catch(()=>{}).then(async()=>{const next=structuredClone(this.db);const value=fn(next);await this.storage.write(JSON.stringify(next));this.db=next;return structuredClone(value)});
    this.queue=result;return result;
  }
  create(profile,chatId,messageId){return this.mutate(db=>{const now=new Date().toISOString();const job={id:randomUUID(),profileId:profile.id,backend:profile.type,model:profile.model,providerName:profile.name,connectionIdentity:connectionIdentity(profile),baseUrl:profile.baseUrl,chatId,messageId,serverId:null,clientId:randomUUID(),state:'unknown',waiting:true,recoverable:false,createdAt:now,updatedAt:now,detail:'Anfrage wird gesendet. Annahme und Berechnungsstatus sind noch nicht bestätigt.'};db.jobs.push(job);return job;});}
  update(id,changes){return this.mutate(db=>{const j=db.jobs.find(j=>j.id===id);if(!j)throw Error('Auftrag nicht gefunden.');Object.assign(j,changes,{updatedAt:new Date().toISOString()});return j});}
  removeChats(ids){return this.mutate(db=>{db.jobs=db.jobs.filter(j=>!ids.includes(j.chatId));return true});}
}
