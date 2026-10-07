export class UpdateManager {
  constructor({ updater, packaged, source, version, notify = () => {}, isBusy = () => false, beforeInstall = async () => {}, installAllowed = false }) {
    this.updater = updater; this.isBusy = isBusy; this.beforeInstall = beforeInstall; this.notify = notify; this.installAllowed = installAllowed;
    this.status = { state: 'disabled', version, message: packaged ? 'GitHub-Updates sind noch nicht eingerichtet.' : 'GitHub-Updates sind in der installierten App verfügbar.', progress: 0, targetVersion: null, installAllowed };
    if (!packaged || source?.provider !== 'github' || !/^[A-Za-z0-9-]+$/.test(source.owner ?? '') || !/^[A-Za-z0-9_.-]+$/.test(source.repo ?? '')) return;
    updater.logger = null; updater.autoDownload = false; updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false; updater.allowPrerelease = false; updater.disableWebInstaller = true;
    updater.setFeedURL({ provider: 'github', owner: source.owner, repo: source.repo, private: false });
    this.status = { ...this.status, state: 'idle', message: 'Bereit für GitHub-Releases.', repository: `https://github.com/${source.owner}/${source.repo}` };
    updater.on('checking-for-update', () => this.set('checking', 'GitHub wird auf neue Versionen geprüft …'));
    updater.on('update-available', info => { this.status.targetVersion = String(info.version).slice(0, 40); this.set('available', `Version ${this.status.targetVersion} ist verfügbar.`); });
    updater.on('update-not-available', () => this.set('current', 'Du verwendest die aktuelle veröffentlichte Version.'));
    updater.on('download-progress', progress => { this.status.progress = Math.max(0, Math.min(100, Number(progress.percent) || 0)); this.set('downloading', 'Update wird heruntergeladen und geprüft …'); });
    updater.on('update-downloaded', () => this.set('downloaded', installAllowed ? 'Update bereit. Installation startet erst auf deinen Klick.' : 'Update geladen. Die automatische Installation benötigt eine signierte Veröffentlichung.'));
    updater.on('error', () => this.set('error', 'Das Update konnte nicht sicher geprüft oder geladen werden. Deine Chats bleiben erhalten.'));
  }
  snapshot() { return { ...this.status }; }
  set(state, message) { this.status.state = state; this.status.message = message; this.notify(); }
  async check() {
    if (['disabled', 'checking', 'downloading', 'installing', 'downloaded'].includes(this.status.state)) return { ok: false, error: this.status.message };
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') return { ok: false, error: 'Die TLS-Prüfung darf für Updates nicht deaktiviert sein.' };
    this.set('checking', 'GitHub wird geprüft …');
    try { await this.updater.checkForUpdates(); return { ok: true }; }
    catch { this.set('error', 'Die GitHub-Veröffentlichungen sind derzeit nicht erreichbar oder noch nicht vorhanden.'); return { ok: false, error: this.status.message }; }
  }
  async download() {
    if (this.status.state !== 'available') return { ok: false, error: 'Bitte zuerst auf Updates prüfen.' };
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') return { ok: false, error: 'Die TLS-Prüfung darf für Updates nicht deaktiviert sein.' };
    this.set('downloading', 'Update wird heruntergeladen …');
    try { await this.updater.downloadUpdate(); return { ok: true }; }
    catch { this.set('error', 'Der Update-Download konnte nicht sicher abgeschlossen werden.'); return { ok: false, error: this.status.message }; }
  }
  async install() {
    if (!this.installAllowed) return { ok: false, error: 'Für die automatische Installation fehlt eine signierte Release-Konfiguration. Nutze vorerst die Setup-Datei.' };
    if (this.status.state !== 'downloaded') return { ok: false, error: 'Es ist noch kein Update zur Installation bereit.' };
    if (this.isBusy()) return { ok: false, error: 'Bitte erst die laufende Antwort oder Einstellungsänderung abschließen.' };
    this.set('installing', 'Der verschlüsselte Tresor wird gesichert …');
    try { await this.beforeInstall(); }
    catch { this.set('downloaded', 'Die Tresorsicherung ist fehlgeschlagen. Das Update wurde nicht installiert.'); return { ok: false, error: this.status.message }; }
    this.updater.quitAndInstall(false, true); return { ok: true };
  }
}
