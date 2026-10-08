# KAIROS für Windows

Aktueller Stand **0.5.0**: Eigenständiges Sprachstudio mit Azure Speech/SSML, Azure Foundry/OpenAI TTS und Qwen Design/Clone. Siehe [TTS-Einrichtung und Grenzen](TTS-STUDIO.md) und [Releasehinweise](release/notes-0.5.0.md). KAIROS hieß bisher Qwen Chat; App-ID und Tresorpfad bleiben erhalten. Setup-Dateien heißen `KAIROS-Setup-0.5.0-x64.exe` / `.msi`. LaTeX und sichere Rich-Text-Ausgabe bleiben enthalten. Ältere Installations- und Prüfstände unten sind historisch.

Für die Windows-Installation das Setup öffnen. Details: **INSTALLATION-UND-UPDATES.md**. Im Entwicklungsordner mit **Start-Qwen.cmd** öffnen. Die App verbindet sich mit der ausgewählten Ollama- oder OpenAI-kompatiblen Chat-KI und öffnet ein eigenes Chatfenster mit Historie. Version 0.2.2: variable Updatequelle und natives ComfyUI-Bild-Backend. Einrichtung: **SERVER-UND-COMFYUI.md**.

## Server und Modelle

1. Links unten **Einstellungen → Server & Modelle → ＋ Server** öffnen.
2. Namen und Serveradresse eingeben, ohne API-Pfad oder Zugangsdaten in der URL. **Chatserver automatisch erkennen** liest Ollama und zusätzliche OpenAI-kompatible Modelllisten.
3. Zugangsart wählen: ohne Zugangsdaten, API-Schlüssel (Bearer) oder Benutzername/Passwort (Basic). Zugänge benötigen HTTPS mit gültigem Zertifikat.
4. **Server prüfen & Modelle hinzufügen** liest alle Modellnamen und verfügbare Zusatzinformationen automatisch. Es werden keine Modelle geladen, installiert oder generiert.
5. Gewünschte Modelle aktivieren und **Im Chat nutzen** wählen. Neue Modelle bleiben zunächst deaktiviert. Bestehende Auswahl und Aktivierung werden beim Aktualisieren erhalten.
6. **Modelle laden** / **Alle Server prüfen** aktualisiert die Listen. Dies geschieht auch beim Start. **Zugang bearbeiten** öffnet das Serverformular; ein leeres Passwort-/Schlüsselfeld behält einen vorhandenen Zugang für dieselbe Adresse und Zugangsart. Ein neuer Schlüssel ersetzt den bisherigen Zugang bei den neu abgefragten Modellen.
7. **Bearbeiten** ändert die Parameter je Modell: Kreativität, Kontextfenster und Antwortlimit. Diese Werte gelten nur für Anfragen dieser App und ändern keine globalen Servereinstellungen. Die theoretische Modell-Kontextgrenze sagt nichts über den verfügbaren Server-RAM aus.

Der Status zeigt HTTPS oder die ausdrücklich erlaubte HTTP-Heimnetz-Ausnahme. HTTP bleibt unverschlüsselt und wird nur ohne Zugangsdaten für private IP-Adressen/Loopback zugelassen. Für den bisherigen Server wurde diese Ausnahme auf Wunsch übernommen. Die App prüft keinen VPN-Tunnel; VPN-only-Erreichbarkeit wird auf dem Server und in der Firewall eingerichtet.

Ein Modellwechsel gilt für die nächste Nachricht. Der ausgewählte Gesprächskontext kann dabei an den neuen Server gehen. Für getrennte Inhalte **Neues Gespräch** beginnen. Kein automatischer Modellwechsel bei Deaktivierung oder Serverfehler. Lokales Ollama prüft von sich aus keine Passwörter; dafür benötigt ein fremder Server einen tatsächlich authentifizierenden Gateway/Proxy.

## Bedienung

- Enter sendet, Shift + Enter erzeugt eine neue Zeile.
- Während einer Antwort wird Senden zu Abbrechen. Antworten erscheinen vollständig nach Abschluss.
- Frühere Gespräche bleiben links auswählbar. Gescheiterte oder abgebrochene Nachrichten bleiben markiert und werden nicht als Kontext übergeben.
- Der Verbindungsstatus lässt sich zur erneuten Prüfung anklicken.
- Klick außerhalb der Einstellungen schließt sie. **Entfernen** / **Server löschen** entfernt Verbindungen nach kurzer Bestätigung und bewahrt alle Gespräche. Entfernte Modelle werden beim automatischen Prüfen nicht neu angelegt.
- Ohne aktivierte und ausgewählte KI wird nichts gesendet. Während einer Antwort oder Einstellungsänderung ist die Verbindungsbearbeitung gesperrt.
- Die vollständige Historie bleibt gespeichert. Für eine Anfrage wird der neueste Teil innerhalb eines begrenzten Budgets ausgewählt; fehlende ältere Runden werden angezeigt. Das Bytebudget ist kein echter Tokenizer und wird für kleinere Kontextfenster reduziert.

## Verschlüsselter Speicher

Normale Benutzerdaten liegen außerhalb des Projekts unter **%LOCALAPPDATA%\\QwenChat\\Vault**:

