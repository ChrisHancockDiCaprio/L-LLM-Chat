# KAIROS – Umsetzungsplan für KI-Anbieter und Projektfunktionen

Stand: 10.10.2026.
Status: Hancock ist eingebaut und geprüft. Erste Anbieteranschlüsse, eigener Katalog und Zugangsauskunft sind im Entwicklungsstand umgesetzt; Streaming, Kostenregeln, TTS-Erweiterung und Agentenfunktionen bleiben offen. [Anbieter-Prüfbericht](KAIROS-ANBIETER-PRUEFBERICHT.md).
Grundlage: [Analyse](KAIROS-Ideen-und-KI-Anbindungen-2026-10-10.md).

Die verbindliche Gesamt-Reihenfolge einschließlich Hancocks bestätigter Bedienung, Sicherheit und Abnahme steht im [Gesamtplan mit Hancock](KAIROS-GESAMTPLAN-HANCOCK.md). Die Etappen unten dienen als Detailchecklisten. Der eigene Hancock-Begleiter ist gewählt; eine Coucou-Anbindung bleibt eine mögliche spätere Ergänzung.

## Ziel

KAIROS verbindet lokale, kostenlose und kostenpflichtige KI-Angebote über nachvollziehbare Anbieterprofile. Nutzer sehen Ziel, Fähigkeiten, Kostenklasse und verfügbare Quoten. Danach folgen Projektgedächtnis, Auftragsübersicht und ein begrenzter Agentenmodus nach Ideen von Herald.

## Verbindliche Leitlinien

- Vorhandene Ollama-, Bild-, TTS- und SSH-Verbindungen durch Migration erhalten.
- API-Schlüssel im bestehenden verschlüsselten Tresor halten; keine Schlüssel in Katalogen, Logs, Exporten oder Modellkontext.
- Kostenpflichtige Ersatzmodelle nur gemäß ausdrücklich gewählter Regel.
- Gesprächs- und Projektdaten nur an dafür freigegebene Anbieter senden.
- Bei unbekanntem Ausgang einer Anfrage keinen automatischen Doppelauftrag senden.
- Bei Übernahmen Herkunft, Copyright und vollständige Lizenztexte mitführen, einschließlich relevanter Drittkomponenten. API-Sammlung: CC0; Herald: MIT.
- Dateien unter `sources/` bleiben unverändert.

## Reihenfolge

### 1. Anbieteranschlüsse – erster Meilenstein

- [x] Bestehende Profil-, Tresor-, Tunnel- und Zielidentitätslogik vor Änderung prüfen.
- [x] Anbieterkennung, HTTPS-Ursprung und API-Basispfad getrennt modellieren.
- [x] Pfade zentral bilden; keine doppelten `/v1`-Segmente.
- [x] Schlüsselbindung bei Anbieter-/Ursprungs-/Pfadwechsel definieren; Katalog ändert keine Profile.
- [x] Bestehende OpenAI-kompatible Profile auf `/v1` migrieren; Ollama unverändert anbinden.
- [x] Voreinstellungen für Groq und OpenRouter ergänzen; eigener kompatibler Anschluss bleibt möglich.
- [x] Verbindung und Modell testen, ohne automatisch eine Generierung auszulösen.
- [x] Große Modelllisten begrenzen; bis zu 3000 lesen, maximal 100 Modellprofile speichern, gezielte Modell-IDs bei Einrichtung anbieten.
- [x] Mit isolierten Testprofilen Migration, Pfade, Authentifizierungsfehler und Schlüsselbindung prüfen.
- [ ] Live-Piloten mit vom Nutzer eingerichteten Zugängen durchführen; Ergebnisse dokumentieren.

Abnahme: Ein bestehendes lokales Modell und beide Pilotanbieter lassen sich zuverlässig auswählen. Ein Neustart bewahrt Profile und Schlüsselzuordnung. Nicht live geprüfte Anbieter bleiben entsprechend gekennzeichnet.

### 2. Chat, Verbrauch und Fehler

