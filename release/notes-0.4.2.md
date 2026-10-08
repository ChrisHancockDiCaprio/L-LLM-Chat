# KAIROS 0.4.2 · Updates mit ausdrücklicher Bestätigung

Heruntergeladene unsignierte Updates können jetzt über **Installieren & neu starten** installiert werden. Eine native Warnung zeigt Version und GitHub-Quelle; erst **Risiko akzeptieren und installieren** startet den Vorgang. **Abbrechen** ist die Standardauswahl und lässt das geladene Update unverändert. Die Zustimmung gilt nur für diesen einen Versuch.

- Deutlicher Hinweis: Ohne Herausgeberzertifikat ist die Identität des Herausgebers nicht bestätigt. Prüfsummen ersetzen keine Signatur.
- Keine dauerhafte Freigabe, keine automatischen Downloads und keine Installation beim gewöhnlichen Beenden.
- Transport-, Prüfsummen- und bestehende Updater-Signaturprüfungen werden nicht deaktiviert. Windows kann die Ausführung weiterhin blockieren.
- Vor dem Installerstart: geprüfte verschlüsselte Sicherung aller Tresordateien inklusive Workflows, Aufträgen, SSH, TTS und Anhängen. Bei Fehlern oder offenen Vorgängen wird abgebrochen.
- Parallele Installationsversuche werden verhindert; der Status wird nach der Bestätigung erneut geprüft. Startfehler geben die App wieder frei.

**Wechsel von 0.4.1:** Das EXE-Setup einmal manuell über die bestehende EXE-Installation starten. Die alte Version enthält noch die Sperre; die neue Bestätigungsmöglichkeit steht erst nach diesem Update zur Verfügung. Bei einer MSI-Installation weiterhin das passende MSI verwenden; der App-Updater verwendet EXE-Setups.

Validierung: 97 Node-Tests, fünf Python-Tests und isolierter echter Electron-Fenstertest, inklusive Abbruch, Bestätigung, Installer-Aufruf ohne tatsächliche Installation und vollständiger Tresorsicherung. Lokaler Windows-EXE-Build und Paketprüfung; EXE/MSI-Veröffentlichung mit vollständiger MSI-Validierung im GitHub-Windows-Workflow. Ein echter Installer-Neustart wurde lokal nicht ausgeführt.

Formeldarstellung und Qwen-TTS aus 0.4.1 bleiben enthalten. Die Windows-Pilotversion hat weiterhin kein Herausgeberzertifikat.
