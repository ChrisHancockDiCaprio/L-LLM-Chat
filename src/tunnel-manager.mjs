import ssh2 from 'ssh2';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {validateSSH,fingerprint} from './ssh-store.mjs';
import {markTunnel} from './tunnel-security.mjs';
export class TunnelManager {
  constructor(store,{notify=()=>{},clientFactory=()=>new ssh2.Client(),retryDelay=3000}={}){this.store=store;this.notify=notify;this.clientFactory=clientFactory;this.retryDelay=retryDelay;this.entries=new Map();this.pending=new Map();this.closed=false;}
  key(profile){return JSON.stringify(validateSSH(profile.ssh));}
  snapshot(){return {connections:[...this.entries.values()].map(e=>({key:e.key,profileIds:[...e.ids],ssh:e.sshState,tunnel:e.state,detail:e.detail,localPort:e.port})),pending:[...this.pending.values()].map(({id,config,fp})=>({id,host:config.host,port:config.port,fingerprint:fp}))};}
  async confirm(id,accept){const item=this.pending.get(id);if(!item)throw Error('Hostschlüssel-Anfrage ist abgelaufen.');this.pending.delete(id);try{if(accept!==true){item.done(false);return;}await this.store.trust(item.config,item.fp);item.done(true)}catch(e){item.done(false);throw e}finally{this.notify()}}
  async ensure(profile){
    const config=validateSSH(profile.ssh);if(!config)return profile;if(this.closed)throw Error('KAIROS schließt gerade.');
    const key=this.key(profile);let entry=this.entries.get(key);
    if(!entry){entry={key,config,ids:new Set(),state:'idle',sshState:'unknown',detail:'Tunnel noch nicht gestartet.',sockets:new Set(),attempts:0};this.entries.set(key,entry)}
    entry.ids.add(profile.id??'new');
    if(entry.state!=='ready') {if(!entry.connecting)entry.connecting=this.start(entry).finally(()=>{entry.connecting=null});await entry.connecting;}
    return markTunnel({...profile,baseUrl:(config.targetTls?'https':'http')+'://127.0.0.1:'+entry.port,allowHttp:true,ssh:config});
  }
  async start(entry){
    clearTimeout(entry.retry);this.dispose(entry);const conn=this.clientFactory();entry.conn=conn;entry.connectionClosed=false;entry.state='connecting';entry.sshState='checking';entry.detail='SSH-Verbindung und Hostschlüssel werden geprüft …';this.notify();
    const config=entry.config;let keyChanged=false;let hostRejected=false;let established=false;
    try{
      const auth=this.store.get(config);if(config.authType==='agent'&&!auth.agent)throw Error('Kein SSH-Agent verfügbar. Bitte einen Schlüssel importieren.');
      await new Promise((resolve,reject)=>{entry.reject=reject;
        conn.once('ready',()=>{established=true;entry.reject=null;resolve()});
        conn.on('error',()=>{if(!established)reject(Error(keyChanged?'SSH-Hostschlüssel geändert. Verbindung blockiert.':hostRejected?'SSH-Hostschlüssel wurde nicht bestätigt.':'SSH-Verbindung fehlgeschlagen. Host, Agent, Schlüssel oder Passwort prüfen.'));else this.lost(entry)});
        conn.on('close',()=>{entry.connectionClosed=true;if(!established)reject(Error('SSH-Verbindung wurde vor der Anmeldung geschlossen.'));else this.lost(entry)});
        conn.connect({host:config.host,port:config.port,username:config.username,...auth,readyTimeout:120000,keepaliveInterval:15000,keepaliveCountMax:3,
          hostVerifier:(key,done)=>{
            const fp=fingerprint(key);const trusted=this.store.host(config);
            if(trusted){keyChanged=trusted!==fp;if(keyChanged){entry.state='blocked';entry.detail='SSH-Hostschlüssel geändert. Keine automatische Freigabe.';this.notify()}done(!keyChanged);return;}
            const id=randomUUID();entry.state='host-key';entry.detail='Bitte den SSH-Hostschlüssel-Fingerprint bewusst bestätigen.';
            this.pending.set(id,{id,config,fp,done:accepted=>{hostRejected=!accepted;done(accepted)}});this.notify();
          }});
      });
      if(this.closed)throw Error('KAIROS schließt gerade.');
      entry.sshState='authenticated';const server=createServer(socket=>{
        if(entry.state!=='ready'){socket.destroy();return;}
        entry.sockets.add(socket);socket.on('error',()=>socket.destroy());socket.on('close',()=>entry.sockets.delete(socket));
        conn.forwardOut('127.0.0.1',socket.remotePort??0,config.targetHost,config.targetPort,(error,stream)=>{
          if(error){socket.destroy();entry.detail='SSH angemeldet, aber das API-Ziel ist nicht erreichbar.';this.notify();return;}
          stream.on('error',()=>socket.destroy());socket.on('close',()=>stream.destroy());stream.on('close',()=>socket.destroy());socket.pipe(stream).pipe(socket);
        });
      });
      entry.server=server;
      const listen=port=>new Promise((resolve,reject)=>{const fail=error=>{server.off('listening',ready);reject(error)};const ready=()=>{server.off('error',fail);resolve()};server.once('error',fail);server.once('listening',ready);server.listen({host:'127.0.0.1',port,exclusive:true})});
      try{await listen(config.localPort)}catch(error){if(error.code!=='EADDRINUSE'||!config.localPort)throw error;await listen(0)}
      if(entry.connectionClosed||this.closed)throw Error('SSH-Verbindung während des Tunnelaufbaus verloren.');
      server.on('error',()=>this.lost(entry));entry.server=server;entry.port=server.address().port;entry.state='ready';entry.detail='SSH angemeldet · Tunnel auf 127.0.0.1:'+entry.port+' bereit. API-Erreichbarkeit wird separat geprüft.';entry.attempts=0;this.notify();
    }catch(error){
      this.dispose(entry);entry.state=keyChanged?'blocked':'error';entry.sshState=keyChanged?'host-key-changed':'failed';entry.detail=keyChanged?'SSH-Hostschlüssel geändert. Verbindung blockiert.':hostRejected?'SSH-Hostschlüssel nicht bestätigt.':'SSH/Tunnel fehlgeschlagen. Host, Agent, Schlüssel, Passwort und Port prüfen.';
      for(const[id,item]of this.pending)if(item.config===config){this.pending.delete(id);item.done(false)}this.notify();throw Error(entry.detail);
    }
  }
  lost(entry){
    if(this.closed||entry.state!=='ready')return;
    this.dispose(entry);entry.state='lost';entry.sshState='disconnected';entry.detail='SSH-Tunnel verloren. Laufende Anfragen werden nicht erneut gesendet.';this.notify();
    this.reconnect(entry);
  }
  reconnect(entry){
    if(this.closed||entry.state==='blocked'||entry.attempts>=3)return;entry.attempts++;
    entry.retry=setTimeout(()=>{if(!this.closed&&!entry.connecting){entry.connecting=this.start(entry).catch(()=>this.reconnect(entry)).finally(()=>{entry.connecting=null})}},this.retryDelay*entry.attempts);entry.retry.unref?.();
  }
  dispose(entry){if(entry.reject){const reject=entry.reject;entry.reject=null;reject(Error('SSH-Verbindung wurde beendet.'));}for(const socket of entry.sockets)socket.destroy();entry.sockets.clear();entry.server?.close();entry.server=null;entry.conn?.removeAllListeners();entry.conn?.on('error',()=>{});entry.conn?.end();entry.conn=null;}
  close(){this.closed=true;for(const item of this.pending.values())item.done(false);this.pending.clear();for(const entry of this.entries.values()){clearTimeout(entry.retry);this.dispose(entry)}this.notify();}
}
