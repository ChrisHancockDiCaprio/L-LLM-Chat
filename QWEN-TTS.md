# Qwen TTS in KAIROS

## Bedienung

Den eigenen Reiter **♪ Sprachstudio** öffnen oder unter einer KI-Antwort **Im Sprachstudio öffnen** wählen. Der Text wird zur Prüfung übernommen; Sprache entsteht erst durch **Sprache erzeugen**. Unter **Einstellungen → TTS → Qwen TTS** die Serveradresse eingeben und **Prüfen & speichern** anklicken. Danach im Sprachstudio Qwen auswählen und nach einem Neustart die Verbindung laden. KAIROS zeigt ausschließlich die von der Serverbrücke gemeldeten Modi, Sprachen und Stimmen. Änderungen an der Adresse erfordern eine erneute Prüfung. Azure-Anbindungen und SSML sind in [TTS-STUDIO.md](TTS-STUDIO.md) beschrieben.

Audio anhören, als WAV speichern oder **Als Referenzstimme verwenden** wählen. Letzteres übernimmt das erzeugte Audio und sein Transkript zum anschließenden Cloning. **Referenz entfernen** entfernt den gespeicherten Referenzclip. Ein neues Ergebnis ersetzt das letzte Ergebnis. Stimme, Referenztext und Audio bleiben im verschlüsselten `tts.vault`; beim bewussten WAV-Export entsteht eine unverschlüsselte Datei am gewählten Ort. Kein automatisches Vorlesen und keine Änderung des gespeicherten Chattexts oder Modellkontexts.

## Offiziell unterstützte Fähigkeiten

