# Hancock in KAIROS – erster Lieferumfang

Aktualisierung: Portable 0.5.1 mit manuellen Updates; die frühere lazy-val-Lücke wurde durch Entfernung aus der Laufzeit beseitigt. Siehe [Portable-Prüfbericht](KAIROS-LAZY-VAL-NACHWEIS-UND-PORTABLE.md). Die Angaben unten dokumentieren die vorherige Etappe.

Stand: 10.10.2026. **M0–M2 des Gesamtplans sind im Entwicklungsstand umgesetzt.** Dies ist keine Fertigmeldung für M3–M7 und kein veröffentlichtes Update. Die vorhandene Paketversion ist weiterhin 0.5.0; der neue Quellstand lässt sich über `kairos/Start-Qwen.cmd` starten. Eine bereits laufende KAIROS-Instanz vorher schließen.

## Bedienung

Hancock sitzt unten rechts im App-Fenster. Klicken oder per Tastatur aktivieren öffnet die größere Figur mit Schnellchat. Die Karte zeigt Gespräch und Zielanbieter, bietet Gesprächsauswahl und ein neues Gespräch. Kleine und große Ansicht teilen Entwurf, Anhänge, Aufträge und gespeicherte Antworten. „Groß öffnen“ führt bei einem fertigen Chat-Ergebnis zum zugehörigen Gespräch, bei einem Sprach-Ergebnis zum Sprachstudio.

„Chatten“ verwendet eine eingerichtete Chat-KI. „Bild erstellen“ wählt ein aktiviertes Bildprofil und öffnet die vollständige Ansicht mit deren Parametern. „Vorlesen“ öffnet das bestehende Sprachstudio. „Aufgaben“ zeigt die bisherigen Generierungsaufträge des aktuellen Gesprächs. Fehlende Einrichtung wird erklärt; ein Aktionsklick startet keine Generierung. Mehrstufige Skills sind noch kein Bestandteil dieser Karte.

Dateiauswahl und Ablage lokaler Dateien auf Figur/Karte verwenden die bestehende Anhangsprüfung: höchstens vier Anhänge, Text/Code bis 16 KB und gültige PNG/JPEG/WebP bis 8 MB, zusätzlich die Upload-Freigaben des Profils. Verzeichnisse, ausführbare Dateien, PDF und Office werden nicht neu unterstützt. Entfernen und Bildvorschau sind in der großen Ansicht verfügbar. Dateiablage bereitet den Anhang vor; nur bewusstes Senden übermittelt Inhalte.

Ruhemodus und Ausblenden werden verschlüsselt gespeichert. Über den oberen Hancock-Knopf lässt sich die Figur wieder einblenden. Escape schließt die Karte, der Entwurf bleibt erhalten. Die Karte scrollt bei kleinen Fenstern. Systemeinstellungen für reduzierte Bewegung gelten auch für die Figur.

## Sicherheits- und Integrationsprüfung

- **110/110 Node-Tests bestanden.** Dazu gehören Authentifizierung, verschlüsselter Verlauf, Anhänge, SSH, TTS, Aufträge und Updateprüfungen. Die ursprünglichen Testpfade außerhalb des Arbeitsbereichs wurden auf `.test-output/` umgestellt. Für den lokalen künstlichen SSH-Server war Ausführung außerhalb der Netzwerksandbox nötig.
- **Echter isolierter Electron-Fenstertest bestanden:** ein ausdrücklich ausgelöster API-POST, Doppelsenden bei laufendem Auftrag abgewiesen; gleicher Verlauf, Entwurf und Anhang in beiden Ansichten; Gesprächswechsel und Navigation zum richtigen Ergebnis; Fehler bei fehlendem Bildprofil; Sprachstudio erreichbar; gespeicherte Sichtbarkeit/Bewegung; Escape, Fokus und Fenstergröße 800 × 600.
- Öffnen, Tippen und Anhangsauswahl erzeugten keine zusätzliche Übertragung. Vorgegebene Pfadzeichenketten und künstliche Dateien ohne lokalen Pfad wurden am Drop-Zugang abgewiesen. Die native Windows-Drag-and-drop-Geste selbst wurde nicht automatisiert nachgestellt.
- Kein Node-Zugriff im Chat-Renderer; kein API-Schlüssel über die Brücke. Testinhalt liegt nicht im Klartext in der Verlaufdatei. Hancock-Stile laden als lokale Datei unter der bestehenden CSP, ohne zusätzliche Inline-Skriptfreigabe.
- Open-Source-Ansicht öffnet ein eigenes lokales Fenster ohne Preload-Zugang, Node, externe Navigation oder Fensteröffnung. Die bestehenden IPC-Absenderprüfungen gelten für neue Einstellungs- und Anhangsaktionen.
- Alle Tests benutzten künstliche Anbieter und frische markierte Testordner. Keine echten KI-Anfragen, kein Zugriff auf den Benutzer-Tresor, keine Installation und keine Veröffentlichung.

