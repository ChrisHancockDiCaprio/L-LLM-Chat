# Server und ComfyUI

Aktueller Stand **0.3.0**: siehe [WORKFLOW-PROFILE.md](WORKFLOW-PROFILE.md) und [Releasehinweise](release/notes-0.3.0.md). KAIROS hieß bisher Qwen Chat; App-ID und Tresorpfad bleiben erhalten. Setup-Dateien heißen jetzt `KAIROS-Setup-0.3.0-x64.exe` / `.msi`. Ältere Installations- und Prüfstände unten sind historisch.

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

## ComfyUI als eigenes Bild-Backend

Qwen Image 2.1 und ComfyUI-GGUF sind laut Benutzer auf Ubuntu installiert. Ein getesteter API-Workflow fehlt noch.

1. Einstellungen → **＋ Server** → **ComfyUI · eigenes Bild-Backend**.
2. Namen wählen, Adresse `http://192.168.0.175:8188` prüfen und die HTTP-Heimnetz-Ausnahme ausdrücklich erlauben. Ein leeres Adressfeld wird mit dieser Basisadresse vorbelegt; es startet noch keine Anfrage. Mit Zugangsdaten ist HTTPS erforderlich.
3. Die App prüft ausschließlich `/system_stats` und `/object_info`. Sie zeigt erkannte GGUF-Knoten und die Anzahl gemeldeter Modelldateien. ComfyUI wird nicht als Ollama-/OpenAI-Server behandelt; einzelne Diffusions-, Encoder- und VAE-Dateien sind keine fertigen Chatmodelle.
4. Später einen vollständigen, auf diesem Server getesteten Workflow als **API Format** exportieren. Bei Bedarf den Entwicklermodus in ComfyUI aktivieren.
5. **API-Workflow importieren** öffnet die native Dateiauswahl. Die App akzeptiert bis 2 MB / 300 API-Knoten mit `class_type` und `inputs`. Die normale Editor-Datei mit `nodes` reicht nicht. Die Kopie wird als `workflows.vault` mit Windows DPAPI verschlüsselt gespeichert. Die Originaldatei bleibt unverändert.
6. **Workflow zuordnen**: Prompt, Negative Prompt, Breite, Höhe, Schritte und Seed jeweils einem direkten Node-Eingang zuordnen. Die Auswahl zeigt Node-ID, Klasse und Eingangsname. Prompt-Eingänge müssen Textwerte, Zahlenparameter Zahlenwerte enthalten; verbundene Eingänge werden nicht überschrieben. Wenn dein Workflow keinen Negative Prompt hat, **Nicht vorhanden** wählen und später dieses Feld leer lassen.
7. Den gespeicherten Bild-Ausgabe-Node auswählen, normalerweise einen `SaveImage`-Node. Die App lädt ausschließlich Bilder dieses Nodes aus `type=output`. **Zuordnung verschlüsselt speichern**, das Backend aktivieren und **Im Chat nutzen** wählen.
8. Im Chat **ComfyUI-Bildparameter** aufklappen, Negative Prompt, Breite/Höhe, Schritte und Seed einstellen. Breite/Höhe: 128–4096, durch 8 teilbar. Schritte: 1–150. Seed: -1 für Zufall oder 0–4294967295. Bildbeschreibung in das Chatfeld schreiben und **Bild erzeugen** klicken. Der tatsächlich verwendete Seed steht bei der Antwort.
9. Die Antwort zeigt bis zu vier Bilder als Chat-Anhänge. **Bild speichern** öffnet die Windows-Dateiauswahl und exportiert die Bildbytes. Diese bewusst exportierte Bilddatei liegt unverschlüsselt im gewählten Ordner; die Chat-Kopie bleibt verschlüsselt.

Der Import prüft Format und Zuordnung; ob Nodes, Modelldateien und Graph tatsächlich funktionieren, entscheidet ComfyUI beim Lauf. Kein Qwen-Image-Workflow oder eine bestimmte Node-ID ist eingebaut: Der Benutzer liefert seinen Graphen anschließend. Ein erneuter Import setzt die Zuordnung zurück und deaktiviert das Backend bis zur erneuten Einrichtung.