- settings.vault: Verbindungen, Modellparameter und Auswahl.
- credentials.vault: getrennte API-Schlüssel und Benutzername/Passwort.
- history.vault: Gespräche.
- workflows.vault: importierte ComfyUI-API-Workflows, Node-Zuordnungen und Bildparameter.

Windows DPAPI über Electrons asynchrones safeStorage schützt die Dateien. Es gibt keinen Klartext-Ersatzspeicher. Alte data/history.json und data/settings.json werden beim Start automatisch übernommen; die Klartextquellen werden erst nach geprüfter verschlüsselter Speicherung entfernt. Auch alte Historie-/Einstellungen-Sicherungen werden verschlüsselt übernommen. Beschädigte Tresore bleiben erhalten und blockieren den Start.

Die Dateien sind an dein Windows-Konto gebunden. Einfaches Kopieren auf einen anderen Rechner garantiert keine Wiederherstellung. **Authenticator, Windows Hello und eine zusätzliche App-Sitzungssperre sind noch Konzept.** Beim Start nutzt die App aktuell dein bereits angemeldetes Windows-Konto. Während der Nutzung sind Daten im Arbeitsspeicher entschlüsselt; DPAPI schützt nicht vor Schadsoftware unter demselben Konto.

Das vollständige Konzept einschließlich VPN, fremden Servern, Migration, Grenzen und Authenticator steht in **SICHERHEITSKONZEPT.md** und im Reiter **Sicherheit**.

## LiteLLM

Der LiteLLM-Reiter ist weiterhin eine deaktivierte Konzeptansicht. Unter **Server & Modelle** gibt es nun einen allgemeinen OpenAI-kompatiblen Gateway-Anschluss mit verschlüsseltem Zugang; eine besondere LiteLLM-Verwaltung ist noch nicht implementiert. Details: LITELLM-KONZEPT.md.

## Entwicklung und Prüfen

Der ursprüngliche Anfragebaustein src/ollama-request.mjs stammt aus dem geprüften Qwen-Worker-Vorschlag. Netzwerkbehandlung, App, Historie, Serververwaltung und Sicherheit wurden von Codex ergänzt. Die MCP-Brücke dient der Entwicklung und ist von diesem App-Tresor unabhängig. Die App selbst spricht direkt mit Ollama.

Electron 44.6.0 ist lokal installiert. Die Oberfläche ist isoliert, hat keinen allgemeinen Dateisystem-/Shellzugriff und lädt keine externen Webinhalte. Ein eigener Windows-x64-Installer mit SoL-Icon ist erstellt; die Pilotversion ist noch nicht signiert. Updates und Datenablage: INSTALLATION-UND-UPDATES.md.

- npm.cmd test: 66 automatisierte Prüfungen für Netzwerkanfragen, Verlauf, Verschlüsselung, Migration, HTTP-Sperren und Serververwaltung.
- npm.cmd run verify:update: isolierter Electron-Fenstertest mit künstlichen Servern; Modellverwaltung, ComfyUI-Bild im Chat und Export, variable Updatequelle sowie verschlüsselter Neustart.
- npm.cmd run verify: isolierter echter Electron-/Ollama-Test. Verwendet einen separaten verschlüsselten Testtresor; reale Benutzerchats werden nicht geöffnet oder verändert. Die bisherige isolierte Testkonfiguration wird bei ihrem ersten Lauf übernommen. Ohne Testserver-Konfiguration ist ein frisches Testprofil offline.
- npm.cmd ci, danach node node_modules/electron/install.js: Abhängigkeiten und offizielle Electron-Laufzeit erneut einrichten.
- In einer Codex-Umgebung gegebenenfalls ELECTRON_RUN_AS_NODE entfernen; Start-Qwen.cmd berücksichtigt dies bereits.

Belege: verification-app.json, preview.png, preview-settings.png, preview-security.png und preview-litellm.png. Der echte Test bestätigt Windows-DPAPI, UI-Import realer Modelle, Metadaten, Persistenz und eine Qwen-Antwort. Authentifizierung ist mit künstlichem HTTPS-Ziel/Testschlüssel geprüft, nicht mit einem fremden Produktivserver.

Quellen: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [Ollama-API](https://github.com/ollama/ollama/blob/main/docs/api.md), [Ollama-Authentifizierung](https://docs.ollama.com/api/authentication).

## Bilder und Dateien

Bilder mit Vision-Modellen besprechen, Text-/Codedateien anhängen und einen Bildgenerator als eigene Serverart verbinden. Ergebnisse erscheinen direkt im Chat; Anhänge liegen separat verschlüsselt im Tresor. Einrichtung, Grenzen und der offene Ollama-Vision-Serverfehler: **BILDER-UND-DATEIEN.md**.

SSH-Tunnel und Auftragswiederabruf ab 0.3.1: siehe [SSH-UND-AUFTRAEGE.md](SSH-UND-AUFTRAEGE.md).

## Sprachstudio ab 0.5.0

Eigener TTS-Reiter für Azure Speech mit SSML, Azure Foundry/OpenAI TTS und die bestehende Qwen-Brücke. Verbindungen und schlüsselfreie Python-Beispiele unter Einstellungen → TTS. [Einrichtung und Grenzen](TTS-STUDIO.md).
