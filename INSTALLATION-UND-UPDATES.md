# KAIROS installieren

Aktueller Stand **0.3.0**: siehe [WORKFLOW-PROFILE.md](WORKFLOW-PROFILE.md) und [Releasehinweise](release/notes-0.3.0.md). KAIROS hieß bisher Qwen Chat; App-ID und Tresorpfad bleiben erhalten. Setup-Dateien heißen jetzt `KAIROS-Setup-0.3.0-x64.exe` / `.msi`. Ältere Installations- und Prüfstände unten sind historisch.

1. Eine laufende Qwen-Chat-App schließen, nachdem Antworten und Eingaben abgeschlossen sind.
2. `Qwen-Chat-Setup-0.2.2-x64.exe` öffnen. Diese Pilotversion ist noch ohne Windows-Herausgeberzertifikat; die Windows-Anwendungssteuerung kann die Ausführung blockieren. Sicherheitsrichtlinien nicht verändern.
3. Programmordner wählen. Die Installation erfolgt für das aktuelle Windows-Konto. Node.js, Electron oder Python müssen auf dem Zielrechner nicht separat installiert werden.
4. Über Startmenü oder Desktopverknüpfung öffnen. Bestehende Verbindungen und Chats desselben Windows-Kontos werden übernommen. Bei einer frischen Installation Server hinzufügen und Modelle ausdrücklich aktivieren.

Der Tresor liegt fest unter `%LOCALAPPDATA%\QwenChat\Vault`, der Browserzustand unter `%LOCALAPPDATA%\QwenChat\App`. Ein frei wählbarer Tresorpfad ist in dieser Version nicht vorgesehen. Der Installer verhindert, dass der Programmordner mit dem Tresor oder dessen übergeordnetem Ordner überlappt. App-ID `sol.qwen-chat`, Datenordner und Dateiformate bleiben bei Updates stabil.

## MSI-Pre-Release 0.2.2

Zusätzlich zum bisherigen EXE-Setup gibt es `Qwen-Chat-Setup-0.2.2-x64.msi` als echte Windows-Installer-Datei. Die MSI installiert für das aktuelle Benutzerkonto fest nach `%LOCALAPPDATA%\Programs\Qwen Chat MSI`. Sie startet die App nach der Installation nicht automatisch. Deinstallation erfolgt über Windows „Installierte Apps“. Der externe Tresor `%LOCALAPPDATA%\QwenChat\Vault` ist kein Bestandteil der MSI und bleibt erhalten.

Die MSI ersetzt die bisherige NSIS-/EXE-Installation nicht automatisch. Für einen Wechsel zuerst die App mit abgeschlossenen Eingaben schließen, die bisherige EXE-Installation über Windows deinstallieren (Tresor bleibt erhalten), dann die MSI installieren. MSI-Updates ersetzen künftig frühere MSI-Versionen mit demselben Upgrade-Code. Der App-Updater verwendet weiterhin das EXE-Setup; er installiert keine MSI. Die MSI ist unsigniert und hebt die bekannte Windows-Anwendungssteuerungsblockade der Programmdatei nicht auf. Ein vollständiger MSI-Installations-/Deinstallationslauf ist noch nicht bestätigt.

Für Entwickler: `npm run dist:msi` erzeugt die MSI unter `dist-msi-release`. Mit `-- --prepackaged dist-release/win-unpacked` wird eine bereits gebaute App verwendet. Der Build-Hook `scripts/msi-per-user.cjs` setzt einen festen Programmordner und verhindert eine Installation für alle Benutzer. MSI-Version, Upgrade-Code, Dateiliste und Ordneraktion werden vor Veröffentlichung lesend geprüft; kein Benutzer-Tresor wird dabei verändert. Die lokale WiX-ICE-Validierung wird von einer Windows-Systemrichtlinie blockiert. Sie wird nicht unterdrückt; der Build erfolgt mit vollständiger Validierung auf dem GitHub-Windows-Runner.

## EXE-Updates und Deinstallation

