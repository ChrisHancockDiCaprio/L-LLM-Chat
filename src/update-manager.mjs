import {githubSource,repositoryUrl,probeUpdateRepository,newerReleases} from './update-source.mjs';
// Release metadata only. No program download, execution or installation.
export class UpdateManager {
  constructor({source,version,beta=false,notify=()=>{}}) {
    this.notify=notify;this.working=false;this.beta=beta===true;
    this.status={state:'disabled',version,beta:this.beta,releases:[],targetVersion:null,releaseUrl:null,manualDownload:true,message:'Keine Updatequelle eingerichtet.'};
    if(source?.provider==='github')this.configure(source);
  }
  configure(source) {
    this.source=githubSource(repositoryUrl(source));
    this.status={...this.status,state:'idle',message:'Portable Ausgabe: neue Versionen selbst herunterladen und entpacken.',repository:repositoryUrl(this.source),releases:[],targetVersion:null,releaseUrl:null};
  }
  sourceLocked(){return this.working||this.status.sourceChecking===true;}
  snapshot(){return {...this.status,releases:this.status.releases.map(r=>({...r})),operationBusy:this.working};}
  set(state,message){this.status.state=state;this.status.message=message;this.notify();}
  async saveRepository(value,persist) {
    if(this.sourceLocked())return {ok:false,error:'Bitte die laufende Updateprüfung abschließen.'};
    this.status.sourceChecking=true;this.notify();
    const previousSource=this.source;const previousStatus=this.snapshot();
    try {
      const result=await probeUpdateRepository(value);
      await persist(result.repository);this.configure(result.source);this.status.sourceMessage=result.notice;
      return {ok:true,notice:result.notice};
    }catch{this.source=previousSource;this.status=previousStatus;return {ok:false,error:'Repository nicht übernommen. Adresse, öffentliche Erreichbarkeit und verschlüsselten Speicher prüfen.'};}
    finally{this.status.sourceChecking=false;this.notify();}
  }
  async saveBeta(value,persist) {
    if(typeof value!=='boolean'||this.sourceLocked())return {ok:false,error:'Bitte die laufende Updateprüfung abschließen.'};
    this.working=true;this.notify();
    try{await persist(value);this.beta=value;this.status.beta=value;if(this.source)this.configure(this.source);return {ok:true};}
    catch{return {ok:false,error:'Updatekanal konnte nicht verschlüsselt gespeichert werden.'};}
    finally{this.working=false;this.notify();}
  }
  async check() {
    if(this.sourceLocked()||!this.source)return {ok:false,error:'Bitte eine Updatequelle einrichten oder die laufende Prüfung abschließen.'};
    this.working=true;this.status.targetVersion=null;this.status.releaseUrl=null;this.status.releases=[];this.set('checking','GitHub wird auf neue Veröffentlichungen geprüft …');
    try {
      const releases=(await newerReleases(this.source,this.status.version)).filter(r=>this.beta||!r.prerelease);
      this.status.releases=releases;const target=releases[0];
      if(!target){this.set('current','Keine neuere veröffentlichte Version vorhanden.');return {ok:true};}
      this.status.targetVersion=target.version;this.status.releaseUrl=target.url;
      this.set('available',`Version ${target.version} ist verfügbar.${target.downloadable?' Portable ZIP selbst herunterladen und in einen neuen Ordner entpacken.':' Für diese Veröffentlichung wurde keine portable Windows-ZIP gefunden. Release-Seite prüfen.'}`);
      return {ok:true};
    }catch{this.set('error','GitHub konnte nicht vollständig geprüft werden. Bitte später erneut versuchen.');return {ok:false,error:this.status.message};}
    finally{this.working=false;this.notify();}
  }
  releasePage() {
    if(this.sourceLocked()||this.status.state!=='available'||!this.status.releaseUrl)throw Error('Bitte zuerst auf Updates prüfen.');
    const release=this.status.releases.find(r=>r.version===this.status.targetVersion);
    if(!release)throw Error('Veröffentlichung nicht mehr verfügbar. Bitte erneut prüfen.');
    return repositoryUrl(this.source)+'/releases/tag/'+encodeURIComponent(release.tag);
  }
}
