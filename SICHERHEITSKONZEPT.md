# Sicherheit des Windows-Chats

## Umgesetzt

Verbindungen, Modellparameter und Auswahl liegen verschlüsselt in `settings.vault`, Zugangsdaten getrennt in `credentials.vault`, Gespräche in `history.vault`. Der normale Speicherort ist `%LOCALAPPDATA%\QwenChat\Vault`, außerhalb des Quellcodes und des Projektordners. Electron-Betriebsdateien liegen daneben unter `App`. Im Projekt wird kein Schlüssel und keine neue Klartextkonfiguration angelegt.

Die Verschlüsselung nutzt Electrons asynchrones `safeStorage` mit Windows DPAPI. Der Schutz hängt am Windows-Benutzerkonto; das Programm hat kein fest eingebautes Verschlüsselungspasswort. Ohne verfügbaren Windows-Schutz beendet es den Start. Beschädigte oder nicht entschlüsselbare Tresore werden erhalten und nicht durch leere Daten ersetzt. Temporäre Speicherkopien sind ebenfalls verschlüsselt. Schreiben und Wiederlesen werden vor dem Ersetzen einer Datei geprüft. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

Beim ersten Start übernimmt die App die bisherigen `data/history.json` und `data/settings.json`. Erst nach Prüfung der tatsächlich geschriebenen verschlüsselten Kopie entfernt sie die jeweilige Klartextdatei. Alte Historie-/Einstellungen-Sicherungen und temporäre Dateien werden ebenfalls als verschlüsselte Migrationskopien erhalten. Ein unterbrochener Umzug überschreibt keinen neueren Tresor. Die ursprüngliche Aktivierung und Modellauswahl bleiben erhalten.

Die Oberfläche erhält Zugangsart und eine Referenz, keine gespeicherten Passwörter oder Schlüssel. Neue Eingaben passieren kurz das Formular und den geschützten IPC-Kanal; danach werden die Felder geleert. Zugangsdaten werden weder als URL-Parameter noch in Nachrichten an ein Modell eingebettet. Sie bleiben im Hauptprozess. Die Oberfläche hat keinen allgemeinen Node-, Dateisystem- oder Shellzugriff, keine Netzwerkfreigabe und verwendet eine flüchtige Browser-Sitzung. Nachrichtentexte werden ohne HTML-Ausführung angezeigt. Es gibt keine Klartext-Exportfunktion für den Tresor und keine Protokollierung von Zugangsdaten oder Server-Fehlertexten.

## Übertragung

Neue Verbindungen benötigen HTTPS. API-Schlüssel und Benutzername/Passwort werden ausschließlich mit HTTPS gesendet. Die normale Zertifikatsprüfung bleibt aktiv; selbstsignierte/unbekannte Zertifikate werden nicht automatisch akzeptiert. Eine über die Umgebung abgeschaltete Node-TLS-Prüfung wird erkannt und blockiert. Die App folgt keinen HTTP-Weiterleitungen, damit Zugangsdaten nicht an eine andere Adresse gelangen. Der Zugang ist im Tresor an die vollständige Server-Origin einschließlich Port gebunden. Ein Adresswechsel entfernt die bisherige Zugangsreferenz.

Auf ausdrücklichen Wunsch darf der bisherige Ollama-Server vorübergehend über HTTP im Heimnetz genutzt werden. Für weitere HTTP-Adressen muss die Ausnahme bewusst gesetzt werden. Sie gilt nur für numerische private IPv4-Adressen, Loopback oder localhost und immer ohne Zugangsdaten. Hostnamen und öffentliche/CGNAT-Adressen benötigen HTTPS. HTTP verschlüsselt weder die Modellliste noch Chat-Inhalte. Private Adressen beweisen keinen sicheren Netzwerkpfad und keinen VPN-Schutz.

Ein VPN kann die Strecke zwischen seinen Endpunkten verschlüsseln. Die App erkennt oder erzwingt derzeit keinen VPN-Tunnel. Das Ziel „außerhalb meines Netzwerks nur per VPN erreichbar“ muss auf Server, Firewall und Router durchgesetzt werden: keine öffentliche Ollama-Portfreigabe; Zugriff nur aus erlaubten LAN-/VPN-Netzen; Regeln für IPv4 und IPv6 prüfen. HTTPS bleibt auch über VPN sinnvoll und ist für Zugänge in dieser App Pflicht. Der VPN-Aufbau und die Server-Firewall wurden hier nicht verändert.

