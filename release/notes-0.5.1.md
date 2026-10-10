# KAIROS 0.5.1 · Portable Ausgabe

- Windows-ZIP vollständig entpacken und KAIROS.exe starten; Laufzeit enthalten, kein Installer und kein Node.js nötig.
- Neue GitHub-Versionen prüfen und Release-Seite öffnen. Downloads und Programmwechsel erfolgen manuell; keine automatische Installation.
- electron-updater und lazy-val aus den Laufzeitabhängigkeiten entfernt. Originalnachweise aller 14 verbleibenden Pakete enthalten.
- Vorhandener verschlüsselter Windows-Tresor bleibt erhalten und an das Windows-Konto gebunden; Programmdateien sind verschiebbar.
- Hancock mit Schnellchat und gemeinsamen Anhängen, Groq/OpenRouter-Anschlüsse sowie eigener Angebotskatalog und Zugangsauskunft enthalten.
- Chat, Bilder, SSH, Sprachstudio und Formeln bleiben erhalten. Streaming, KittenTTS und Kostenlos-/Budgetregeln sind weiterhin geplant.

113 automatisierte Tests und isolierte Electron-Prüfung bestanden. Portable Anleitung: PORTABLE.md. GitHub Actions baut und prüft die portable Ausgabe vor Veröffentlichung. Prüfsumme und Validierungsbericht werden mitgeliefert. Kein verifiziertes Windows-Herausgeberzertifikat.