Der Bildlauf verwendet ausschließlich `POST /prompt` mit Graph und eindeutiger `client_id`, danach `GET /history/{prompt_id}` etwa einmal pro Sekunde. Das gewählte Ergebnis wird über `/view?filename=...&subfolder=...&type=output` geladen. Der angezeigte Status unterscheidet Übermitteln, Berechnen/Warten und Bildempfang. Die History-API liefert keinen laufenden Prozentwert; WebSocket-Prozentfortschritt ist nicht implementiert. Maximal 20 Minuten Wartezeit, 30 Sekunden pro Anfrage und 8 MB pro Bild; Bildformat und Bildmaße werden vor dem Speichern geprüft. Keine Fremd-URLs, Pfadtraversal oder Weiterleitungen mit Zugangsdaten.

**Abbrechen** beendet die Abfragen im Chat. Es sendet kein globales `/interrupt`, da das auch fremde Aufträge stoppen könnte. Der Serverauftrag kann daher weiterlaufen. Der aktuelle Workflow unterstützt Text-zu-Bild; Chat-Dateianhänge werden für ComfyUI noch nicht in Upload-Nodes eingesetzt.

## Updateadresse ändern

Einstellungen → **Updates** → vollständige öffentliche GitHub-Repository-Adresse eintragen → **Prüfen & speichern**. Die Prüfung benötigt keinen Schlüssel. Sie unterscheidet ein erreichbares Repository ohne veröffentlichtes Release von einem Release mit `latest.yml` und Windows-Setup. Fehlende Releases verhindern das Speichern nicht. Ungültige Adressen oder fehlgeschlagene Prüfungen behalten die bisherige Quelle. Die Adresse bleibt verschlüsselt über Neustarts erhalten. **Änderung verwerfen** stellt das Eingabefeld auf die gespeicherte Quelle zurück. Danach **Auf Updates prüfen** nutzen. Die unsignierte Pilotversion erlaubt weiterhin keine Installation aus der App.

## Prüfung vom 7. Oktober 2026

- Ollama vom Windows-Rechner erreichbar: `hermes3:8b`, `qwen3.5:4b` erkannt. Eine Bildgenerierung wurde dabei nicht gestartet.
- ComfyUI unter `192.168.0.175:8188` jetzt aus Windows erreichbar, GGUF-Knoten und Modelldateien erkannt. Kein tatsächlicher Qwen-Image-Lauf ohne Benutzer-Workflow; keine Server-/Firewall-Einstellungen geändert.
- GitHub-Repository jetzt öffentlich erreichbar. Noch kein stabiles Release veröffentlicht; bestehende Entwürfe sind keine Updatequelle.
- 66 Tests: Erkennung, Authentifizierung, Chattransport, Verschlüsselung, Historie, Löschverhalten, Workflow-Zuordnung, Parameterersetzung, native Bildanfrage, Abbruch, Ergebnisprüfung, Updatequellenwechsel und Fehlerfälle.
- Isolierter Electron-Fenstertest zusätzlich: Workflow zuordnen und aktivieren, künstliches ComfyUI-Bild im Chat, bildgetreuer Datei-Export, Updateadresse speichern/ablehnen und verschlüsselter Neustart. Künstliche Antworten und Testtresor; keine echten Benutzerdaten gelöscht.

Protokollquellen: [LM Studio Modellliste](https://lmstudio.ai/docs/developer/openai-compat/models), [kompatibler Chat](https://lmstudio.ai/docs/developer/openai-compat/chat-completions), [ComfyUI native Routen](https://docs.comfy.org/development/comfyui-server/comms_routes), [ComfyUI WebSocket-Beispiel](https://github.com/Comfy-Org/ComfyUI/blob/master/script_examples/websockets_api_example.py).
