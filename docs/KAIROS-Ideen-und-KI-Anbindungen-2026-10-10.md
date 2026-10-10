# KAIROS: Herald-Ideen und KI-Anbieter

Stand: 10.10.2026. Analyse und Umsetzungsvorschlag; keine implementierte Erweiterung.

## Ergebnis

Beide Projekte sind als Inspiration sinnvoll. Für KAIROS haben eine bequemere Anbieteranbindung, bewusste Auswahl zwischen lokalen und externen Modellen sowie eine Übersicht über Projekte und Aufträge den größten unmittelbaren Nutzen. Herald liefert darüber hinaus Ideen für einen späteren Agentenmodus.

Empfehlung: zuerst die bestehende KAIROS-Verbindungsschicht ausbauen, danach Projektkontext und Auftragsübersicht ergänzen, anschließend einen begrenzten Agentenmodus entwickeln. Hermes kann später als zusätzliche Laufzeit bewertet werden. Eine komplette Herald-Übernahme würde Plattform- und Laufzeitabhängigkeiten mitbringen.

## Umfang und Nachweise

Gelesen wurden die beiden Repository-Übersichten, Heralds Architektur, System-Bridge, LICENSE und NOTICE, README und Datenkatalog der API-Sammlung sowie ausgewählte offizielle Anbieter- und Gateway-Dokumentationen. Lokal geprüft wurden insbesondere KAIROS README, LiteLLM-Konzept, Workflow- und SSH-/Auftragsdokumentation sowie die Verbindungssicherheit, Profile, Chattransport, Anfragevalidierung und Auftragsverwaltung.

Dies ist eine Architekturprüfung anhand der verfügbaren Quellen, kein vollständiges Sicherheitsaudit aller Dateien oder Live-Test sämtlicher Anbieter. Modellnamen, Freikontingente und Vertragsbedingungen müssen vor Freigabe eines konkreten Anschlusses aktuell beim Anbieter geprüft werden. Es wurden keine fremden Quelltexte in die Anwendung übernommen und keine Schlüssel eingerichtet.

## 1. Ausgangslage in KAIROS

Der lokale Stand ist laut README 0.5.0. Bereits vorhanden sind:

- Windows/Electron-Oberfläche mit getrenntem Hauptprozess und eingeschränkter Oberfläche.
- Ollama und OpenAI-kompatibler Chat, mehrere Modellprofile und Modellabfrage.
- Getrennte verschlüsselte Speicherung für Zugangsdaten, Einstellungen und Gespräche.
- Vision-/Textanhänge, Bild-Backends und ComfyUI-Workflows.
- Qwen- und Azure-Sprachstudio.
- Eigene SSH-Tunnel und gespeicherte Generierungsaufträge; ComfyUI-Ergebnisse können unter bestimmten Voraussetzungen wieder abgerufen werden.

LiteLLM besitzt eine Konzeptansicht; eine spezielle Gateway-Verwaltung ist noch nicht umgesetzt. Ein allgemeiner OpenAI-kompatibler Anschluss ist vorhanden.

Konkrete Grenzen im gelesenen Code:

| Stelle | Heutiges Verhalten | Nötige Erweiterung |
|---|---|---|
| `src/connection-security.mjs` | `normalizeOrigin` akzeptiert nur den Ursprung ohne API-Pfad | Ursprung und validierten API-Basispfad getrennt verwalten |
| `src/openai-client.mjs` | Feste Pfade `/v1/models` und `/v1/chat/completions` | Pfade aus einem Anbieteradapter bilden |
| `src/openai-client.mjs` | Modellliste maximal 100 Einträge | Pagination und Auswahl für große Kataloge; weiter begrenzte Antworten |
| `src/openai-client.mjs` | Nur vollständige Textantwort mit `finish_reason=stop`; kein Streaming | Strukturierte Antworttypen, Teilantworten, Tool-Aufrufe und Streaming |
| `src/ollama-request.mjs` | Nur Rollen `user` und `assistant` | Eigenes Nachrichtenformat für Systemvorgaben, Werkzeuge und Ergebnisse |
| `src/openai-client.mjs` | Antwortinhalt wird als String zurückgegeben | Verbrauch, Modellidentität und Abschlussgrund zusätzlich speichern |
| `src/settings-store.mjs` | Bis 100 Profile; Parametergrenzen für Kontext und Ausgabe | Anbieter-/Modellgrenzen berücksichtigen und Profile vom Katalog trennen |
| Auftragsdokumentation | Eine aktive Anfrage; kein allgemeiner serverseitiger Wiederabruf | Bei späterer Parallelität getrennte Abbruchsteuerung und Zustände je Auftrag |