Reproduzieren im Ordner `kairos`: `npm test` und `npm run verify:hancock`. Der zweite Befehl erstellt einen eigenen Testordner samt Bericht und Screenshot. Der direkte Hancock-Verifikationsmodus ohne freigegebenen Testordner wird abgewiesen. Die ältere allgemeine Electron-Verifikation benötigt einen echten eingerichteten Ollama-Server; sie wurde für diesen Lieferumfang nicht verwendet.

## Herkunft und Lizenznachweise

Hancock ist eigener SVG-/CSS-/JavaScript-Code. Keine Quelltexte, Pet-Assets, Sounds oder Katalogdaten der drei Inspirationsprojekte wurden übernommen. **30 installierte Produktionspakete** wurden inventarisiert; **33 originale Dateien** (einschließlich Metadaten für die dokumentierte Lücke) werden unter `kairos/licenses/` aufbewahrt. Originale Copyright- und Lizenztexte wurden unverändert kopiert. Electron/Chromium liefern zusätzlich die Laufzeitnachweise im Programmordner.

**Offen vor einer Veröffentlichung:** Die bestehende Abhängigkeit `lazy-val` 1.0.5 nennt MIT und Vladimir Krivosheev als Autor, enthält aber keinen vollständigen Lizenztext. Auch das geprüfte [Original-Repository](https://github.com/develar/lazy-val) enthält keine separate Lizenzdatei. Paketmetadaten und README sind unverändert aufbewahrt; ein Copyright-Text wurde nicht erfunden. Das bleibt ein offener Herkunftsnachweis, keine vollständig abgeschlossene Lizenzfreigabe.

Unter Einstellungen → Updates → „Open Source · Lizenzen und Copyright“ sind die Nachweise abrufbar. Die Paketkonfiguration und Paketprüfung führen Hancock sowie `licenses/` und `THIRD_PARTY_NOTICES.md` mit; ein neues Setup wurde hier noch nicht gebaut.

## Wiederherstellung und nächster Lieferumfang

Die Änderung ergänzt zwei optionale Hancock-Einstellungen. Bestehende Modellprofile, Zugänge und Nachrichtenformate werden nicht verändert. Vor einem späteren manuellen Setup-/Versionswechsel KAIROS schließen und den gesamten im Sicherheitsbereich angezeigten Tresorordner einschließlich seines Schlüsselmaterials in einen privaten Sicherungsordner kopieren. Wiederherstellung nur bei geschlossener App und zusammenpassendem Datenstand. Solche DPAPI-Kopien sind an das Windows-Konto gebunden und keine portable Wiederherstellung für einen anderen Rechner oder Benutzer.

Als Nächstes stehen M3 (zielgebundene Anbieterpfade, Groq/OpenRouter, Streaming, Kontingentprüfung und Kostenlosregeln) und M4 (optionaler Desktop-Begleiter) an. Projekte/Gedächtnis, begrenzte Werkzeuge, Automationen, Spracheingabe und Mobilzugriff bleiben in M5–M7 offen. Die Karte gewährt einem Modell keine zusätzlichen Dateisystem-, Programm- oder Serverrechte.