## Den Server eines Freundes nutzen

Die Serververwaltung unterstützt `Authorization: Bearer …` für einen API-Schlüssel und HTTP Basic für Benutzername/Passwort. Basic ist lediglich eine Kodierung; die Vertraulichkeit kommt hier von HTTPS. Die App setzt den Header für Modellliste, Modellinformationen und Chat. 401 und 403 werden verständlich angezeigt. Schlüssel bleiben beim Bearbeiten unsichtbar; ein leeres Schlüssel-/Passwortfeld behält den vorhandenen Zugang für dieselbe Adresse und Zugangsart. Auswahl „Ohne Zugangsdaten“ entfernt den Zugang von den neu abgefragten Modellprofilen.

Lokales Ollama verlangt von sich aus keine Authentifizierung. Ein eingegebenes Passwort schützt einen offenen Ollama-Server deshalb nicht automatisch. Der Freund muss einen tatsächlich prüfenden HTTPS-Gateway/Reverse-Proxy mit passender Zugangsart betreiben. `/api/tags`, `/api/show` und `/api/chat` müssen erreichbar und gleichermaßen geschützt sein. Ein erfolgreicher Aufruf beweist allein nicht, dass ein Gateway die Zugangsdaten geprüft hat. [Ollama Authentifizierung](https://docs.ollama.com/api/authentication)

Für die App einen eigenen widerrufbaren Zugang mit möglichst begrenzten Rechten verwenden. Das private Hauptpasswort des Freundes gehört nicht in die App. Der Betreiber des Zielservers kann die ihm zur Verarbeitung übergebenen Chat-Inhalte sehen. Beim Modellwechsel kann auch der ausgewählte Kontext des bisherigen Gesprächs an diesen Server gehen; für getrennte Inhalte ein neues Gespräch beginnen.

## Authenticator als Sitzungsschutz – Konzept

Ja, eine Authenticator-App kann später als zusätzlicher Faktor zum Freigeben einer Sitzung dienen. Für Qwen Chat wird dafür ein eigener TOTP-Eintrag mit eigenem zufälligen Geheimnis eingerichtet. Codes oder Einrichtungsschlüssel anderer Dienste werden nicht wiederverwendet.

Der kurzlebige sechsstellige Code ist kein Verschlüsselungsschlüssel: Er wechselt laufend, hat einen kleinen Wertebereich und dient dem Nachweis des Besitzes eines zuvor eingerichteten Geheimnisses. Auch dieses TOTP-Geheimnis müsste geschützt gespeichert werden. TOTP setzt ein gemeinsames Geheimnis und die Prüfung von Zeitfenstern voraus. [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html)

Vorgeschlagener späterer Ablauf: Tresorpassphrase mit geeigneter langsamer Schlüsselableitung oder eine sauber integrierte Windows-Hello-Freigabe; optional zusätzlich TOTP; begrenzte Fehlversuche, Schutz gegen Wiederverwendung eines Codes, Sperre bei Windows-Sperre und nach Inaktivität; Sitzungsschlüssel nur während der Freigabe im Speicher; definierte Wiederherstellung mit getrennt verwahrten Recovery-Codes. Windows Hello oder TOTP nur als UI-Abfrage vor automatischer DPAPI-Entschlüsselung zu setzen würde den Dateischutz nicht gegen andere Prozesse desselben Kontos verstärken. Ein unabhängiger Tresorschlüssel muss tatsächlich von der Freigabe abhängen.

Diese zusätzliche Sitzungssperre, Windows Hello und TOTP sind noch nicht implementiert. Aktuell entsperrt das angemeldete Windows-Konto den DPAPI-Speicher automatisch beim App-Start.

## Ehrliche Schutzgrenzen

Verschlüsselte Dateien bedeuten nicht, dass Daten zu keinem Zeitpunkt im Klartext existieren. Anzeige und Modellanfragen benötigen entschlüsselte Daten im Arbeitsspeicher; der Zielserver verarbeitet die gesendeten Inhalte. DPAPI schützt vor anderen Benutzerkonten und dem einfachen Lesen kopierter Dateien, nicht vor Schadsoftware oder beliebigen Programmen mit Zugriff unter demselben angemeldeten Konto. Auslagerungsdatei, Speicherabbilder, Bildschirmaufnahmen und Betriebssystem-/Serverprotokolle liegen außerhalb des zugesicherten App-Dateischutzes. [Windows-Schutzgrenzen in Electron](https://www.electronjs.org/docs/latest/api/safe-storage)

Vorhandene Klartextdateien werden entfernt, aber frühere Kopien in Backups, Dateiversionen oder freigegebenen Datenträgerblöcken lassen sich damit nicht garantiert vernichten. Für zusätzlichen Schutz des gesamten Datenträgers kann Windows-Geräteverschlüsselung/BitLocker dienen. Eine unabhängige verschlüsselte Sicherung mit geregelter Wiederherstellung wäre ein eigener nächster Schritt; DPAPI-Dateien einfach auf einen anderen Windows-Rechner zu kopieren garantiert keine Wiederherstellung.

Das Programm ist weiterhin ein lokaler Prototyp ohne signierten Installer. Ein separates Sicherheitsaudit und ein automatischer Updateprozess stehen aus. Die separate Codex-MCP-Brücke wurde nicht auf den App-Tresor umgestellt und erhält keine App-Zugangsdaten; ihre bisherige Heimnetz-HTTP-Verbindung bleibt bestehen. Keine Geheimnisse als Worker-Aufgabenkontext übergeben.

## Modellprüfung und Nachweise

„＋ Server“ liest die Modellliste über `/api/tags` und fragt zu jedem Modell `/api/show` ab. Modellnamen werden automatisch übernommen. Neue Modelle bleiben deaktiviert; bestehende Auswahl und Aktivierung bleiben erhalten. Fehlende Zusatzmetadaten werden als unbekannt behandelt. Angezeigte Fähigkeiten wie Vision oder Tools bedeuten nicht, dass diese App bereits entsprechende Eingabe-/Ausführungsfunktionen besitzt. [Ollama API und Modellinformationen](https://github.com/ollama/ollama/blob/main/docs/api.md)

Kreativität, Kontextfenster und Antwortlimit sind Ollama-Anfrageparameter dieser App; sie verändern keine globalen Servereinstellungen. Die App begrenzt Werte und die gemeldete Modell-Kontextgrenze. Ein hoher theoretischer Modellwert ist keine Aussage darüber, wie viel RAM der Server tatsächlich bereitstellen kann. [Offizielles Ollama-Schema](https://github.com/ollama/ollama/blob/main/docs/openapi.yaml)

34 automatisierte Tests prüfen Persistenz, Manipulation, falsche Schlüssel, fehlenden Schutz, sichere Migration einschließlich neuerer Altdaten, Schreibreihenfolge, Origin-Bindung, Header, HTTP-Sperren, TLS-Umgebungsregeln und Modellverwaltung. Ein isolierter echter Electron-Test prüft zusätzlich Windows-DPAPI, UI-Serverimport, reale Modellmetadaten vom Heimnetzserver, gespeicherte Historie und eine echte Qwen-Antwort. Der Authentifizierungsablauf wird mit einem künstlichen HTTPS-Ziel und Testschlüssel geprüft; es wurde kein fremder Server oder echter API-Zugang verwendet. Beleg: `verification-app.json`.

## Anhänge und Updates

Originalanhänge werden separat mit DPAPI verschlüsselt. Die Oberfläche erhält nur Anhangsvorschauen ohne lokale Dateipfade. Kein Ausführen von Dateien, keine externen Bild-URLs, keine SVG-Anhänge und keine Klartext-Arbeitskopien. Ausgewählte Originaldateien werden nicht verändert. Zugänge zum Bildserver unterliegen denselben HTTPS-/Origin-Regeln. Details: BILDER-UND-DATEIEN.md.

Programm und Tresor sind getrennt. Updates und Deinstallation bewahren den externen Tresor; private GitHub-Zugänge werden nicht eingebettet. Unsignierte Pilot-Updates werden nicht automatisch installiert. Details: INSTALLATION-UND-UPDATES.md.
