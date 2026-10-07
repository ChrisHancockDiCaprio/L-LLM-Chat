import { githubSource, repositoryUrl, probeUpdateRepository, newerReleases } from './update-source.mjs';
export class UpdateManager {
  constructor({ updater, packaged, source, version, beta = false, notify = () => {}, isBusy = () => false, beforeInstall = async () => {}, installAllowed = false }) {
    this.updater = updater; this.packaged = packaged; this.isBusy = isBusy; this.beforeInstall = beforeInstall; this.notify = notify; this.installAllowed = installAllowed; this.working = false; this.beta = beta === true;
    this.status = { state: 'disabled', version, message: packaged ? 'GitHub-Updates sind noch nicht eingerichtet.' : 'GitHub-Updates sind in der installierten App verfügbar.', progress: 0, targetVersion: null, beta: this.beta, releases: [], installAllowed };
    updater.logger = null; updater.autoDownload = false; updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false; updater.allowPrerelease = this.beta; updater.disableWebInstaller = true;
    updater.on('checking-for-update', () => this.set('checking', 'GitHub wird auf neue Versionen geprüft …'));
    updater.on('update-available', info => { this.status.targetVersion = String(info.version).slice(0, 40); this.set('available', `Version ${this.status.targetVersion} ist verfügbar.`); });
    updater.on('update-not-available', () => this.set('current', 'Du verwendest die aktuelle veröffentlichte Version.'));
    updater.on('download-progress', progress => { this.status.progress = Math.max(0, Math.min(100, Number(progress.percent) || 0)); this.set('downloading', 'Update wird heruntergeladen und geprüft …'); });
    updater.on('update-downloaded', () => this.set('downloaded', installAllowed ? 'Update bereit. Installation startet erst auf deinen Klick.' : 'Update geladen. Die automatische Installation benötigt eine signierte Veröffentlichung.'));
    updater.on('error', () => this.set('error', 'Das Update konnte nicht sicher geprüft oder geladen werden. Deine Chats bleiben erhalten.'));
    if (source?.provider === 'github') this.configure(source);
  }
  configure(source) {
    this.updater.channel = 'latest'; this.updater.allowDowngrade = false;
    const valid = githubSource(repositoryUrl(source));
    if (this.packaged) this.updater.setFeedURL({ ...valid, private: false });
    this.source = valid;
    this.status = { ...this.status, state: this.packaged ? 'idle' : 'disabled', message: this.packaged ? 'Bereit für GitHub-Releases.' : 'Updateprüfung ist in der installierten App verfügbar.', repository: repositoryUrl(valid), progress: 0, targetVersion: null, releases: [] };
  }
  sourceLocked() { return this.working || this.status.sourceChecking || ['checking', 'downloading', 'installing', 'downloaded'].includes(this.status.state); }
  async saveRepository(value, persist) {
    if (this.sourceLocked()) return { ok: false, error: 'Bitte den laufenden Vorgang abschließen. Nach einem geladenen Update die App vor dem Quellenwechsel neu starten.' };
    this.status.sourceChecking = true; this.notify();
    const previousSource = this.source; const previousStatus = this.snapshot();
    let result;
    try {
      try { result = await probeUpdateRepository(value); }
      catch (error) { return { ok: false, error: error.message }; }
      this.configure(result.source);
      try { await persist(result.repository); }
      catch (error) { if (previousSource) this.configure(previousSource); this.status = previousStatus; throw error; }
      this.status.sourceMessage = result.notice;
      return { ok: true, notice: result.notice };
    } catch { return { ok: false, error: 'Repository nicht übernommen. Adresse, öffentliche Erreichbarkeit und verschlüsselten Speicher prüfen.' }; }
    finally { this.status.sourceChecking = false; this.notify(); }
  }
  async saveBeta(value, persist) {
    if (typeof value !== 'boolean' || this.sourceLocked()) return { ok: false, error: 'Bitte den laufenden Updatevorgang abschließen.' };
    this.working = true; this.notify();
    try {
      await persist(value); this.beta = value; this.status.beta = value;
      this.updater.allowPrerelease = value; this.configure(this.source); return { ok: true };
    } catch { return { ok: false, error: 'Updatekanal konnte nicht verschlüsselt gespeichert werden.' }; }
    finally { this.working = false; this.notify(); }
  }
  snapshot() { return { ...this.status, operationBusy: this.working }; }
  set(state, message) { this.status.state = state; this.status.message = message; this.notify(); }
  async check() {
    if (this.sourceLocked() || this.status.state === 'disabled') return { ok: false, error: this.status.message };
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') return { ok: false, error: 'Die TLS-Prüfung darf für Updates nicht deaktiviert sein.' };
    this.working = true; this.set('checking', 'GitHub wird geprüft …');
    try {
      if (this.beta) {
        const releases = await newerReleases(this.source, this.status.version); this.status.releases = releases;
        const target = releases.find(r => r.downloadable);
        if (!target) { this.set('current', releases.length ? 'Neuere Veröffentlichungen gefunden, aber ohne Windows-Updatedateien.' : 'Keine neuere veröffentlichte Version vorhanden.'); return { ok: true }; }
        const feed = repositoryUrl(this.source) + '/releases/download/' + encodeURIComponent(target.tag) + '/';
        this.updater.channel = target.channel; this.updater.allowDowngrade = false;
        this.updater.setFeedURL({ provider: 'generic', url: feed });
      } else { this.updater.channel = 'latest'; this.updater.allowDowngrade = false; this.updater.setFeedURL({ ...this.source, private: false }); }
      await this.updater.checkForUpdates(); return { ok: true };
    }
    catch { this.set('error', 'Die GitHub-Veröffentlichungen sind derzeit nicht erreichbar oder noch nicht vorhanden.'); return { ok: false, error: this.status.message }; }
    finally { this.working = false; this.notify(); }
  }
  async download() {
    if (this.sourceLocked() || this.status.state !== 'available') return { ok: false, error: 'Bitte zuerst auf Updates prüfen.' };
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') return { ok: false, error: 'Die TLS-Prüfung darf für Updates nicht deaktiviert sein.' };
    this.working = true; this.set('downloading', 'Update wird heruntergeladen …');
    try { await this.updater.downloadUpdate(); return { ok: true }; }
    catch { this.set('error', 'Der Update-Download konnte nicht sicher abgeschlossen werden.'); return { ok: false, error: this.status.message }; }
    finally { this.working = false; this.notify(); }
  }
  async install() {
    if (!this.installAllowed) return { ok: false, error: 'Für die automatische Installation fehlt eine signierte Release-Konfiguration. Nutze vorerst die Setup-Datei.' };
    if (this.working || this.status.sourceChecking) return { ok: false, error: 'Bitte den laufenden Update-Vorgang abschließen.' };
    if (this.status.state !== 'downloaded') return { ok: false, error: 'Es ist noch kein Update zur Installation bereit.' };
    if (this.isBusy()) return { ok: false, error: 'Bitte erst die laufende Antwort oder Einstellungsänderung abschließen.' };
    this.set('installing', 'Der verschlüsselte Tresor wird gesichert …');
    try { await this.beforeInstall(); }
    catch { this.set('downloaded', 'Die Tresorsicherung ist fehlgeschlagen. Das Update wurde nicht installiert.'); return { ok: false, error: this.status.message }; }
    this.updater.quitAndInstall(false, true); return { ok: true };
  }
}
