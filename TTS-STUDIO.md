# KAIROS Sprachstudio

**Geplante Ergänzung (10.10.2026):** Gemeinsame einfache Verbindungseinrichtung und KittenTTS von KittenML, zunächst über eine eigene lokale Serverbrücke. Modell-/Versions-/Sprachprüfung, gezielte Hancock-Textübernahme und getrennte Lizenznachweise gehören zur Abnahme. [Plan für einfache TTS-Verbindungen](docs/KAIROS-TTS-EINFACHE-VERBINDUNG.md). Diese Verbindung ist noch nicht implementiert.

Das Sprachstudio ist ein eigener Reiter. Es arbeitet ohne ausgewähltes Chatmodell, auch während einer Chat-/Bildanfrage. Chat und TTS haben getrennte Abbruchsignale. Ein beschädigter TTS-Tresor blockiert nur das Sprachstudio. Chat-Antworten können weiterhin bewusst als Text übernommen werden.

## Azure Speech (dein SDK-Beispiel)

1. Einstellungen → TTS → Azure Speech.
2. Ressourcen-Endpoint aus dem Portal, z. B. `https://<resource>.cognitiveservices.azure.com`, und den zugehörigen Speech-Key eintragen. Nur den HTTPS-Ursprung eingeben, keinen API-Pfad. Alternativ die Region angeben und Endpoint leer lassen: dann wird `https://<region>.tts.speech.microsoft.com` verwendet.
3. Prüfen & speichern lädt die echten Stimmen, Sprachen, Stile und Rollen dieser Ressource. Nach einem Neustart im Sprachstudio „Verbindung laden“ wählen. Keine kostenpflichtige Synthese beim Verbindungscheck.
4. Im Sprachstudio Provider, Modellfamilie und Stimme auswählen. `de-DE-Seraphina:DragonHDLatestNeural` befindet sich unter „Dragon HD“, sofern die Ressource diese Stimme meldet.
5. Text eingeben oder eine UTF-8-Datei importieren. Erzeugen, anhören und mit „Audio exportieren …“ den Zielpfad wählen. Der letzte Exportpfad bleibt verschlüsselt gespeichert.

Ressourcen-Endpoints verwenden `/tts/cognitiveservices/voices/list` und `/tts/cognitiveservices/v1`. Regionale TTS-Endpoints verwenden dieselben Pfade ohne `/tts`. Authentifizierung: `Ocp-Apim-Subscription-Key`. Synthese: `application/ssml+xml` und `X-Microsoft-OutputFormat`.

Bei Text erzeugt KAIROS escaped SSML. Bei SSML-Modus wird das validierte Dokument unverändert gesendet; Voice und Parameter stehen im XML. Dafür muss eine Speech-Verbindung geladen sein. DTD/Entity-Deklarationen, fremde Stimmen und externe Audio-/Lexikon-URLs werden abgewiesen. Importgrenze 60.000 UTF-8-Bytes; Text maximal 4.000 Zeichen. Verfügbare SSML-Elemente sind bewusst eingeschränkt. Azure prüft weitere fachliche Details des Dokuments; Fehler bleiben sichtbar.

Normale Neural-Stimmen: Sprache aus Locale/SecondaryLocaleList, Geschwindigkeit 0,5–2, Tonhöhe −50 bis +50 %, Lautstärke 0–100. Stil/Rolle nur aus StyleList/RolePlayList; Rollen benötigen einen Stil. Stilstärke 0,01–2. Dragon HD: keine Prosodie-Regler, Temperatur 0–1 und Ausspracheverbesserung. Dragon HD Omni: Temperatur 0,3–1, Top P 0,3–1, Top K 1–50, CFG 1–2; Stile nur aus der Stimmenliste. Die dokumentierte SSML-Supporttabelle wird konservativ verwendet: bei Dragon HD kein express-as, bei beiden HD-Familien kein prosody. Azure-OpenAI-Stimmen innerhalb Speech besitzen nochmals eingeschränkte SSML-Unterstützung.

Ausgabe: WAV 24/48 kHz, MP3 24/48 kHz, Ogg/Opus 24 kHz. Antwortgrenze 16 MB. Speech REST begrenzt Audio auf zehn Minuten und kann längere Ausgaben abschneiden. Keine Batch-/Long-Audio-API, Custom-Voice-Trainings oder Custom-Voice-Deployments.

