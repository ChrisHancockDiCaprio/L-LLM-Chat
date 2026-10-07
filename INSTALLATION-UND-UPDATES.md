# Qwen Chat 0.2.0 installieren

1. Eine laufende Qwen-Chat-App schließen, nachdem Antworten und Eingaben abgeschlossen sind.
2. `Qwen-Chat-Setup-0.2.0-x64.exe` öffnen. Diese Pilotversion ist noch ohne Windows-Herausgeberzertifikat; Windows kann einen Hinweis anzeigen.
3. Programmordner wählen. Die Installation erfolgt für das aktuelle Windows-Konto. Node.js, Electron oder Python müssen auf dem Zielrechner nicht separat installiert werden.
4. Über Startmenü oder Desktopverknüpfung öffnen. Bestehende Verbindungen und Chats desselben Windows-Kontos werden übernommen. Bei einer frischen Installation Server hinzufügen und Modelle ausdrücklich aktivieren.

Der Tresor liegt fest unter `%LOCALAPPDATA%\QwenChat\Vault`, der Browserzustand unter `%LOCALAPPDATA%\QwenChat\App`. Ein frei wählbarer Tresorpfad ist in dieser Version nicht vorgesehen. Der Installer verhindert, dass der Programmordner mit dem Tresor oder dessen übergeordnetem Ordner überlappt. App-ID `sol.qwen-chat`, Datenordner und Dateiformate bleiben bei Updates stabil.

## Aktualisieren und entfernen

Ein neues Setup über die bestehende Installation installieren. Der Installer ersetzt die Programmdateien. Verlauf, Einstellungen, Zugänge und Anhänge liegen außerhalb davon und bleiben erhalten. Auch die Windows-Deinstallation entfernt den Tresor nicht. Zum endgültigen Entfernen persönlicher Daten muss der Benutzer den Tresor selbst entfernen; der Installer führt das nicht aus.

Windows DPAPI bindet die Dateien an das Windows-Benutzerkonto. Eine Kopie des Tresors ist allein keine portable Wiederherstellung auf einem neuen Konto oder Rechner.

## GitHub-Releases

Vorgesehene Quelle: https://github.com/ChrisHancockDiCaprio/L-LLM-Chat.

Das Repository bleibt auf Benutzerwunsch privat. Die App ist für spätere öffentliche Releases vorbereitet, enthält keinen GitHub-Zugang und kann private Releases deshalb nicht abrufen. Vorerst Setup-Dateien direkt oder nach Anmeldung auf GitHub beziehen. Das Veröffentlichen des Repositorys wird nicht automatisch vorgenommen.

Die installierte App hat einen Updates-Reiter zum Prüfen und ausdrücklichen Herunterladen. SHA-512 und Transportprüfung ersetzen keine Herausgebersignatur. Die automatische Installation ist in der unsignierten Pilotversion fest gesperrt, ebenso automatische Downloads und Installation beim Beenden. Für eine spätere Freigabe werden ein gültiges Windows-Code-Signing-Zertifikat, verifizierte signierte Installer und eine an den erwarteten Herausgeber gebundene Prüfung benötigt. Die vorhandene Sicherungs-/Neustartlogik allein hebt diese Sperre nicht auf.

Die Update-Vorbereitung kann verschlüsselte Kopien aller erforderlichen Tresordateien einschließlich Anhängen unter `Vault\BeforeUpdate` erstellen. Eine fehlgeschlagene Sicherung blockiert den vorgesehenen automatischen Neustart. Manuelle Setup-Updates erhalten die vorhandenen Dateien direkt und erzeugen derzeit keine automatische Versionssicherung.

## Für Entwickler

- `npm ci`, danach bei Bedarf `node node_modules/electron/install.js`.
- `npm test`: Netzwerk-, Verschlüsselungs-, Verlauf-, Anhang- und Updateprüfungen.
- `npm run dist`: Windows-x64-Setup, Blockmap und `latest.yml` erstellen. Es wird nichts hochgeladen.
- `node scripts/check-package.mjs`: prüfen, dass der Installer keine Benutzertresore und keine Entwicklungslaufzeit enthält.
- `.github/workflows/windows-release.yml`: reproduzierbarer Windows-Build und Prüfungen. Ein Tag `v<package-Version>` erstellt nach erfolgreichem Build einen GitHub-Release-Entwurf. Ein manueller Workflowlauf erzeugt herunterladbare Build-Artefakte. CI-Zugang nur über das kurzlebige GitHub-Token im Runner.
- Ein Release benötigt Setup, passende `.blockmap` und `latest.yml` derselben Version. Den Entwurf erst nach Prüfung freigeben. Für öffentliche Updates muss die Quelle öffentlich abrufbar sein.

Das Icon ist das unveränderte SVG des SoL-Weltenatlas. PNG und Windows-ICO sind daraus abgeleitet.

## Lokale Verifikation

45 automatisierte Prüfungen bestanden. Ein isolierter realer Setup-Lauf installierte 0.2.0 und aktualisierte auf eine Testversion 0.2.1; Gespräche, Modellauswahl und Zugang blieben lesbar. Der zuletzt erzeugte unsignierte Testinstaller wurde anschließend von der Windows-Anwendungssteuerung blockiert. Die endgültige Verzeichnis-Sperre konnte deshalb nicht in diesem Installer ausgeführt werden. Ihre Umsetzung ist enthalten, aber diese letzte Laufzeitprüfung bleibt offen. Windows-Sicherheitsrichtlinien wurden nicht verändert.

Ein temporäres NSIS-Buildprogramm war ebenfalls blockiert. Der Build verwendet deshalb den vorhandenen statischen Binärleser von electron-builder, um den Deinstaller ohne Ausführung dieses temporären Programms zu erzeugen. Das umgeht keine Richtlinie zur Ausführung der fertigen App oder des fertigen Installers.

Quellen: [NSIS-Installer](https://www.electron.build/v26/docs/nsis/), [electron-updater](https://www.electron.build/v26/docs/features/auto-update/).
