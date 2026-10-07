# Änderungen

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