Ein neues Setup über die bestehende Installation installieren. Der Installer ersetzt die Programmdateien. Verlauf, Einstellungen, Zugänge und Anhänge liegen außerhalb davon und bleiben erhalten. Auch die Windows-Deinstallation entfernt den Tresor nicht. Zum endgültigen Entfernen persönlicher Daten muss der Benutzer den Tresor selbst entfernen; der Installer führt das nicht aus.

Windows DPAPI bindet die Dateien an das Windows-Benutzerkonto. Eine Kopie des Tresors ist allein keine portable Wiederherstellung auf einem neuen Konto oder Rechner.

## GitHub-Releases

Vorgesehene Quelle: https://github.com/ChrisHancockDiCaprio/L-LLM-Chat.

Der Benutzer hat das Repository öffentlich gestellt. Die App benötigt für öffentliche Updates keinen GitHub-Zugang. Unter **Einstellungen → Updates → GitHub-Repository für Updates** kann eine andere Repository-Hauptadresse eingetragen werden. **Prüfen & speichern** prüft öffentliche Erreichbarkeit und veröffentlichte Windows-Assets und übernimmt die Adresse verschlüsselt in `settings.vault`. Fehlgeschlagene Prüfungen behalten die alte Quelle bei. Noch fehlende Releases blockieren das Speichern nicht; Entwürfe zählen nicht als veröffentlichte Updates. Während eines Updatevorgangs bleibt die Quelle gesperrt. Nach einem bereits geladenen Update ist vor dem Quellenwechsel ein App-Neustart erforderlich.

Die installierte App hat einen Updates-Reiter zum Prüfen und ausdrücklichen Herunterladen. SHA-512 und Transportprüfung ersetzen keine Herausgebersignatur. Die automatische Installation ist in der unsignierten Pilotversion fest gesperrt, ebenso automatische Downloads und Installation beim Beenden. Für eine spätere Freigabe werden ein gültiges Windows-Code-Signing-Zertifikat, verifizierte signierte Installer und eine an den erwarteten Herausgeber gebundene Prüfung benötigt. Die vorhandene Sicherungs-/Neustartlogik allein hebt diese Sperre nicht auf.

Die Update-Vorbereitung kann verschlüsselte Kopien aller erforderlichen Tresordateien einschließlich Anhängen unter `Vault\BeforeUpdate` erstellen. Eine fehlgeschlagene Sicherung blockiert den vorgesehenen automatischen Neustart. Manuelle Setup-Updates erhalten die vorhandenen Dateien direkt und erzeugen derzeit keine automatische Versionssicherung.

## Für Entwickler

- `npm ci`, danach bei Bedarf `node node_modules/electron/install.js`.
- `npm test`: Netzwerk-, Verschlüsselungs-, Verlauf-, Anhang- und Updateprüfungen.
- `npm run dist`: Windows-x64-Setup, Blockmap und `latest.yml` erstellen. Es wird nichts hochgeladen.
- `npm run dist:msi`: zusätzliches Windows-x64-MSI-Paket erstellen. Es wird nichts hochgeladen.
- `node scripts/check-package.mjs`: prüfen, dass der Installer keine Benutzertresore und keine Entwicklungslaufzeit enthält.
- `.github/workflows/windows-release.yml`: reproduzierbarer Windows-Build und Prüfungen. Ein Tag `v<package-Version>` erstellt nach erfolgreichem Build einen GitHub-Release-Entwurf. Ein manueller Workflowlauf erzeugt herunterladbare Build-Artefakte. CI-Zugang nur über das kurzlebige GitHub-Token im Runner.
- Ein Release benötigt Setup, passende `.blockmap` und `latest.yml` derselben Version. Den Entwurf erst nach Prüfung freigeben. Für öffentliche Updates muss die Quelle öffentlich abrufbar sein.

Das Icon ist das unveränderte SVG des SoL-Weltenatlas. PNG und Windows-ICO sind daraus abgeleitet.

## Lokale Verifikation

