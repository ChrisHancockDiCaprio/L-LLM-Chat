# KAIROS – erste Anbieteranschlüsse

Aktualisierung: Portable 0.5.1 mit manuellen Updates; die frühere lazy-val-Lücke wurde durch Entfernung aus der Laufzeit beseitigt. Siehe [Portable-Prüfbericht](KAIROS-LAZY-VAL-NACHWEIS-UND-PORTABLE.md). Die Angaben unten dokumentieren die vorherige Etappe.

Stand: 10.10.2026, Entwicklungsstand auf Basis 0.5.0. M3 ist teilweise umgesetzt. Kein neues Installationspaket und keine Veröffentlichung.

## Ausprobieren

KAIROS schließen und `kairos/Start-Qwen.cmd` öffnen. Unter Einstellungen → Server & Modelle → Kostenlose KI-Angebote und Anbieter stehen Groq und OpenRouter bereit.

1. „Eigenen Schlüssel erstellen“ öffnet die offizielle Anbieter-Seite. Einen eigenen Zugang erstellen.
2. „Einrichten“ füllt Anbieter, HTTPS-Adresse und API-Pfad aus. Eigenen Schlüssel eintragen; optional gewünschte Modell-IDs, eine pro Zeile.
3. „Server prüfen & Modelle hinzufügen“ liest nur die Modellliste. Neue Modelle sind deaktiviert. Bis zu 3000 Modelle werden gelesen, höchstens 100 Modellprofile gespeichert. Ein späteres Aktualisieren kann weitere Modelle bis zu dieser Grenze ergänzen; bestehende Auswahl bleibt erhalten.
4. Ein gewünschtes Modell aktivieren und für den Chat auswählen. Erst Senden erzeugt eine KI-Anfrage.
5. Bei OpenRouter liest „Eigenen Zugang prüfen“ den dokumentierten GET-Endpunkt. Groq verweist auf sein Dashboard; verfügbare Header-Limits erscheinen zusätzlich nach regulären Chatantworten.

Eigene kompatible Anschlüsse besitzen ein editierbares API-Pfadfeld. Serveradresse enthält nur den Ursprung. Bestehende kompatible Profile behalten `/v1`; Ollama-, Bild-, TTS- und SSH-Verbindungen bleiben erhalten.

## Sicherheits- und Aussagegrenzen

Schlüssel liegen im bestehenden verschlüsselten Tresor und sind an Ursprung, Anbieter und API-Pfad gebunden. Ein geändertes Ziel übernimmt keinen alten Schlüssel. Die offiziellen Voreinstellungen akzeptieren nur ihren festen HTTPS-Ursprung und Pfad. Weiterleitungen werden abgelehnt. Modellimport, Modellprüfung und Zugangsauskunft erzeugen keine Testantwort und keine automatische Synthese.

Katalogangebot, geprüfter eigener Zugang und vorhandenes Modell sind getrennte Informationen. Fehlende Werte bleiben unbekannt; ein gemeldeter Wert von null wird nicht als null Dollar oder null Anfragen interpretiert. Ein numerischer Wert von 0 bleibt sichtbar.

OpenRouter liefert kostenlose Tagesanfragen als Objekt `free_model_daily_requests` mit `used`, `limit`, `remaining`. Die App zeigt nur gültige Zahlen. `limit`/`limit_remaining` außerhalb dieses Objekts sind Schlüssellimits in USD, kein Kontoguthaben. `usage_daily` ist Geldverbrauch und wird nicht in Anfragezahlen umgerechnet. Die Quoten gelten laut Anbieter abhängig von Konto und Anfrageart. Groq-Header geben verbleibende Anfragen pro Tag und Tokens pro Minute an. Die Auskunft enthält ihren Abrufzeitpunkt und bleibt eine Momentaufnahme; sie wird nicht als garantierte Verfügbarkeit verwendet.

Chatantworten speichern gemeldete Tokens, optional den gemeldeten Anbieterbetrag und den Abschlussgrund. Ein fehlender Preis bleibt unbekannt. Dies ist keine Budgetkontrolle oder Preisberechnung. 429 und `Retry-After` zeigen eine Wartezeit; es erfolgt kein automatisches erneutes Senden. Antworten erscheinen weiterhin vollständig nach Abschluss. Bestehende Behandlung abgeschnittener/unvollständiger Antworten bleibt bestehen.

## Prüfung

- Automatisierte Anbieterprüfungen: offizielle Pfade, unsichere Pfade/Zielwechsel, alte Schlüssel-/Auftragsidentitäten, verschlüsselte Migration, 350/3001 Modelle, Profilgrenze und erhaltene Auswahl, GET-Zugangsauskunft, Projektion ohne Kontonamen/Hash, unbekannte Quoten, beide Chat-Endpunkte, numerische Verbrauchs-/Headerprüfung und 429 ohne Wiederholung.
- Vollständige vorhandene Tests einschließlich lokaler SSH-Testserver bestanden. Der erste Lauf in der Netzwerk-Sandbox scheiterte bei fünf SSH-Verbindungstests; der freigegebene Lauf mit lokalen Testservern bestand.
- `npm run verify:providers`: echter isolierter Electron-Ablauf über Formular und begrenzte App-Schnittstelle. Presets, gezielte Modellwahl, deaktivierter Import, Schlüsselzielbindung, Quoten, Verbrauch nach Neustart, Groq-Header, Windows-Verschlüsselung und Renderer-Isolation bestanden. Zwei künstliche Chatantworten, eine künstliche Zugangsauskunft, **keine echten Anbieteranfragen**.
- `npm run verify:hancock`: gemeinsamer Chat, Entwurf, Anhänge, Navigation, ruhiger Zustand, kleine Fenstergröße, Tastatur/Fokus und isolierte Lizenzansicht weiterhin bestanden.

Anbieter-Fenstertest: `.test-output/providers-app-NCL7Qt/Vault/verification-providers.json`; Screenshot daneben. Hancock-Fenstertest: `.test-output/hancock-app-0Oo9S5/Vault/verification-hancock.json`. Die normalen Benutzertresore wurden nicht als Testdaten verwendet. Paketprüfung um neue Dateien ergänzt; kein neuer Installer gebaut oder geprüft.

## Herkunft und verbleibende Arbeit

Eigene Implementierung ohne neue Laufzeitabhängigkeit, kopierten Fremdcode oder importierte GitHub-Katalogdaten. Originale Copyright-/Lizenznachweise bleiben erhalten. Die bestehende vollständige Lizenztext-Lücke bei `lazy-val` 1.0.5 ist weiterhin offen und vor Veröffentlichung zu klären; siehe [Herkunft und Lizenzen](KAIROS-HERKUNFT-UND-LIZENZEN.md).

Noch offen: Live-Piloten mit eigenen Schlüsseln, Streaming, modellabhängige Parameter, Modellpreise und sichere Regeln „Nur lokal / Nur kostenlos / Mit Budget“, Ersatzmodelle, Katalogaktualisierung, weitere Anbieter und die geplante einfache KittenTTS-Verbindung. Die bestätigte TTS-Planung bleibt erhalten; KittenTTS ist noch nicht installiert oder angebunden.

Grundlagen: [Groq-Kompatibilität](https://console.groq.com/docs/openai), [Groq-Limits](https://console.groq.com/docs/rate-limits), [OpenRouter-Limits und Zugangsauskunft](https://openrouter.ai/docs/api-reference/limits), [OpenRouter-API](https://openrouter.ai/docs/api-reference/overview). Katalog-Prüfdatum: 10.10.2026. Spätere Änderungen der Anbieterbedingungen benötigen eine erneute Prüfung.
