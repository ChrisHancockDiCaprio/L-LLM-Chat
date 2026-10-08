# KAIROS 0.4.1 · Formeln im Chat

LaTeX-Formeln in KI-Antworten werden jetzt als lesbare mathematische Ausdrücke dargestellt. Das behebt die bisher sichtbaren Dollarzeichen und kryptischen LaTeX-Befehle.

- Inline-Formeln mit `$…$` oder `\(…\)`; abgesetzte Formeln mit `$$…$$` oder `\[…\]`.
- Brüche, Wurzeln, Summen, Integrale, Hoch-/Tiefstellungen und Matrizen; Formeln auch in Listen und Tabellen.
- Lokal mitgeliefertes KaTeX mit CSS und Schriftdateien: keine CDN-Verbindung oder externe Inhalte.
- Codeblöcke und Inline-Code bleiben unverändert. Fehlerhafte oder nicht unterstützte Formeln bleiben als Text sichtbar. KAIROS korrigiert keine mathematisch falschen KI-Antworten.
- Getrennte Sanitizer-Regeln für Chat-HTML und generierte Formel-Darstellung; externe Bilder/Links und HTML-Erweiterungen innerhalb von LaTeX bleiben gesperrt. Makroexpansion und Formelgröße sind begrenzt.
- Historie und Modellkontext behalten den Originaltext. Die Übernahme ins Sprachstudio dupliziert nicht die visuelle und barrierefreie Formeldarstellung.

Validierung: 94 Node-Tests, 5 Python-Tests und isolierte echte Electron-Prüfung einschließlich KaTeX-Schriften, Formelgeometrie, bestehender Chat-/TTS-Funktionen und Sicherheitsfällen. Windows EXE/MSI und Paketprüfung laufen im GitHub-Releaseworkflow.

Bestehende Einschränkungen von 0.4.0 gelten weiter: Qwen-TTS benötigt die separat gestartete Serverbrücke; CPU-Synthese kann langsam sein. Windows-Pilot ohne Herausgeberzertifikat.