- [ ] Einheitliches Antwortformat für Text, Modell, Verbrauch, Abschlussgrund und Fehler einführen.
- [ ] Anbieter-/Modellabhängige Parameter und Fähigkeiten erfassen.
- [ ] Streaming mit Teilantwort, Abbruch und korrektem Verlauf ergänzen.
- [ ] Ausgabelimit, Verweigerung, leere Antworten und unbekannten Ausgang unterscheiden.
- [x] HTTP 429, `Retry-After` und Quoteninformationen verständlich anzeigen; keine automatische Wiederholung.
- [ ] Kosten als Schätzung mit Preisquelle und Prüfdatum anzeigen; unbekannt bleibt unbekannt.
- [ ] Relevante Transport-, Verlauf- und Sicherheitstests sowie isolierten Fenstertest durchführen.

Abnahme: Keine versteckten Wiederholungen, vollständige und unvollständige Antworten sind unterscheidbar, Verbrauch und Fehler sind nachvollziehbar.

### 3. Kostenlose Angebote finden – früh nutzbarer Ausbau

- [x] Bereich „Kostenlose KI-Angebote und Anbieter“ einbauen.
- [ ] „Angebote aktualisieren“ mit geprüftem Aktualisierungsablauf ergänzen.
- [x] Kleinen datierten Katalog mit offiziellen Registrierungs-/Schlüsselseiten ausliefern.
- [ ] `awesome-free-llm-apis/data.json` als ergänzende Recherchequelle prüfen; Quelle und CC0 mitführen.
- [ ] Angebotstyp unterscheiden: Freikontingent, kostenloses Modell, Testguthaben, ohne Schlüssel.
- [x] Registrierung, Kreditkarte, Regionen, Nutzungsbedingungen, Datenverarbeitung und Prüfdatum je Angebot erfassen; fehlende Angaben als unbekannt markieren.
- [x] „Angebot laut Katalog“, „eigener Zugang geprüft“ und „Modell verfügbar“ getrennt anzeigen.
- [x] Anbieter-Schlüsselseite im Browser öffnen; Nutzer erstellt seinen eigenen Zugang und trägt ihn in KAIROS ein.
- [x] Vorhandenen Zugang über einen dokumentierten, nicht generierenden Endpunkt prüfen.
- [x] OpenRouter: kostenlose Tagesanfragen aus `free_model_daily_requests` und Schlüssellimits über `GET /api/v1/key` auswerten, soweit geliefert. Schlüssellimit ist kein Kontoguthaben; keine Quoten aus Dollarverbrauch ableiten.
- [x] Groq: Quotenheader aus regulären Antworten auswerten; keine Generierung nur zur Quotenabfrage starten.
- [x] Bei fehlender Quoten-API Anbieter-Dashboard verlinken und Verfügbarkeit als unbekannt anzeigen.
- [ ] Katalogaktualisierung validieren und Änderungen anzeigen; bestehende Profile nicht überschreiben.
- [x] Keine öffentlich geteilten/fremden Schlüssel sammeln oder ausprobieren. Die Suche betrifft Angebote für eigene Zugänge.
- [ ] „Nur kostenlos“ anhand bestätigter Modelle und Kostenbedingungen umsetzen; unbekannte Preise ausschließen.
- [ ] Kostenpflichtige Zusatzfunktionen im Kostenlosmodus sperren, soweit relevant; nicht nur Tokenpreise prüfen.
- [ ] Veraltete Angebote, ausgeschöpfte Quoten, ungültige Schlüssel und geänderte Ziele testen.

Abnahme: Nutzer können kostenlose Angebote entdecken, einen eigenen Zugang einrichten und dessen Status sehen. KAIROS behauptet keine garantierte kostenlose Nutzung allein aufgrund eines Katalogeintrags oder erfolgreichen Modellabrufs.

