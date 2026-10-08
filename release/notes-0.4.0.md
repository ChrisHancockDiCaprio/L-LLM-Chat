# KAIROS 0.4.0 · Sprache und formatierter Chat

KAIROS kann Qwen3-TTS über eine mitgelieferte lokale Serverbrücke bedienen. KI-Antworten erscheinen jetzt mit sicherer Markdown-/HTML-Formatierung statt reinem Klartext.

## Neue Funktionen

- Sprachstudio direkt im Chat; KI-Antworten als überprüfbaren Sprachtext übernehmen.
- Vorgegebene Stimmen (CustomVoice), Stimmen per Beschreibung entwerfen (VoiceDesign), Stimmen aus Referenz-WAV klonen (Base).
- Sprach-/Stimmenlisten und Stilsteuerung passend zum konfigurierten Modell. CustomVoice 0.6B und Base bieten keine Instruction-Steuerung; keine erfundenen Pitch-/Speed-Regler.
- Referenz-WAV und Transkript bzw. X-Vector-Modus; entworfene Stimme als Clone-Referenz weiterverwenden.
- Optional eigene Sampling-Werte, Audiovorschau, WAV-Export und verschlüsselter Speicher für Referenz und letztes Audio.
- Überschriften, Listen, Links, Codeblöcke, Tabellen und einfache HTML-Formatierung. DOMPurify entfernt aktive Inhalte und unsichere Attribute. Externe Bilder und eingebettete Webseiten bleiben gesperrt.

## Einrichtung

`qwen_tts_bridge.py` mit der bestehenden Qwen-TTS-Python-Umgebung auf Ubuntu starten. Die Brücke lauscht auf Loopback; per SSH-Portweiterleitung verbinden und in KAIROS den TTS-Server prüfen. Vollständige Einrichtung und API-Vertrag: **QWEN-TTS.md** (ebenfalls Release-Anhang). Kein automatischer Modellserverstart oder Installation von Gewichten durch die GUI. Standardmodelle: CustomVoice/Base 0.6B, VoiceDesign 1.7B; CPU-freundliche Ladeeinstellungen, jeweils nur ein geladenes Modell.

## Validierung

- 91 Node-Tests einschließlich bestehender Chat-, Bild-, Verlauf-, Tresor-, SSH- und Updatefunktionen sowie Rich-Text-/TTS-Tests.
- 5 Python-Tests für Checkpoint-Fähigkeiten, Parameterprüfung und den HTTP-Vertrag.
- Echte isolierte Electron-UI mit Testservern: Chat/ComfyUI-Regressionen, Rich Text/XSS-Abwehr, Voice Design→Clone, DPAPI-Speicherung, WAV-Export und Abbruch ohne erneute Anfrage.
- Windows-x64 NSIS- und MSI-Build; Paketprüfung bestätigt lokale Parser-/Sanitizer-Assets und schließt Benutzertresore aus.

## Grenzen

Qwen-TTS-Inferenz mit realen Modellgewichten und die Ubuntu-Erstinbetriebnahme sind noch nicht bestätigt. CPU-Synthese kann lange dauern. TTS verwendet vollständige WAV-Antworten, kein Live-Streaming. **Warten beenden** beendet die lokale Anfrage; die SDK-Inferenz kann auf dem Server weiterlaufen. Kein automatischer Retry oder Ergebnis-Wiederabruf. Separater TTS-SSH-Tunnel, keine DashScope-/Gradio-Kompatibilität und keine API-Schlüsselverwaltung der Brücke.

Der Windows-Pilot bleibt ohne Herausgeberzertifikat; automatische Installation bleibt gesperrt. KAIROS-Produktname ist beibehalten; App-ID, bestehende Tresorpfade und Chatdaten bleiben kompatibel. Repository und Release bleiben auf ausdrücklichen Wunsch öffentlich.