## Azure Foundry / Azure OpenAI TTS

Dieser separate Adapter nutzt einen Azure-OpenAI-Ressourcen-Endpoint und `/openai/deployments/<deployment>/audio/speech?api-version=<version>`, mit `api-key`. Keine Foundry-Projekt-URL, keine Audio-Chat-Completions und kein SSML. Region ist hier informativ; der Endpoint bestimmt die Ressource.

In Einstellungen → TTS den Deployment-Namen, die tatsächlich bereitgestellte Modellfamilie (`tts-1`, `tts-1-hd` oder `gpt-4o-mini-tts`) und API-Version hinterlegen. Standard: `2025-04-01-preview`. Eine Verbindung pro Provider; bei einem anderen Deployment diese Verbindung ändern. Speichern validiert lokal und erzeugt keine kostenpflichtige Testanfrage. Erst Generate bestätigt API-Key, Berechtigungen und das Deployment. Es gibt keine erfundene automatische Deployment-/Voice-Erkennung.

Stimmen `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`; bei Mini-TTS zusätzlich `ash`, `coral`, `sage`. Geschwindigkeit 0,25–4, Ausgabe MP3/WAV/Opus/AAC/FLAC/PCM. Natürlichsprachliche Anweisungen nur bei `gpt-4o-mini-tts`. Keine separaten Sprach-/Pitch-/Volume-/Stil-/Rollen-Parameter. Sprache ergibt sich aus dem Text bzw. der Anweisung. PCM ist ein Rohformat und besitzt keine direkte Audiovorschau; Export bleibt verfügbar. Sonstige Vorschau hängt von den Electron-Codecs ab.

## Sicherheit und Bestandsschutz

Eine Verbindung je Provider bleibt im verschlüsselten `tts.vault`. Electron safeStorage nutzt unter Windows DPAPI; kein Klartext-Fallback. API-Keys verlassen den Main-Prozess nicht als Zustand/Beispiel und werden nicht angezeigt. Passwortfeld wird nach Übernahme und beim Schließen geleert. Keys werden nur über HTTPS zum ausdrücklich gespeicherten Ursprung gesendet; bei geändertem Ursprung ist eine erneute Key-Eingabe nötig. Keine Redirects und kein automatisches Wiederholen einer Generierung. Abbrechen beendet das lokale Warten; der Cloudserver kann weiterrechnen bzw. Kosten erzeugen.

Python-Beispiele in den Einstellungen sind schlüsselfreie, schreibgeschützte REST-Vorlagen. Sie beziehen Keys aus Umgebungsvariablen. KAIROS führt keinen importierten oder angezeigten Python-Code aus. Die alte Qwen-Verbindung, WAV-Referenz und erzeugtes Audio werden ohne Klartextzwischenschritt übernommen. Qwen Voice Design/Clone und dessen Modellparameter bleiben erhalten, ohne erfundene SSML-/Prosodie-Unterstützung.

## Dokumentation und Verifikation

Abgeglichen am 8. Oktober 2026:

- [Microsoft Speech REST](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [SSML Voice / Prosody / Style](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice)
- [Dragon HD / Omni und SSML-Supporttabelle](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices)
- [Azure OpenAI Speech REST](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/reference-preview)
- [Azure OpenAI TTS Quickstart](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/text-to-speech-quickstart?view=foundry-classic)
- [Microsoft Mini-TTS-Anweisungsbeispiel](https://github.com/Azure-Samples/azure-openai-tts-demo/blob/main/streaming-tts-to-file-sample.py)

Automatisierte Tests prüfen Providerpfade, Headers, Parameterauswahl, XML/SSML, Verschlüsselung/Key-Bindung, Import/Export, Fehler, Abbruch und Migration. `npm run verify:update` prüft die echte Electron-UI mit Fixture-Servern, einschließlich Qwen Design/Clone, Speech HD, SSML-Dateiimport, unabhängigen Arbeitsbereichen, TTS während einer Chat-Anfrage und Foundry-Parametergrenzen. Es wurde keine reale Azure-Synthese getestet, da kein API-Key vorliegt. Die referenzierte `/mnt/data/kairos_tts_studio_reference.zip` ist in dieser Windows-Sitzung nicht verfügbar; es wurde direkt in die vorhandene Architektur integriert.
