# Bilder und Dateien im Chat

**＋ Bild / Datei** öffnet die Windows-Dateiauswahl. Bis zu vier Anhänge lassen sich vor dem Senden ansehen und entfernen. Ein Dateiname ist keine Anweisung; Inhalte werden nicht ausgeführt. Anhänge werden nur an den ausdrücklich ausgewählten Server übertragen.

- Bildeingaben: PNG, JPEG und WebP, maximal 8 MB und 24 Millionen Bildpunkte, höchstens 8192 Pixel pro Seite. Für Ollama muss das Modell `vision` melden. Ein erneuter Serverimport aktualisiert diese Fähigkeiten.
- Dateien: UTF-8-Text, Markdown, CSV, JSON sowie gängige Code- und Konfigurationsdateien bis 16 KB. Der vollständige Dateiinhalt muss in das eingestellte Kontextbudget passen; zu große Eingaben werden abgewiesen und nicht still abgeschnitten. PDF, Office-Dateien und Archive sind noch nicht unterstützt.
- Bildausgaben: direkt als Bild im Verlauf sichtbar. Keine eingebetteten Webinhalte, SVGs oder automatisch geladenen externen Bild-URLs.

Beim Senden werden die Originalanhänge separat als `attachment-<ID>.vault` mit Windows DPAPI verschlüsselt gespeichert. Die Historie enthält nur ihre IDs. Unversendete Anhänge bleiben im Arbeitsspeicher. Die Originaldatei, die der Benutzer auswählt, bleibt unverändert an ihrem bisherigen Ort; die App erzeugt keine unverschlüsselte Arbeitskopie. Die Oberfläche verwendet flüchtige Daten-URLs für die Anzeige.

## Qwen-Image-2.1-Uncensored-GGUF anbinden

Die App stellt die Verbindung zu einer Laufzeit her; sie lädt keine GGUF-Dateien selbst. Die GGUF-Modellkarte nennt ComfyUI mit GGUF-Erweiterung und zusätzlich benötigtem Textencoder/VAE. Ein direktes ComfyUI-Workflow-API ist in dieser Version nicht eingebaut.

Der flexible Anschluss nutzt die OpenAI-kompatiblen Bildendpunkte, wie sie beispielsweise `stable-diffusion.cpp` bereitstellt:

1. Qwen Image auf einem Bildserver installieren und dessen API bereitstellen. Das ist eine separate Einrichtung; es wird kein Modell automatisch heruntergeladen oder auf Ubuntu installiert.
2. Einstellungen → Server → Verbindungsart **Bildgenerator · OpenAI-kompatibel / stable-diffusion.cpp** wählen.
3. Serveradresse ohne API-Pfad eintragen. Bei Zugängen HTTPS mit gültigem Zertifikat verwenden; API-Schlüssel/Passwort wird im vorhandenen separaten Zugangstresor gespeichert. HTTP ist nur ausdrücklich im privaten Netz ohne Zugangsdaten zulässig.
4. Modelle über `GET /v1/models` laden. Der vom Server gemeldete Modellbezeichner kann etwa `sd-cpp-local` lauten und muss nicht dem GGUF-Dateinamen entsprechen. Die Wahl dieses Servertyps setzt voraus, dass dessen Modelle Bilder erzeugen können; die Liste allein beweist keine Fähigkeit. Nicht kompatible Server werden beim tatsächlichen Aufruf mit einem Fehler gemeldet.
5. Modell aktivieren und im Chat auswählen. Beschreibung eingeben und **Bild erzeugen** anklicken. Optional Referenzbilder anhängen.

Ohne Referenzbild verwendet die App `POST /v1/images/generations`, mit Referenzbildern `POST /v1/images/edits` als Multipart-Anfrage. Der Server muss ein einzelnes PNG/JPEG/WebP-Bild in `data[0].b64_json` zurückgeben. Bildgröße derzeit 1024 × 1024; Wartezeit maximal zehn Minuten. Abbrechen beendet die Client-Anfrage, aber eine Berechnung auf dem Server kann weiterlaufen. Der Bildgenerator erhält nur die aktuelle Beschreibung und die Anhänge dieser Nachricht, nicht automatisch den alten Chatverlauf. Eine separate ComfyUI-Anbindung kann später über einen Adapter ergänzt werden.

## Prüfergebnis vom 7. Oktober 2026

Der echte Qwen-Textchat funktioniert. Der erreichbare Ollama-Server meldet für `qwen3.5:4b` zwar Vision, bricht aber bei Bildeingaben mit HTTP 500 / `unexpected EOF` ab. Das trat auch bei einer direkten Anfrage ohne App auf. Die Ursache auf Ubuntu ist noch offen.

Bildtransport, Modellsperre, verschlüsselte Speicherung, Anzeige, Wiederherstellung, Generierung und Referenzbild-Anfragen wurden mit künstlichen API-Antworten geprüft. Das beweist die App-Anbindung, nicht eine erfolgreiche lokale Qwen-Image-Inferenz. Der Bildgenerator ist noch nicht auf dem Benutzer-Server eingerichtet.

Quellen: [Modellkarte](https://huggingface.co/0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF), [stable-diffusion.cpp-Bild-API](https://github.com/leejet/stable-diffusion.cpp/blob/master/examples/server/api.md), [Ollama Chat-API](https://docs.ollama.com/api/chat).
