# Änderungen

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
