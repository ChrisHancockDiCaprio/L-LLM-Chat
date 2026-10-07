# Server und ComfyUI in 0.2.1

## Chatserver

1. Einstellungen → **＋ Server** → **Chatserver automatisch erkennen**.
2. Namen und Serveradresse ohne API-Pfad eintragen. Für deinen Ollama-Server: `http://192.168.0.175:11434`. HTTP im Heimnetz ausdrücklich erlauben, keine Zugangsdaten über HTTP verwenden.
3. **Server prüfen & Modelle hinzufügen** liest `/api/tags` und `/v1/models` vom angegebenen Server. Ollama-Metadaten kommen aus `/api/show`; zusätzliche Gateway-Aliase werden als OpenAI-kompatible Chatmodelle geführt. Überlappende Modellnamen werden einmal mit Ollama geführt. Bei 401/403 stoppt die automatische Erkennung.
4. Neue Modelle ausdrücklich aktivieren und **Im Chat nutzen** wählen. Ollama verwendet `/api/chat`, kompatible Chatserver `/v1/chat/completions`. Bildfähigkeiten werden nur anhand gemeldeter Metadaten angenommen.

Beim Start werden ausschließlich die gespeicherten Server geprüft. **Alle Server prüfen**, **Modelle laden** und der Verbindungsstatus erlauben eine erneute Abfrage. Es gibt keine Netzwerksuche und keine automatische Aktivierung. Fehler oder verschwundene Modelle löschen keine Einstellungen. Auswahl, Namen, Zugänge und Parameter bleiben erhalten. Maximal 100 Modellverbindungen; Metadaten sind bei Abfragefehlern möglicherweise unvollständig.

Colibri wurde als Oberfläche eingeordnet, die direkt Ollama verwendet. Dafür reicht derselbe Ollama-Endpunkt. Ein zusätzlicher Colibri-Prozess ist nicht belegt. Port 8080 gehört laut Benutzer zu Apache Guacamole und wird nicht als Modellserver behandelt.

## Löschen und Einstellungen schließen

**Entfernen** löscht eine Modellverbindung; **Server löschen** entfernt alle Verbindungen der angezeigten Adresse. Die kurze Bestätigung lässt sich mit **Behalten** abbrechen. Chats und Modelle auf dem Server bleiben erhalten. Die aktive Auswahl wird bei Entfernung aufgehoben, ohne eine andere KI auszuwählen.

Ein gemeinsam genutzter Zugang bleibt erhalten, solange andere Verbindungen ihn benötigen. Ungenutzte Zugangseinträge und nicht mehr zugeordnete ComfyUI-Workflows werden aus ihren verschlüsselten Tresoren entfernt. Bei einem Schreibfehler bleibt der noch nicht entfernte Zugang verschlüsselt erhalten und die App meldet dies. Vorhandene verschlüsselte Versionssicherungen werden dabei nicht verändert.

Entfernte Modelle sind verschlüsselt als ausgeschlossen vermerkt, damit der nächste Start sie nicht erneut importiert. Erneutes ausdrückliches **Server hinzufügen** kann sie wiederherstellen. Die Deinstallation des Programms bewahrt weiterhin den gesamten Tresor.

Klick außerhalb des Einstellungsfensters schließt es; Klicks auf freie Fläche innerhalb des Fensters tun dies nicht. Ebenso funktionieren × und Escape. Ungespeicherte Änderungen werden dabei nicht übernommen; Schlüsselfelder werden geleert.

## ComfyUI vorbereiten

Qwen Image 2.1 und ComfyUI-GGUF sind laut Benutzer auf Ubuntu installiert. Ein getesteter API-Workflow fehlt noch.

1. Einstellungen → **＋ Server** → **ComfyUI · Bild-Workflow vorbereiten**.
2. Adresse `http://192.168.0.175:8188` eintragen und die HTTP-Heimnetz-Ausnahme ausdrücklich erlauben. Beim Wechsel auf ComfyUI wird ein leeres Adressfeld mit Port 8188 am bekannten Ollama-Rechner vorbelegt; es startet noch keine Anfrage.
3. Die App prüft ausschließlich `/system_stats` und `/object_info`. Sie zeigt erkannte GGUF-Knoten und die Anzahl gemeldeter Modelldateien. ComfyUI wird nicht als Ollama-/OpenAI-Server behandelt; einzelne Diffusions-, Encoder- und VAE-Dateien sind keine fertigen Chatmodelle.
4. Später einen vollständigen, auf diesem Server getesteten Workflow als **API Format** exportieren. Bei Bedarf den Entwicklermodus in ComfyUI aktivieren.
5. **API-Workflow importieren** öffnet die native Dateiauswahl. Die App akzeptiert bis 2 MB / 300 API-Knoten mit `class_type` und `inputs`. Die normale Editor-Datei mit `nodes` reicht nicht. Die Kopie wird als `workflows.vault` mit Windows DPAPI verschlüsselt gespeichert. Die Originaldatei bleibt unverändert. Die Oberfläche erhält nur Dateiname und Knotenzahl.

Der Import prüft das API-Dateiformat, bestätigt aber weder vorhandene Knoten/Modellpfade noch einen ausführbaren Qwen-Image-Workflow. Die Bildausführung bleibt deaktiviert. Als nächster Schritt werden das Eingabefeld für den Chat-Prompt und die Ausgabeknoten zugeordnet; danach Auftrag über `POST /prompt`, Fortschritt über `/ws?clientId=...`, Ergebnis über `/history/<prompt_id>` und Bildbytes über `/view`. HTTPS wird dabei zu WSS, Zugangsdaten gehören nicht in die WebSocket-URL. Diese Ausführungswege werden in 0.2.1 noch nicht aufgerufen.

## Prüfung vom 7. Oktober 2026

- Ollama vom Windows-Rechner erreichbar: `hermes3:8b`, `qwen3.5:4b` erkannt. Eine Bildgenerierung wurde dabei nicht gestartet.
- ComfyUI unter `192.168.0.175:8188` aus Windows nicht erreichbar. Auf Ubuntu lokale Erreichbarkeit, Bind-Adresse und Heimnetz-/VPN-Firewall prüfen; kein Port muss öffentlich freigegeben werden. Diese App verändert keine Server- oder Firewall-Einstellungen.
- 56 Tests: Erkennung, Authentifizierung, Chattransport, Verschlüsselung, Historie, Löschverhalten, Workflow-Validierung, Update-Speicher.
- Isolierter Electron-Fenstertest: Innen-/Hintergrundklick, Import neuer deaktivierter Modelle, Löschabbruch, aktive Auswahl entfernen, Zugang bereinigen, Historie nach Neustart, ComfyUI-/Workflow-Anzeige. Künstliche Gateways und ComfyUI-Antworten; keine echten Benutzerdaten gelöscht.

Protokollquellen: [LM Studio Modellliste](https://lmstudio.ai/docs/developer/openai-compat/models), [kompatibler Chat](https://lmstudio.ai/docs/developer/openai-compat/chat-completions), [ComfyUI native Routen](https://docs.comfy.org/development/comfyui-server/comms_routes), [ComfyUI WebSocket-Beispiel](https://github.com/Comfy-Org/ComfyUI/blob/master/script_examples/websockets_api_example.py).
