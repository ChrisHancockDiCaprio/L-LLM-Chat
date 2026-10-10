# Änderungen

## 0.5.1 · Portable Ausgabe und manuelle Updates · 2026-10-10

- Portable Windows-x64-ZIP mit gebündelter Laufzeit; kein NSIS-/MSI-Installer.
- `electron-updater` und `lazy-val` als Laufzeitabhängigkeiten entfernt. Historische Originalnachweise im Entwicklungsarchiv erhalten; 14 aktuelle Pakete mit 16 originalen Nachweisdateien.
- Eigene GitHub-Release-Prüfung: Entwürfe und ältere Versionen ausblenden, Beta optional, geprüfte Release-Seite im Browser öffnen. Kein Programmdownload, Installerstart oder Neustart durch Updates.
- Bestehender verschlüsselter Windows-Tresor bleibt am bisherigen Ort; Programmordner lässt sich verschieben. Daten sind weiterhin an das Windows-Konto gebunden.
- Hancock und erste Anbieteranschlüsse enthalten. 113 Node-Tests sowie isolierter Electron-Ablauf einschließlich Chat, Bilder, TTS und manueller Updates bestanden. Weitere Roadmap-Etappen bleiben offen.

## In Entwicklung – erste Anbieteranschlüsse · 2026-10-10

- Getrennte API-Pfade, sichere Schlüssel-/Auftragsbindung und Groq/OpenRouter-Voreinstellungen; bestehende `/v1`-Profile bleiben verwendbar.
- Eigener Angebotskatalog mit Prüfdatum und offiziellen Links; OpenRouter-Zugangsauskunft und Groq-Limits aus regulären Antworten.
- Gezielte Modell-IDs beim Einrichten; große Modellkataloge werden unabhängig von maximal 100 gespeicherten Profilen begrenzt.
- Gemeldeter Tokenverbrauch und Anbieterbetrag im Verlauf; 429-Wartezeit ohne automatische Wiederholung.
- Isolierte Anbieter- und Hancock-Fenstertests erfolgreich. Kein Live-Anbietertest, kein neues Setup; Streaming, Kostenregeln und KittenTTS noch offen.

## In Entwicklung – Hancock · 2026-10-10

- Eigene Figur im App-Fenster mit Schnellchat, Gesprächsauswahl, gemeinsamen Anhängen und Ergebnisnavigation.
- Chat-, Bild-, Sprach- und Auftragszugriff; echte Statusmeldungen, Dateiablage, Tastaturbedienung und verschlüsselte Ruhe-/Sichtbarkeitseinstellungen.
- Lokale Open-Source-Ansicht, originale Nachweise der vorhandenen Produktionspakete und dokumentierte Lizenztext-Lücke bei lazy-val.
- 110 Node-Tests und isolierte Electron-Prüfung mit künstlichem Anbieter. Kein neues Setup und keine Veröffentlichung; weitere Roadmap-Etappen offen.

## 0.5.0 — 2026-10-08

- Unabhängiger Sprachstudio-Reiter mit Text/SSML, Import, stimmabhängigen Parametern, Vorschau, Export und Abbruch.
- Getrennte Azure-Speech- und Azure-Foundry-TTS-Adapter; verschlüsselte Keys und nicht ausführbare Python-Beispiele in TTS-Einstellungen.
- Chat/TTS parallel nutzbar; Qwen-Datenmigration und isolierte Behandlung beschädigter TTS-Tresore.
- Azure-Adaptertests und echte Electron-Verifikation; siehe TTS-STUDIO.md für Grenzen und Dokumentation.

## 0.4.2 · Updateinstallation nach Bestätigung

- Unsignierte heruntergeladene Updates lassen sich nach einer nativen Warnung mit Version, Quelle und ausdrücklicher Risikobestätigung installieren. Abbrechen ist die Standardauswahl; Zustimmung gilt nur für einen Versuch.
- Downloadprüfungen bleiben aktiv; keine automatische Installation beim Beenden und keine Umgehung von Windows-Ausführungssperren.
- Vor dem Installerstart werden alle verschlüsselten Tresordateien gesichert, einschließlich Workflows, Aufträgen, SSH und TTS. Fehler und laufende Vorgänge verhindern die Installation.
- 97 Node-Tests, fünf Python-Tests und echter Electron-Fenstertest einschließlich Abbruch, Zustimmung und vollständiger Sicherung.
- Von 0.4.1 muss das Setup einmal manuell gestartet werden, um die bisherige Sperre zu ersetzen.

