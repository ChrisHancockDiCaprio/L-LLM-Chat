# KAIROS 0.5.0 · Unabhängiges Sprachstudio

- Eigener TTS-Reiter mit Text-/SSML-Modus, UTF-8-Dateiimport, Modell-/Voice-Auswahl, passenden Parametern, Audiovorschau, Export und Abbruch.
- Azure Speech: reale Stimmenliste pro Endpoint, SSML-Synthese und gültige Sprach-/Stil-/Rollen-Auswahl. Dragon-HD-/Omni-Stimmen erhalten passende Parameter statt nicht unterstützter Prosodie-Regler.
- Azure Foundry/OpenAI TTS als getrennter Text-Adapter mit Deployment, Modellfamilie, API-Version, Stimme, Geschwindigkeit und Mini-TTS-Anweisungen; kein SSML.
- TTS-Einstellungen mit HTTPS-Endpoint, Region/Deployment und verschlüsseltem API-Key. Schreibgeschützte, schlüsselfreie Python-Beispiele werden nicht ausgeführt.
- Chat und TTS arbeiten unabhängig mit getrenntem Abbruch. Qwen Voice Design/Clone, alte verschlüsselte Verbindungen, Referenzen und Audio bleiben erhalten. Ein beschädigter TTS-Tresor blockiert den Chat nicht.
- Keine automatischen Wiederholungen; verständliche Azure-Fehler, lokale SSML-/Audio-Prüfung und Schutz gegen externe SSML-Assets.

Validierung: 106 Node-Tests, fünf Python-Brückentests und isolierte echte Electron-UI-Prüfung mit Azure-/Qwen-/Chat-Fixtures. Windows-x64-Setup und MSI werden mit Paketprüfung gebaut.

Grenzen: kein echter Azure-Aufruf ohne Nutzer-Key; eine gespeicherte Verbindung je Provider; vorgefertigte Speech-Stimmen, kein Custom-Voice-Training oder Batch-/Long-Audio. SSML unterstützt eine sichere Teilmenge. PCM hat nur Export, keine Vorschau. Abbrechen stoppt lokales Warten; der Server kann weiterrechnen. Der Installer ist weiterhin unsigniert. Details: TTS-STUDIO.md.
