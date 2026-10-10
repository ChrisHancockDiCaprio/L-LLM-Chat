# lazy-val-Nachweis und portable KAIROS-Ausgabe

Stand: 10.10.2026. Nutzerauftrag: Originalnachweis beschaffen; falls nicht belastbar verfügbar, automatischen Updater entfernen und auf portable Ausgabe mit Updateprüfung und manuellem Download umstellen.

## Recherche und Entscheidung

`lazy-val` 1.0.5 nennt MIT und Vladimir Krivosheev in seinen Originalmetadaten. Ein vollständiger Original-Lizenztext wurde bei dieser Recherche nicht gefunden. Die MIT-Deklaration wird dadurch nicht als fehlende Lizenz oder als Sicherheitsfehler dargestellt.

Geprüft wurden:

- [Original-Repository](https://github.com/develar/lazy-val) und seine acht öffentlich sichtbaren Commit-Bäume, einschließlich des ersten Commits `6a34c8a7d7dfb761db07a156564bdc63af4c6632` und des aktuellen `b69ad4119f1b19bdab13c61ee2fcc88d46b89071`: keine Datei mit LICENSE-, COPYING-, NOTICE- oder Copyright-Nachweis gefunden.
- Originalpakete 1.0.3, 1.0.4 und [1.0.5 aus npm](https://registry.npmjs.org/lazy-val/-/lazy-val-1.0.5.tgz): Paketmetadaten, README und kompiliertes Programm enthalten; keine vollständige Lizenzdatei. SHA-256 des geprüften 1.0.5-Archivs: `7d8602ad98db3d19fbd5b46fbf3831dd996197a013ef1ff7badc205e41435372`.
- Drittanbieter-Nachweise existieren, betreffen teilweise 1.0.4 oder nennen einen ausdrücklich ergänzten Standardtext. Sie wurden nicht als Original-Lizenznachweis für unsere Version übernommen. Keine Copyright-Jahre oder Autorhinweise wurden erfunden. Keine Kontaktaufnahme mit dem Autor erfolgt.

Die ausdrücklich freigegebene Alternative wurde umgesetzt: `electron-updater` entfernt, damit auch die betreffende indirekte Laufzeitabhängigkeit. Originale frühere Nachweise liegen unverändert unter `kairos-license-history/pre-portable-0.5.0/` außerhalb des Programm-Pakets. Es wurde kein Ersatzcode aus lazy-val kopiert.

## Portable 0.5.1

Der aktuelle Build erzeugt `KAIROS-Portable-0.5.1-x64.zip` mit Electron und den benötigten Bibliotheken. ZIP vollständig entpacken; `KAIROS.exe` starten. Keine Node.js-Installation erforderlich. Neben der EXE liegen erforderliche Laufzeitdateien, originale Electron-/Chromium-Nachweise und die portable Anleitung.

Der Programmordner ist verschiebbar. Der bestehende Tresor bleibt unter `%LOCALAPPDATA%\QwenChat\Vault`; vertrauliche Daten werden nicht mit dem Programm auf einen USB-Stick verschoben. Windows-Verschlüsselung bleibt an das aktuelle Benutzerkonto gebunden. Eine Tresorkopie ist keine plattform- oder kontounabhängige Wiederherstellung.

KAIROS liest ausschließlich öffentliche GitHub-Release-Metadaten. „Release-Seite öffnen“ konstruiert die URL aus der validierten Quelle und dem Release-Tag; eine vom Server mitgelieferte fremde URL wird nicht übernommen. Entwürfe und ältere Versionen werden ausgeblendet, Beta ist optional. Vorhandene Installer-Releases werden als Veröffentlichung ohne portable ZIP erklärt. Es werden weder Programmupdates heruntergeladen noch Installationsprogramme ausgeführt oder eigene Programmdateien ersetzt. Die bisherigen Download-/Installationsaufrufe wurden auch aus der begrenzten Fensterschnittstelle entfernt.

Manueller Wechsel: neue ZIP selbst herunterladen und in einen neuen Ordner entpacken, KAIROS schließen, neue EXE starten. Den vorherigen Programmordner zur Prüfung behalten. Dasselbe Windows-Konto verwendet weiterhin den bisherigen Tresor.

## Prüfungen

- Produktions-Abhängigkeitsprüfung: weder `electron-updater` noch `lazy-val` in der Laufzeitkette. 14 Produktionspakete, 16 unveränderte Originalnachweisdateien; keine fehlenden Lizenztexte laut Inventar. Der Inventarisierer lehnt fehlende Originaldateien jetzt ohne lazy-val-Ausnahme ab.
- 113 automatisierte Node-Tests bestanden, einschließlich Anbieter, verschlüsselter Speicherung, SSH und neuer manueller Updateprüfung. Frühere Installertests wurden durch Tests für Metadatenprüfung, Beta/Entwürfe, sichere Release-URLs, fehlende ZIP-Dateien, Fehler und gesperrte gleichzeitige Quellenänderungen ersetzt.
- Isolierter echter Electron-Test erfolgreich: Chat-/Modelländerungen, ComfyUI-Bilder, verschlüsselte Wiederherstellung, TTS, Formeln und manueller Updateablauf. Browseröffnung wurde im Test ersetzt; kein echter Download und kein Installerstart. Testtresor: `.test-output/portable-update-app-oLDnOd/Vault`.
- Erster Paketlauf: ZIP-Inhalt geprüft; keine Updater-Bibliotheken, Benutzertresore oder Entwicklungswerkzeuge enthalten. Entpackte EXE erfolgreich mit künstlichen Daten gestartet, Programmordner verschoben und erneut gestartet: Chat, Modellparameter, Schlüssel und ein Bildanhang erhalten. Der zusätzliche UI-Pakettest deckte eine Testbild-Ablage im schreibgeschützten Programmarchiv auf; die Prüfroutine wurde auf den Testtresor korrigiert. Endgültige Paketprüfung erfolgreich; siehe unten. Kein normaler Benutzertresor wurde geöffnet. Keine Veröffentlichung und keine Installation vorgenommen.

Die eigene Projektlizenz und jede spätere Fremdübernahme bleiben separat zu prüfen. Die Entfernung schließt die konkrete Nachweislücke im aktuellen Laufzeitpaket; sie ersetzt keine pauschale Rechtsprüfung sämtlicher zukünftiger Inhalte.

## Endgültiger Paketstand

- Fertig: [KAIROS-Portable-0.5.1-x64.zip](https://github.com/ChrisHancockDiCaprio/L-LLM-Chat/releases/download/v0.5.1/KAIROS-Portable-0.5.1-x64.zip). Vollständig entpacken und KAIROS.exe starten. Kein Installer und keine Veröffentlichung.
- ZIP entpackt und geprüft. EXE und Programmarchiv stimmen per Dateihash mit dem vollständig geprüften Programm überein. Keine Updater-/lazy-val-Bestandteile, Entwicklungswerkzeuge oder Benutzertresore enthalten. Originale Laufzeitnachweise und portable Anleitung vorhanden.
- Start aus der endgültigen ZIP, anschließender Ordnerwechsel und Neustart bestanden: Testchat, ausgewähltes Modell, Parameter, Schlüssel und Bildanhang erhalten; Tresor verschlüsselt. Bericht: .test-output/portable-final-zip-14a0f159/test-account/report.json.
- Vollständiger UI-Test mit endgültiger gepackter EXE bestanden: Chat, Bilder, TTS, Formeln, verschlüsselte Wiederherstellung und reine Release-Prüfung mit sicherem Browserlink. Bericht: .test-output/portable-final-ui-4d6cc338/Vault/verification-update.json. Keine echten KI-Anbieteranfragen oder Browserdownloads.
- Hancock und Anbieterablauf nach der Umstellung nochmals bestanden: .test-output/hancock-app-METrhp/Vault/verification-hancock.json und .test-output/providers-app-lElzAU/Vault/verification-providers.json.
- SHA-256 der lokal geprüften ZIP (GitHub baut separat; die veröffentlichte Prüfsumme steht im Release): 2191ab1405a7c430abe99611df84278cab6d264d4534898f8ecd8d1b34180f14. Begleitdatei: [Prüfsumme](https://github.com/ChrisHancockDiCaprio/L-LLM-Chat/releases/download/v0.5.1/KAIROS-Portable-0.5.1-x64.zip.sha256). Windows-Herausgebersignatur: NotSigned.