## 0.4.1 · Formeln

- LaTeX-Formeln mit Dollar- und Backslash-Trennzeichen, lokalem KaTeX, Schriftdateien und barrierefreier MathML-Ausgabe.
- Formeln vor Markdown-Escaping erkennen; Code und Preise erhalten. Ungültige Formeln bleiben als Text sichtbar. Getrennte Sanitizer-Regeln und begrenzte Makroexpansion; keine externen LaTeX-Inhalte.
- Formel-, Sicherheits- und Electron-Prüfungen sowie Paketprüfung der mitgelieferten Schriftdateien.

## 0.4.0 · Sprache und Rich Text

- Qwen3-TTS-Sprachstudio im Chat: CustomVoice, VoiceDesign und Base-Cloning mit modellabhängigen Feldern, Referenz-/Transkriptprüfung und optionalen Sampling-Werten.
- Mitgelieferte Loopback-Serverbrücke für das offizielle Qwen-SDK; Audiovorschau, WAV-Export, Design→Clone und verschlüsselter TTS-Tresor.
- Sichere Markdown-/HTML-Ausgabe mit Überschriften, Listen, Links, Codeblöcken und Tabellen; lokaler Parser/Sanitizer, enge HTML-Allowlist und unveränderter Chatkontext.
- Zusätzliche Transport-, Sicherheits-, Persistenz-, Python-HTTP- und echte Electron-UI-Prüfungen im Releaseworkflow.

## 0.3.2 · Installer-Build

Buildkorrektur für die GitHub-Veröffentlichung: optionale native SSH-Beschleuniger nicht neu bauen, NSIS-Anpassung nur im Hauptprozess laden. Funktionen und Datenspeicher von 0.3.1 bleiben erhalten.

## 0.3.1 · SSH und sichere Auftragszustände

Optionale SSH-Tunnel, Hostschlüsselprüfung, unbegrenztes Warten auf die ursprüngliche Antwort, verschlüsselte ComfyUI-Auftragszuordnung und Wiederabruf. Offline-Aktivierung verhindert und Einstellungen während Anfragen gesperrt. Details: SSH-UND-AUFTRAEGE.md.

## 0.3.0 – KAIROS

Austauschbare verschlüsselte Workflow-Profile, optionale CFG- und Bildparameter mit Profilgrenzen, Upload-Freigaben je Modell, Chat-Löschen und Beta-Updates. Gemeinsamer Verlauf beim Modellwechsel. 72 Tests und isolierter Electron-Fenstertest bestanden. Details: release/notes-0.3.0.md und WORKFLOW-PROFILE.md.

# Änderungen

## 0.2.2 · 7. Oktober 2026

- Zusätzlich echtes Windows-x64-MSI-Paket für den Pre-Release, fester Programmordner für das aktuelle Konto und externer Tresor. MSI-Updates verwenden einen stabilen Upgrade-Code; ein Wechsel vom EXE-Setup erfolgt manuell. Das Paket ist weiterhin unsigniert.

- Update-Repository in den Einstellungen frei wählbar; HTTPS-GitHub-Adresse prüfen und verschlüsselt speichern. Falsche/nicht öffentliche Quellen ändern die bestehende Quelle nicht.
- Öffentliche Releases und fehlende Windows-Assets werden unterschieden. Updatevorgänge sperren den Quellenwechsel; ein Wechsel verwirft eine alte Updateauswahl und erfordert eine neue Versionsprüfung.
- Getrenntes ComfyUI-Bild-Backend: API-Workflow importieren, Prompt, Negative Prompt, Breite, Höhe, Schritte und Seed direkten Node-Eingängen zuordnen; gespeicherten Bild-Ausgabe-Node wählen.
- Native Ausführung über POST /prompt, Statusabfrage /history/{prompt_id} und Bildabruf /view. Keine Ollama-/OpenAI-Erkennung für ComfyUI. Polling statt WebSocket; kein Prozentfortschritt aus der History-API.
- Bilder erscheinen als verschlüsselt gespeicherte Chat-Anhänge; „Bild speichern“ exportiert die Bildbytes auf ausdrücklichen Klick in den gewählten Ordner.
- Abbruch stoppt lokale Abfragen; kein globales /interrupt, damit andere Serveraufträge nicht abgebrochen werden.
- 66 Tests und isolierter Electron-Fenstertest bestanden. GitHub öffentlich und ComfyUI erreichbar; tatsächlicher Qwen-Image-Lauf wartet auf den Benutzer-Workflow. Automatische Installation unsignierter Updates bleibt gesperrt.
- Finales Setup besteht neun Verzeichnis-Prüfungen ohne Installation. Die gepackte unsignierte Programmdatei wird von der Windows-Anwendungssteuerung blockiert; kein bestätigter finaler Installationslauf. Bestehende 0.2.0 bleibt unverändert.