Recherche am 8. Oktober 2026 anhand des [Qwen-Repositories](https://github.com/QwenLM/Qwen3-TTS), [SDK-Quellcodes](https://github.com/QwenLM/Qwen3-TTS/blob/main/qwen_tts/inference/qwen3_tts_model.py) und [Modellimplementierung](https://github.com/QwenLM/Qwen3-TTS/blob/main/qwen_tts/core/models/modeling_qwen3_tts.py).

| Modus | Modell | Eingaben / GUI |
|---|---|---|
| Vorgegebene Stimme | CustomVoice 0.6B / 1.7B | Text, Sprache, Speaker-ID; Stil-Anweisung nur mit 1.7B |
| Stimme entwerfen | VoiceDesign 1.7B | Text, Sprache, freie Stimmbeschreibung (`instruct`) |
| Stimme klonen | Base 0.6B / 1.7B | Text, Sprache, Referenzaudio und genaues Transkript; `x_vector_only_mode` erlaubt Stimmprofil ohne Transkript |

Zehn Sprachen einschließlich Deutsch sowie automatische Sprachauswahl. Die konkreten Listen werden aus dem konfigurierten Checkpoint gelesen. Tonfall, Emotion, Klangfarbe und Sprechtempo lassen sich bei instruction-fähigen Modellen sprachlich beschreiben; keine garantierten numerischen Pitch-/Speed-Regler. Kein allgemeiner Audio-Editing-Endpunkt. Design variieren und erneut erzeugen, danach als Clone-Referenz verwenden.

Erweiterte GUI: `do_sample`, `temperature`, `top_p`, `top_k`, `repetition_penalty`, `max_new_tokens`. Ohne Aktivierung bleiben die Modellvorgaben erhalten. SDK-Subtalker-Parameter sind bewusst nicht Teil der GUI. Die SDK-Methoden liefern vollständige WAVs; `non_streaming_mode=False` allein ist keine echte Streaming-API. KAIROS unterstützt hier vollständiges Audio, keine Live-Audiopakete.

## Ubuntu-Serverbrücke

Das offizielle lokale SDK besitzt keine einheitliche HTTP-API für diese drei Modi. KAIROS verwendet deshalb den eigenen, versionierten Vertrag `kairos-qwen-tts-v1` aus `server/qwen_tts_bridge.py`. Ein Ollama-, DashScope-, Gradio- oder beliebiger OpenAI-TTS-Endpunkt ist damit nicht austauschbar. Die Brücke und diese Anleitung liegen auch als Release-Anhänge vor.

Auf Ubuntu die Brücke in den bestehenden Qwen-TTS-Ordner kopieren und mit dessen Python-3.12-Umgebung starten. Beispiel für eine neue Umgebung, falls noch keine vorhanden ist:

```sh
mkdir -p /mnt/LLM/apps/kairos-tts
cd /mnt/LLM/apps/kairos-tts
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python qwen-tts soundfile
# qwen_tts_bridge.py aus dem Release oder Repository hierher kopieren
.venv/bin/python qwen_tts_bridge.py
```

Die vorhandene Installation aus dem Chat „Qwen TTS Installation“ kann stattdessen genutzt werden: kein zweites PyTorch installieren, wenn der bestehende CPU-Import bereits funktioniert. SoX ggf. mit `sudo apt install sox libsox-fmt-all libsndfile1` ergänzen. FlashAttention ist für diese Brücke nicht erforderlich (`eager`-Attention).

Standard: Loopback `127.0.0.1:8860`, CPU/float32, 0.6B CustomVoice und Base, 1.7B VoiceDesign. Die Modellkonfigurationen werden beim Start gelesen; Gewichte erst beim ersten Erzeugen geladen. Nur ein Modell bleibt geladen. Wechsel laden ein anderes Modell und können dauern. Fehlende Gewichte werden über Hugging Face heruntergeladen. CPU-Synthese kann sehr langsam sein. Für GPU mit geeigneter Hardware `KAIROS_TTS_DEVICE=cuda:0` setzen; die vorhandene GTX 950 wurde für diesen Patch nicht als geeigneter GPU-Lauf bestätigt.

Optionale Umgebungsvariablen: `KAIROS_TTS_PORT`, `KAIROS_TTS_DEVICE`, `KAIROS_TTS_CUSTOM`, `KAIROS_TTS_DESIGN`, `KAIROS_TTS_CLONE`. Modellwerte sind HF-IDs oder lokale Modellverzeichnisse; leer deaktiviert den Modus. Für Stilsteuerung mit vorgegebener Stimme z. B.:

```sh
KAIROS_TTS_CUSTOM=Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice .venv/bin/python qwen_tts_bridge.py
```

Vom Windows-Rechner einen eigenen SSH-Tunnel öffnen (Benutzer/Host ersetzen):

```powershell
ssh -N -L 127.0.0.1:8860:127.0.0.1:8860 BENUTZER@UBUNTU-HOST
```

In KAIROS `http://127.0.0.1:8860` und die HTTP-Heimnetz-Ausnahme wählen. Die unverschlüsselte HTTP-Strecke liegt lokal innerhalb des SSH-Tunnels. Die Brücke bleibt ausschließlich auf Loopback, hat keine API-Schlüsselverwaltung und darf nicht ungeschützt ins Internet veröffentlicht werden. Browser-Origin-Anfragen werden abgewiesen; kein CORS. Der Chat-Tunnelmanager verwaltet diesen separaten TTS-Tunnel noch nicht.

## Vertrag und Grenzen

- `GET /v1/tts/capabilities`: Protokollkennung, verfügbare Modi, Modell, Sprachen, Speaker und Instruction-Fähigkeit. Checkpoint-Konfiguration wie im offiziellen SDK; keine erfundenen Stimmen.
- `POST /v1/tts/generate`: JSON mit validierten, modusspezifischen Eingaben; Rückgabe `audio/wav`. Referenz ist Base64-WAV, niemals ein serverseitiger Dateipfad oder eine fremde Audio-URL. Keine beliebigen Modellnamen/SDK-Argumente aus dem Client.
- Eingabetext bis 4000 Zeichen, Beschreibung bis 2000; Referenz WAV PCM/Float mono/stereo 8–96 kHz bis 30 Sekunden/16 MB; Ergebnis bis 16 MB. Gleichzeitig höchstens eine Generierung; weitere Aufträge erhalten HTTP 409.
- **Warten beenden** bricht die lokale Anfrage ab. Die SDK-Inferenz kann serverseitig weiterlaufen. Kein automatischer Retry, kein serverseitiger Stop oder Wiederabruf. Bei HTTP 409 warten, bis die vorherige Inferenz fertig ist.
- Validierte Referenzaudiodaten und Ergebnis werden nicht serverseitig gespeichert. Gewichte und Konfigurationen verbleiben im normalen Modellcache. Eigene oder freigegebene Stimmen verwenden.

## Sicherer Rich Text

KI-Antworten verwenden lokalen Marked-Parser (GFM) und DOMPurify mit enger Tag-/Attributliste. Überschriften, Listen, Links, Codeblöcke, Tabellen und einfache HTML-Formatierung sind erlaubt. Skripte, Event-Handler, CSS, SVG, Frames, Formulare und entfernte Bilder werden entfernt. Nur HTTP(S)-Links werden durch einen expliziten Klick im Browser geöffnet; der Hauptprozess prüft das Ziel erneut. CSP, Sandbox und Kontextisolierung bleiben aktiv. Nutzertexte bleiben Klartext, Historie und Kontext bleiben unverändert.

## Prüfung

91 Node-Tests, 5 Python-Vertrags-/HTTP-Tests; echte Electron-UI mit künstlichen Chat-, ComfyUI- und TTS-Antworten, Windows-DPAPI, Design→Clone, Audioexport, XSS-Abwehr und Abbruch ohne Retry. Windows NSIS/MSI-Build und Paketprüfung. Reale Qwen-Modellinferenz und die Ubuntu-Installation werden durch diese Fixture-Tests nicht bestätigt; für die Erstinbetriebnahme einen kurzen Satz pro aktiviertem Modus erzeugen.