Die vorhandenen Grenzen sind kein Anlass, überall Limits zu entfernen. Große Cloud-Kataloge und Kontextfenster brauchen eine gezielte Erweiterung mit Größen-, Kosten- und Speichergrenzen.

## 2. Herald: Ideen und Passung

Herald verwendet eine Electron-Oberfläche über der unveränderten Hermes-Laufzeit. Oberfläche, privilegierter Hauptprozess und Agentenlaufzeit haben getrennte Zuständigkeiten. Für Windows sind die Host-Anbindungen derzeit Platzhalter; die System-Bridge meldet dort fehlende Unterstützung. Das erklärt, weshalb direkte Übernahmen von Systemfunktionen eine Windows-Implementierung benötigen. Quellen: [Architektur](https://github.com/iamlukethedev/Herald-OS/blob/main/docs/ARCHITECTURE.md), [System-Bridge](https://github.com/iamlukethedev/Herald-OS/blob/main/docs/SYSTEM-BRIDGE.md).

Herald bietet unter anderem Overview, Missions, Memory, Automations, Sprachbedienung, eine Befehlsleiste und Studio-Funktionen. Quelle: [README](https://github.com/iamlukethedev/Herald-OS).

Die folgenden Vorschläge sind eigene Ableitungen für KAIROS:

| Idee | Konkrete KAIROS-Ausprägung | Priorität / Aufwand |
|---|---|---|
| Übersicht zum Weiterarbeiten | Letzte Projekte, offene Aufträge, Ergebnisse und bewusst gewählte nächste Schritte | Hoch / mittel |
| Missions | Auftrag mit Ziel, Schritten, Modell, Zustand, Ergebnis und benötigten Freigaben | Hoch / mittel bis hoch |
| Memory | Pro Projekt bestätigte Fakten, Entscheidungen und Präferenzen; einsehbar, editierbar, löschbar | Hoch / mittel |
| Connections | Gemeinsame Verwaltung von Chat-, Bild-, Sprach- und später Werkzeugverbindungen | Hoch / mittel |
| Verbrauchsanzeige | Lokale Verbrauchsdaten, Anbieterquoten soweit abfragbar, Kosten mit Aktualitätsdatum | Hoch / mittel |
| Befehlsleiste | Schnellzugriff auf Gespräch, Modellwechsel, Auftrag, Sprachstudio und Einstellungen | Mittel / klein bis mittel |
| Sprachbedienung | Sprache erkennen, Anfrage bearbeiten, vorhandenes TTS für die Antwort verwenden | Mittel / mittel bis hoch |
| Systemwerkzeuge | Zunächst begrenzte Windows-/Homelab-Diagnose mit fest definierten Funktionen | Später / hoch |
| Automationen | Gespeicherte Abläufe mit festem Datenumfang, Modell, Budget und Zeitplan | Später / hoch |
| Studio | Dateien und Vorschau zu einem Projekt zeigen; Änderungen als überprüfbare Schritte | Später / hoch |
| Office / Canvas / vollständige Desktop-Shell | Separate Produktbereiche mit erheblichem Wartungsbedarf | Zurückstellen / sehr hoch |

Beispiel für Homelab: „Analysiere diese freigegebenen Serverlogs und erstelle einen Bericht.“ KAIROS sammelt definierte Daten, verwendet das gewählte Modell und zeigt das Ergebnis. Ein späterer Auftrag „Starte den Dienst neu“ benötigt zusätzlich ein konkret implementiertes Werkzeug und eine passende Freigabe. Ein SSH-Tunnel allein ist keine Fähigkeit zur Serveradministration.

Für ein Projektgedächtnis zunächst bestätigte Fakten und kurze Zusammenfassungen speichern. Eine Vektordatenbank ist für den ersten Schritt nicht zwingend. Jede Erinnerung erhält Projekt, Herkunft, Zeitpunkt und Datenfreigabe. Dateien oder Kalender sollten erst nach bewusster Einrichtung als Kontextquelle hinzukommen.

## 3. Die API-Sammlung sinnvoll verwenden

Die Sammlung ist ein Anbieter- und Modellkatalog, keine fertige KAIROS-Anbindung. Sie enthält auch `data.json`; beim Lesen war dort der 05.10.2026 als Aktualisierungsdatum angegeben. Das ist als Ausgangspunkt für einen eigenen, überprüften Katalog geeignet. Quellen: [Repository](https://github.com/mnfst/awesome-free-llm-apis), [Datenkatalog](https://github.com/mnfst/awesome-free-llm-apis/blob/main/data.json).

Folgende Einteilung ist eine Planungseinschätzung, keine Live-Kompatibilitätsbestätigung:

| Kandidaten aus der Sammlung | Vorgeschlagene Behandlung |
|---|---|
| Groq, OpenRouter | Erste Pilotanschlüsse; Pfade offiziell nachgeprüft |
| Mistral, Ollama Cloud | Danach gezielt prüfen und als Anbieterprofil ergänzen |
| Hugging Face, NVIDIA NIM, OVHcloud | Zusätzliche Profile nach Prüfung von Authentifizierung, Modellen und Nutzungsbedingungen |
| Gemini | Kompatibilitätsanschluss möglich; regionale Bedingungen vor Produktfreigabe prüfen |
| Cohere, Cloudflare Workers AI | Eigenen Schnittstellenadapter oder Gateway einplanen; Katalogadresse nicht blind als Chat-Basis verwenden |
| Aion Labs, Z AI, Kilo Code, LLM7.io, ModelScope, SiliconFlow | Optionaler Ausbau; erst offizielle Endpunkte, Bedingungen und Modellfunktionen bestätigen |

„Kostenlos“ sollte in KAIROS genauer ausgewiesen werden: dauerhaftes Freikontingent, ausgewähltes kostenloses Modell, Testzugang oder zeitlich begrenztes Guthaben. Außerdem gehören Kontingent, Registrierung, Nutzungsbeschränkungen, Datenverarbeitung und Prüfdatum zur Anbieterkarte. Ein Anbietername allein sagt nichts über die Kosten des ausgewählten Modells aus.

Nicht sämtliche GitHub-Daten ungeprüft beim Start übernehmen. Besser: einen versionierten Katalog ausliefern und Aktualisierungen nach Schema prüfen. Aktualisierte Modellnamen dürfen keine bestehende Auswahl ersetzen. Endpunktänderungen dürfen keine gespeicherten Schlüssel auf ein neues Ziel übertragen. Ein Katalog enthält Daten und Dokumentationslinks, keinen ausführbaren Code und keine Geheimnisse.

## 4. Anschlussarchitektur

Vorgeschlagener Ablauf:

```text
Chat / Auftrag / Sprachstudio
          |
Modellauswahl + Datenfreigabe + Kostenregel
          |
Anbieteradapter in KAIROS
          |
          +-- Ollama im Homelab
          +-- Externe KI-API direkt
          +-- Optional: LiteLLM im Homelab --> weitere Anbieter
```

Eine Verbindung hält Anbieter, Ursprung, API-Basispfad, Protokoll, Authentifizierungsart und einen Verweis auf den Tresor. Ein Modellprofil hält Modell-ID, Fähigkeiten und Parameter. Aufgaben wie Text, Bildgenerierung, Spracheingabe und Sprachausgabe bleiben getrennt auswählbar: Ein Chatanschluss macht noch kein Sprach- oder Bildmodell nutzbar.

Ein einheitliches Ergebnisformat sollte Text, Werkzeuganforderungen, tatsächliches Modell, Verbrauch, Abschlussgrund und Fehler enthalten. Nicht unterstützte Parameter werden anhand eines überprüften Profils weggelassen. Fähigkeiten wie Vision, strukturierte Ausgabe und Tool Calling brauchen einen bekannten oder getesteten Status; eine Modellliste garantiert sie nicht.

### API-Pfade: bestätigter Umbaugrund

| Anbieter | API-Basis | Quelle |
|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | [Offizielle Kompatibilität](https://console.groq.com/docs/openai) |
| OpenRouter | `https://openrouter.ai/api/v1` | [Offizielle API-Dokumentation](https://openrouter.ai/docs/api-reference/limits) |
| Gemini, OpenAI-kompatibel | `https://generativelanguage.googleapis.com/v1beta/openai/` | [Offizielle Kompatibilität](https://ai.google.dev/gemini-api/docs/openai) |

KAIROS würde heute andere Pfade erzeugen oder die Eingabe ablehnen. Daher braucht es einen gemeinsamen Pfadbaustein und eine Migration bestehender Profile: Bisherige OpenAI-Profile behalten `/v1`, Ollama seinen nativen Anschluss. TLS-Prüfung, Verbot von Zugangsdaten in URLs und Schutz vor Schlüsselweitergabe bleiben Bestandteil der Verbindungsprüfung.

### Direkter Anschluss und LiteLLM

Für den Einstieg sind direkte Anbieterprofile überschaubar und ohne weiteren Server nutzbar. Für mehrere Geräte oder zentral verwaltete Anbieter ist ein LiteLLM-Gateway im Homelab sinnvoll: KAIROS verwendet dann einen Gateway-Schlüssel; die eigentlichen Anbieterzugänge und Routingregeln liegen am Gateway. LiteLLM vereinheitlicht zahlreiche Anbieter über das OpenAI-Format. Quelle: [LiteLLM-Dokumentation](https://docs.litellm.ai/docs/).

Ein Gateway braucht Betrieb, Updates und Zugriffsschutz. Es verschafft kein kostenloses Kontingent und verhindert keine externe Datenübermittlung. Für Anbieter mit eigenen Protokollen kann es KAIROS Adapterarbeit ersparen; spezielle Medien- oder Echtzeitfunktionen benötigen trotzdem gesonderte Prüfung.

## 5. Kosten, Quoten und Datenfreigaben

Vorgeschlagene auswählbare Regeln:

- **Nur lokal:** ausschließlich freigegebene Homelab-Modelle.
- **Nur kostenlos:** ausschließlich aktuell bestätigte kostenlose Modelle; bei ausgeschöpfter Quote warten oder einen freigegebenen Ersatz anbieten.
- **Budget:** externe kostenpflichtige Nutzung innerhalb eines ausdrücklich gewählten Budgets.
- **Manuell:** Modell und Anbieter für jede Aufgabe selbst wählen.

Für automatische Ersatzmodelle braucht es eine gespeicherte Reihenfolge und dieselben oder strengere Daten-/Kostenbedingungen. Nach einem Verbindungsabbruch mit unbekanntem Ausgang darf kein zweiter Auftrag automatisch entstehen. Auch ein Wechsel zu einem anderen Anbieter kann den Gesprächsverlauf erneut übertragen.

Quoten können Anfragen, Tokens oder Parallelität begrenzen. Groq dokumentiert Organisationslimits, verbleibende Quoten in Antwortheadern und HTTP 429 mit `Retry-After`. KAIROS sollte daraus verständliche Wartehinweise erzeugen. Quelle: [Groq-Limits](https://console.groq.com/docs/rate-limits).

OpenRouter stellt Verbrauch und Kreditlimits über einen eigenen Schlüssel-Endpunkt bereit und besitzt einen kostenlosen Modellrouter. Das ist ein optionaler Anbieteranschluss, kein Ersatz für KAIROS eigene Datenfreigabe. Quellen: [Limits](https://openrouter.ai/docs/api-reference/limits), [Free Router](https://openrouter.ai/docs/guides/routing/routers/free-router).

Ein lokaler Kostenzähler ist eine Schätzung, solange nicht alle Preise und abrechenbaren Funktionen bekannt sind. Für harte Grenzen auch die vom Anbieter/Gateway angebotenen Limits verwenden. Unbekannte Kosten oder Quoten ausdrücklich als unbekannt anzeigen.

Für Gemini ist in Europa eine besondere Produktprüfung nötig: Die aktuellen Bedingungen unterscheiden Entwicklungsnutzung von der Bereitstellung eines API-Clients an Nutzer im EWR, der Schweiz oder dem Vereinigten Königreich; für Letzteres werden Paid Services verlangt. Die Datenbedingungen für Nutzer in diesen Regionen unterscheiden sich ebenfalls von der allgemeinen Aussage zur kostenlosen Nutzung. Quelle: [Gemini-Bedingungen](https://ai.google.dev/gemini-api/terms).

## 6. Ein späterer Agentenmodus

Weitere Anbieter erweitern zunächst die Modellauswahl. Eigenständige Arbeit benötigt zusätzlich eine Agentenlaufzeit mit Planung, Werkzeugen, Ergebnissen und Abbruchsteuerung.

Für den ersten Agentenschritt empfehle ich wenige feste Werkzeuge: Projektdateien aus einem freigegebenen Bereich lesen, definierte Diagnosedaten erfassen und Berichte in einem festgelegten Ausgabeordner speichern. Danach gezielt Änderungen ergänzen. Werkzeugargumente werden außerhalb des Modells validiert; Berechtigungen gelten je Werkzeug und Ziel. Protokolle enthalten Entscheidungen und Ergebnisstatus, keine Schlüssel oder unnötigen Dokumentinhalte.

Heralds Idee von abgestuften Werkzeugrechten lässt sich hierfür verwenden. KAIROS sollte zusätzlich die Übermittlung von gelesenen Daten getrennt behandeln: Lokal lesen zu dürfen bedeutet nicht automatisch, diese Inhalte an eine Cloud-KI schicken zu dürfen. Fremde Dateien und Modellantworten sind keine Berechtigungsquelle.

Alternative: Hermes als eigene lokale Laufzeit anbinden. Vor dieser Entscheidung wären Windows-Unterstützung, Installation, Laufzeitpflege, Sitzungsisolation, Rechteverwaltung und Schnittstellen praktisch zu prüfen. Für den aktuellen Schwerpunkt Anbieteranbindungen ist diese Abhängigkeit noch nicht erforderlich.

## 7. Lizenz und Copyright

Herald steht unter MIT, mit `Copyright (c) 2026 Luke The Dev (@iamlukethedev)`. Bei Übernahme von Quelltext oder wesentlichen Teilen müssen der Copyright-Hinweis und die vollständige MIT-Lizenz erhalten bleiben. Quelle: [Herald LICENSE](https://github.com/iamlukethedev/Herald-OS/blob/main/LICENSE).

Heralds NOTICE nennt zusätzlich Hermes-/Nous-Material und weitere Komponenten. Bei einer konkreten Übernahme müssen die tatsächlich übernommenen Dateien, Bibliotheken und Modelle samt ihren jeweiligen Hinweisen erfasst werden. Die Root-Lizenz ersetzt deren Prüfung nicht. Quelle: [Herald NOTICE](https://github.com/iamlukethedev/Herald-OS/blob/main/NOTICE).

Die API-Sammlung steht unter **CC0 1.0**, nicht MIT. CC0 ermöglicht die Wiederverwendung und verlangt grundsätzlich keine Namensnennung; Markenrechte werden dadurch nicht übertragen. Deinem ausdrücklichen Wunsch folgend soll KAIROS trotzdem Herkunft, vorhandene Hinweise und Lizenztext bei einer Übernahme mitführen. Quelle: [Sammlungs-Lizenz](https://github.com/mnfst/awesome-free-llm-apis/blob/main/license).

Vorgeschlagener Projektstandard:

1. Für jede Übernahme Repository, Version/Commit, Dateien und eigene Änderungen dokumentieren.
2. Originale Lizenz- und Copyright-Texte unverändert aufbewahren.
3. Hinweise in `THIRD_PARTY_NOTICES.md` und vollständige Texte unter `licenses/` ablegen.
4. Diese Dateien auch im Windows-Installer mitliefern und in „Über KAIROS → Open Source“ zugänglich machen.
5. Für eigenständig umgesetzte Ideen einen Herkunftshinweis führen, ohne eine Quelltextübernahme zu behaupten.

Die Lizenz eines Katalogs regelt dessen Wiederverwendung. Die Nutzung einer darin genannten API richtet sich separat nach deren Vertrag und Datenschutzbedingungen.

## 8. Umsetzungsreihenfolge und Abnahme

**Etappe 1 — Verbindungsschicht.** API-Basispfade, Anbieterprofile, getrennte Modellauswahl und Migration. Pilot mit Groq und OpenRouter sowie einem bestehenden lokalen Modell. Prüfen: korrekte Pfade, ungültige Schlüssel, Modellliste, große Kataloge, Neustart und unveränderte Altprofile. Ein Verbindungstest ruft zunächst nur Modelle ab; ein Generierungstest wird separat ausgelöst.

**Etappe 2 — Verlässlicher Chat.** Streaming, strukturierte Antworten, Modellfähigkeiten, Verbrauch und Quoten. Prüfen: normale Antwort, Ausgabelimit, leere/refusierte Antwort, HTTP 429, lokaler Abbruch und Netzwerkverlust ohne automatischen Doppelauftrag.

**Etappe 3 — Bewusste Auswahl.** Lokal-/Kostenlos-/Budgetregeln, Anbieteranzeige vor Übertragung und ein kleines überprüftes Verzeichnis. Prüfen: kein bezahlter Ersatz im Kostenlosmodus, keine Cloud-Übertragung bei lokalen Projekten, keine Schlüsselweitergabe nach Katalogänderung.

**Etappe 4 — Projekte und Übersicht.** Projektgedächtnis, letzte Arbeiten und verbesserte Auftragskarten auf der vorhandenen Historie. Prüfen: Projekttrennung, sichtbare Herkunft von Erinnerungen, Löschen/Bearbeiten und korrektes Wiederöffnen bestehender Ergebnisse.

**Etappe 5 — Agentenpilot.** Eine begrenzte Diagnoseaufgabe mit festen Werkzeugen, Rechteprüfung und Audit. Prüfen: unerlaubte Ziele, ungültige Argumente, Freigaben, Abbruch und Verhalten nach Neustart. Erst danach schreibende Werkzeuge, Zeitpläne oder Parallelität erweitern.

Für den ersten Meilenstein empfehle ich Etappen 1 und 2 mit einem kleinen Anbieterumfang. Damit werden die von dir gewünschten externen und kostenlosen KI-Anschlüsse konkret nutzbar und bilden eine tragfähige Grundlage für die Herald-Ideen.