## 0.2.1 · 7. Oktober 2026

- Gespeicherte Server werden beim Start auf neue Modelle geprüft; Auswahl, Aktivierung und Parameter bleiben erhalten.
- Automatische Erkennung verbindet Ollama-Modelllisten und zusätzliche OpenAI-kompatible Gateway-Aliase. OpenAI-kompatibler Textchat ist nutzbar.
- Modelllisten einzeln oder für alle gespeicherten Server erneut laden. Keine Portsuche, keine automatische Aktivierung oder Ersatz-KI.
- Einstellungen durch Klick außerhalb des Fensters schließen; Klicks innerhalb bleiben geöffnet.
- Einzelne Modellverbindungen oder vollständige Server nach kurzer Bestätigung entfernen. Chats bleiben erhalten, ungenutzte Zugänge werden aus dem verschlüsselten Tresor entfernt.
- Entfernte Modelle bleiben bei automatischer Erkennung entfernt; ausdrückliches erneutes Hinzufügen des Servers stellt sie wieder bereit.
- Eigene ComfyUI-Verbindungsart: native Serverprüfung, GGUF-Knoten-/Modelldatei-Erkennung und verschlüsselter Import von API-Workflows. Prompt-Zuordnung, /prompt-Bildlauf, /history-Ergebnisabruf und /ws-Fortschritt sind noch nicht aktiviert.
- 56 automatisierte Prüfungen und isolierter Electron-Fenstertest bestanden. Ollama am Benutzer-Endpunkt bestätigt beide Modelle; ComfyUI auf Port 8188 ist derzeit vom Windows-Rechner nicht erreichbar.
- Installationspfad-Sperre für den externen Tresor korrigiert; neun finale Verzeichnisprüfungen bestanden. Frühere gepackte 0.2.1-Ausgabe liest den alten Testtresor mit Chat, Zugang, Modellwahl und Bild. Die endgültige neu erzeugte Programmdatei wird von der Windows-Anwendungssteuerung blockiert; vollständiger finaler Installationslauf bleibt offen. 0.2.0 bleibt bestehen.

Einrichtung: SERVER-UND-COMFYUI.md. Update-Anleitung: INSTALLATION-UND-UPDATES.md.

## 0.2.0 · 7. Oktober 2026

- SoL-Weltenatlas-Kompass als App-, Taskleisten- und Setup-Icon.
- Windows-x64-Installer und Deinstaller für das aktuelle Benutzerkonto, wählbarer Programmordner.
- Externer verschlüsselter Tresor bleibt beim Update und Deinstallieren erhalten; Schutz vor überlappenden Installationspfaden.
- GitHub-Releases als vorgesehene öffentliche Updatequelle, Repository bleibt vorerst privat.
- Updateprüfung und ausdrücklicher Download vorbereitet; automatische Installation in der unsignierten Pilotversion gesperrt.
- Bilder und Text-/Code-Dateien anhängen; Vision-Modelle erhalten Bildeingaben.
- Flexibler Bildserver-Anschluss, Modellsuche und Bildausgabe direkt im Chat; Referenzbilder über den Image-Edit-Endpunkt.
- Separate verschlüsselte Anhangsdateien und Wiederherstellung nach Neustart.
- 45 automatisierte Prüfungen sowie isolierte Windows-/UI-Prüfungen. Echte Qwen-Textantwort erfolgreich; aktuelle Ollama-Vision-Inferenz scheitert serverseitig mit HTTP 500 / unexpected EOF. Bildgenerator mit künstlichem Server geprüft.

Grenzen und Einrichtung: INSTALLATION-UND-UPDATES.md und BILDER-UND-DATEIEN.md.