Version 0.2.2: 66 automatisierte Prüfungen und isolierter Electron-Fenstertest bestanden. Der Fenstertest deckt eine vollständige native ComfyUI-Anfrage mit künstlichen Antworten, Parameterzuordnung, Bildanzeige, Datei-Export und verschlüsselte Speicherung ab. Repositorywechsel, ungültige Adresse und öffentlicher Release-Status wurden ebenfalls geprüft. GitHub ist ohne Anmeldung erreichbar, hat aber derzeit noch kein stabiles veröffentlichtes Release. ComfyUI auf Port 8188 ist jetzt erreichbar und meldet GGUF-Knoten. Der echte Qwen-Image-Lauf wartet auf den Benutzer-Workflow und seine Zuordnungen. Es wurde kein realer Benutzer-Tresor verändert. Der Build liegt separat in `dist-update-0.2.2`. Alle neun Verzeichnis-Prüfungen des finalen Setups bestanden ohne Installation. Die gepackte unsignierte Programmdatei 0.2.2 wird weiterhin von der Windows-Anwendungssteuerung blockiert; eine finale Installation und der Start dieser Programmdatei sind nicht bestätigt. Die laufende 0.2.0 bleibt unverändert. Das Paket enthält keine Benutzer-Tresore oder Entwicklungslaufzeit.

Version 0.2.1: 56 automatisierte Prüfungen und ein eigener isolierter Fenstertest bestanden. Eine frühere gepackte 0.2.1-Ausgabe öffnete den vorhandenen 0.2.0-Testtresor einschließlich Chat, Modellauswahl, Zugang und Bild. Die finale Setup-Datei bestand neun Verzeichnisprüfungen im reinen Prüfmodus, ohne Installation: Tresor, Unterordner, Elternordner, Laufwerkswurzel, Groß-/Kleinschreibung, ..-Normalisierung, normaler Programmordner, ähnlich benannter Nachbar und neuer sicherer Ordner. Eine Schwäche bei abschließenden Pfadtrennern und noch nicht angelegten Verzeichnissen wurde dabei korrigiert.

Beim abschließenden Start blockierte die Windows-Anwendungssteuerung jedoch die neu erzeugte unsignierte Programmdatei. Die endgültige gepackte App wurde deshalb nicht ausgeführt, und ein vollständiger realer Installationslauf dieser finalen Version bleibt offen. Die laufende 0.2.0-Installation wurde nicht ersetzt. Das neue Setup ist ein Testentwurf; vor dem normalen Update muss die vertrauenswürdige Windows-Signierung geklärt werden. Keine Richtlinie wurde deaktiviert und kein alternativer Loader für das blockierte Programm verwendet.

Zum Update-Test zuerst in der bisherigen Version einen kurzen Chat hinterlassen, Eingaben abschließen und die App schließen. Dann das neue Setup über den bestehenden Programmordner installieren und den alten Chat öffnen. Der Windows-Tresorpfad bleibt gleich. Die bisherigen Programmdateien werden während des Builds nicht überschrieben; die neue lokale Ausgabe liegt in `dist-update-0.2.1`.

45 automatisierte Prüfungen bestanden. Ein isolierter realer Setup-Lauf installierte 0.2.0 und aktualisierte auf eine Testversion 0.2.1; Gespräche, Modellauswahl und Zugang blieben lesbar. Der zuletzt erzeugte unsignierte Testinstaller wurde anschließend von der Windows-Anwendungssteuerung blockiert. Die endgültige Verzeichnis-Sperre konnte deshalb nicht in diesem Installer ausgeführt werden. Ihre Umsetzung ist enthalten, aber diese letzte Laufzeitprüfung bleibt offen. Windows-Sicherheitsrichtlinien wurden nicht verändert.

Ein temporäres NSIS-Buildprogramm war ebenfalls blockiert. Der Build verwendet deshalb den vorhandenen statischen Binärleser von electron-builder, um den Deinstaller ohne Ausführung dieses temporären Programms zu erzeugen. Das umgeht keine Richtlinie zur Ausführung der fertigen App oder des fertigen Installers.

Quellen: [NSIS-Installer](https://www.electron.build/v26/docs/nsis/), [electron-updater](https://www.electron.build/v26/docs/features/auto-update/).