Quellen: [Anbieterkatalog](https://github.com/mnfst/awesome-free-llm-apis/blob/main/data.json), [OpenRouter-Limits](https://openrouter.ai/docs/api-reference/limits), [Groq-Limits](https://console.groq.com/docs/rate-limits).

### 4. Weitere Anbieter und optionales Homelab-Gateway

- [ ] Mistral und Ollama Cloud als nächste Kandidaten offiziell und praktisch prüfen.
- [ ] Danach Hugging Face, NVIDIA NIM und OVHcloud nach Bedarf bewerten.
- [ ] Gemini einschließlich regionaler Bereitstellungsbedingungen bewerten.
- [ ] Für eigene Protokolle direkte Adapter gegen LiteLLM abwägen; Text, Bild und Sprache getrennt behandeln.
- [ ] LiteLLM-Gateway mit Modellalias, Zugang, Diagnose und Betriebsdokumentation optional nutzbar machen.
- [ ] Tatsächlich unterstützte Funktionen je Anschluss dokumentieren.

Abnahme: Jeder freigegebene Anschluss besitzt dokumentierte Tests und Grenzen. Gateway-Schlüssel und Anbieter-Schlüssel bleiben getrennt.

### 5. Herald-Ideen: Projekte, Gedächtnis und Aufträge

- [ ] Projekte als Zusammenhang für Gespräche, Dateien, Erinnerungen und Datenfreigaben definieren.
- [ ] Bestätigte Erinnerungen mit Herkunft, Datum und Bearbeiten/Löschen umsetzen.
- [ ] Startseite mit letzten Projekten, offenen Aufträgen und vorhandenen Ergebnissen ergänzen.
- [ ] Vorhandene Generierungsaufträge von mehrstufigen Arbeitsaufträgen unterscheiden.
- [ ] Aufträge um Ziel, Schritte, Zustände, Ergebnisse und Freigaben erweitern.
- [ ] Befehlsleiste für die häufigsten Aktionen ergänzen.
- [ ] Projekttrennung, Wiederaufnahme und Löschung prüfen.

Abnahme: Ein Projekt lässt sich nachvollziehbar fortsetzen; KAIROS zeigt, welche Fakten und Dateien als Kontext verwendet werden.

### 6. Begrenzter Agentenpilot

- [ ] Pilot: freigegebene Homelab-Diagnosedaten lesen und Bericht erstellen.
- [ ] System-/Werkzeugrollen und Tool Calling im Nachrichtenformat ergänzen.
- [ ] Feste Werkzeuge mit Schema, Zielbereich, Datenfreigabe und Berechtigungen implementieren.
- [ ] Werkzeugargumente unabhängig vom Modell validieren; Aktionen protokollieren.
- [ ] Abbruch, Neustart, Auftragsgrenzen und Fehler behandeln.
- [ ] Schreibende Aktionen erst nach erfolgreichem Diagnosepiloten ergänzen.
- [ ] Hermes als zusätzliche Laufzeit separat auf Windows bewerten, falls der Funktionsumfang es rechtfertigt.

Abnahme: Das Modell kann ausschließlich implementierte und freigegebene Werkzeuge verwenden. Fremde Texte oder Modellantworten erweitern keine Rechte.

## Optionaler Ausbau: Desktop-Begleiter nach Coucou-Ideen

Ergänzt am 10.10.2026. Status: Konzept, nicht implementiert.

Coucou besitzt bereits eine Windows-Version mit Tauri/Rust und einer TypeScript-Oberfläche. KAIROS nutzt Electron. Daher sind zwei Wege sinnvoll: eine optionale Verbindung zur separat installierten Coucou-App oder ein eigener KAIROS-Begleiter in einem kleinen Electron-Fenster.

### A. KAIROS mit der vorhandenen Coucou-App verbinden

- [ ] Explizit aktivierbaren lokalen Adapter für Coucou-Ereignisse vorsehen.
- [ ] KAIROS-Sitzungen über `coucou_agent: kairos` und eindeutige Sitzungs-IDs kennzeichnen.
- [ ] Start, Anfrage, Fertigstellung und Fehler auf die dokumentierten Ereignisse abbilden.
- [ ] Standardmäßig nur Status und neutrale Auftragsnamen übertragen; keine Schlüssel, Prompts, Dateiinhalte oder vollständigen Antworten.
- [ ] Windows-Anbindung über den dokumentierten Relay oder die benutzergebundene Named Pipe prüfen.
- [ ] Geschlossene/fehlende Coucou-App darf KAIROS-Anfragen nicht verzögern oder blockieren.
- [ ] Keine Zustände erfinden: „KAIROS wartet auf Antwort“ beweist keine laufende Serverberechnung.
- [ ] Freigaben zunächst vollständig in KAIROS belassen. Die Drittanbieter-Dokumentation widerspricht sich zum Umfang der Freigabeunterstützung; generische KAIROS-Freigaben müssen für eine konkrete Version separat im Code und live geprüft werden.

Abnahme: Eine KAIROS-Anfrage zeigt in Coucou den richtigen Status und führt beim Klick oder Ausfall des Begleiters zu keinem zweiten Auftrag. Dieser Weg setzt eine separate Coucou-Installation voraus; er liefert Mochi nicht im KAIROS-Installer mit.

### B. Eigenen KAIROS-Begleiter integrieren

- [x] Eigene Figur **Hancock** benannt und als SVG mit animierter Komponente und interaktiver Vorschau erstellt; keine fremden Assets oder Sounds übernommen. Details: [Hancock](../HANCOCK.md).
- [ ] Kleines optionales, rahmenloses Desktop-Fenster und aufklappbare Statuskarte vorsehen.
- [ ] Position, Monitor und Sichtbarkeit speichern; DPI-, Monitorwechsel, Vollbild, Fokus und Mausklicks prüfen.
- [ ] Zustände: bereit, wartet auf Antwort, Ergebnis fertig, Fehler, eigene Freigabe erforderlich.
- [ ] Klick öffnet den passenden Chat, Bildauftrag oder das Sprachstudio.
- [ ] Datei-Drop über die vorhandene Anhangsprüfung führen; Ablegen alleine sendet keine Datei an eine KI.
- [ ] Animationen pausierbar, Sounds stumm schaltbar, Begleiter vollständig abschaltbar machen.
- [ ] Animationen an lokale Ereignisse binden; dafür sind keine Modellaufrufe nötig.
- [ ] Später externe Agenten über gesonderte Adapter anzeigen; Hook-Konfigurationen erst nach überprüfbarer Einrichtung ändern.
- [ ] Später eigene Freigaben an konkrete Auftrags-/Aktions-IDs binden; nach Ablauf oder Neustart keine alte Entscheidung anwenden.
- [ ] Mobilansicht und entfernte Freigaben als eigenen späteren Projektbereich behandeln; Coucous iPhone-/CloudKit-Weg ist keine fertige Windows-KAIROS-Anbindung.

Empfehlung: Nach Etappe 2 zunächst einen einfachen eigenen Statusbegleiter oder alternativ den lokalen Coucou-Adapter als Pilot. Mehrere externe Agenten und Freigaben folgen erst nach einer stabilen Ereignis- und Rechteverwaltung.

### Lizenzgrenze

Der Coucou-Quellcode steht unter MIT mit `Copyright (c) 2026 Louis Raillé`. Bei Codeübernahmen Copyright und vollständige MIT-Lizenz mitführen. Namen „Coucou“/„Mochi“, die Mochi-Figur mit ihrem Erscheinungsbild und Animationen, Icons, Sounds und bestimmte Medien sind separat vorbehalten. Ihre Veröffentlichung/Weitergabe in einer eigenen App benötigt laut Asset-Lizenz schriftliche Erlaubnis; bloße Copyright-Nennung genügt dafür nicht. Der geplante eigene KAIROS-Begleiter verwendet deshalb eigene Gestaltung und Medien.

Quellen: [Windows-Architektur und Funktionen](https://github.com/Louis-CFM/coucou/blob/main/windows/README.md), [Drittanbieter-Ereignisse](https://github.com/Louis-CFM/coucou/blob/main/docs/AGENTS.md), [MIT-Code-Lizenz](https://github.com/Louis-CFM/coucou/blob/main/LICENSE), [Asset-Lizenz](https://github.com/Louis-CFM/coucou/blob/main/LICENSE-ASSETS.md).

## Lizenznachweise bei der Umsetzung

- [ ] Jede tatsächliche Übernahme mit Repository, Version/Commit, Dateien und Änderungen erfassen.
- [ ] `THIRD_PARTY_NOTICES.md` und `licenses/` für übernommenes Material anlegen.
- [ ] Copyright-/Lizenztexte unverändert übernehmen.
- [ ] Nachweise im Windows-Paket und unter „Über KAIROS → Open Source“ zugänglich machen.
- [ ] Eigenständig umgesetzte Ideen als Inspiration kennzeichnen.

## Nächster konkreter Arbeitsschritt

Gemäß Gesamtplan zuerst M0–M2: Ausgangsstand und Herkunft erfassen, Hancock mit Karte innerhalb von KAIROS einbauen und vorhandene Chats, Bilder und TTS anbinden. Danach M3: Verbindungsschema, Pfadbildung und Migration, Groq-/OpenRouter-Voreinstellungen und Angebotssuche. Dieser Plan richtet keine Konten, kostenpflichtigen Dienste oder Veröffentlichungen ein.
