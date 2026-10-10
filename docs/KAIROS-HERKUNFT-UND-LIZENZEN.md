# KAIROS – Herkunft und Lizenznachweise

Stand: 10.10.2026. Herkunftsregister für die Erweiterungen. Aktuell sind 14 Produktionspakete mit ihren vollständigen Originalnachweisen inventarisiert. Der frühere Stand mit 30 Paketen und lazy-val-Nachweislücke ist archiviert; aktueller Stand: [Open-Source-Nachweise](../THIRD_PARTY_NOTICES.md). Das ist keine pauschale Rechteklärung aller bestehenden Assets oder späterer Pakete.

## Bereits erstelltes Material

| Material | Herkunft | Verwendung / Status |
|---|---|---|
| `kairos/assets/hancock.svg` | Eigenständiger SVG-Entwurf in diesem Projekt; Name vom Nutzer gewählt | Statische KAIROS-Figur |
| `kairos/ui/hancock.js`, `hancock-character.css` | Eigenständig erstellte SVG/CSS/JavaScript-Komponente | Produktive Figur und Animationen; keine Coucou-Quelltexte übernommen |
| `kairos/ui/hancock-panel.js` | Eigene Implementierung | Gemeinsamer KAIROS-Schnellchat und Aktionen |
| `kairos/ui/hancock-preview.html` | Eigenständig erstellte Demonstration | Vorschau; keine produktive Chat-/API-Anbindung |
| `kairos/src/api-endpoint.mjs`, `provider-status.mjs`, `response-metadata.mjs`, `kairos/ui/providers.js` | Eigene Implementierung gegen offizielle API-Dokumentation | Anbieterpfade, Zugangsauskunft und Anzeigen; kein SDK oder Fremdcode hinzugefügt |
| `kairos/src/provider-catalog.mjs` | Eigene kurze Sachangaben aus offiziellen Anbieterquellen, Prüfdatum 10.10.2026 | Zwei Angebote mit eigenen Zugängen; kein Import der GitHub-API-Sammlung |

Es werden keine fremden Copyright-Texte für diese eigenen Dateien erfunden. Die Zuordnung einer eigenen Projektlizenz wird bei Bedarf separat festgelegt. Aktuell wurden keine fremden Sounds, Schriften, Pet-Grafiken oder Icons für Hancock übernommen.

## Geprüfte Inspirationsquellen

| Quelle | Gelesene Lizenz | Tatsächliche Übernahme für die Erweiterung |
|---|---|---|
| [Herald-OS](https://github.com/iamlukethedev/Herald-OS) | [MIT](https://github.com/iamlukethedev/Herald-OS/blob/main/LICENSE); zusätzliche [NOTICE](https://github.com/iamlukethedev/Herald-OS/blob/main/NOTICE) | Bisher nur Analyse und Funktionsideen |
| [awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis) | [CC0 1.0](https://github.com/mnfst/awesome-free-llm-apis/blob/main/license) | Bisher Recherche und Links; kein Katalogimport in die App |
| [Coucou](https://github.com/Louis-CFM/coucou) | [MIT für Code](https://github.com/Louis-CFM/coucou/blob/main/LICENSE), separate [Asset-Bedingungen](https://github.com/Louis-CFM/coucou/blob/main/LICENSE-ASSETS.md) | Bisher Funktionsideen; kein Code, Mochi, Icon oder Sound übernommen |

Diese Tabelle betrifft die hier geplanten Erweiterungen. Sie trifft keine pauschale Aussage über sämtliche bestehenden KAIROS-Bibliotheken.

## Verfahren für künftige Übernahmen

Planergänzung 10.10.2026: [KittenTTS / KittenML](https://github.com/KittenML/KittenTTS) wurde als gewünschter TTS-Anschluss bestätigt. Der [SDK-Lizenztext](https://github.com/KittenML/KittenTTS/blob/main/LICENSE) führt Apache-2.0. Noch keine Code-, Modell- oder Stimmenübernahme. Vor Einbau SDK-Version, Modellgewichte, Stimmenpakete, Laufzeit und gegebenenfalls Wrapper einzeln erfassen. Details: [TTS-Plan](KAIROS-TTS-EINFACHE-VERBINDUNG.md).

Die historische `lazy-val`-Lücke kam über `electron-updater`. Trotz Prüfung der Originalpakete und Repository-Historie wurde kein vollständiger Originaltext gefunden. Auf ausdrücklichen Nutzerwunsch wurden beide aus der Laufzeit entfernt und KAIROS 0.5.1 auf portable ZIP mit manuellen Updates umgestellt. Die früheren Metadaten und Nachweise bleiben im Entwicklungsarchiv erhalten. Siehe [Recherche und Portable-Prüfung](KAIROS-LAZY-VAL-NACHWEIS-UND-PORTABLE.md).

Vor dem Einbau erfassen:

1. Projekt/Autor laut Originalquelle, URL, Version oder Commit und Abrufdatum.
2. Konkrete Dateien und Komponenten einschließlich verwendeter Medien und Unterabhängigkeiten.
3. Originale Copyright-Hinweise und vollständige zugehörige Lizenztexte.
4. Eigene Änderungen, Einbauort und vorgesehenes Paket.
5. Besondere Bedingungen oder noch ungeklärte Rechte; ungeklärtes Material bis zur Klärung nicht einbauen.

Bei tatsächlicher Übernahme die vorhandenen `THIRD_PARTY_NOTICES.md` und `licenses/` ergänzen und die Paketprüfung aktualisieren. Die lokale Ansicht liegt unter Einstellungen → Updates → Open Source. Die bloße Erwähnung eines Projekts als Inspiration wird getrennt von einer Code-/Asset-Übernahme erfasst. Die konkrete lazy-val-Nachweislücke wurde im aktuellen Laufzeitpaket durch Entfernung beseitigt; die unveränderten früheren Metadaten und das README sind im Entwicklungsarchiv aufbewahrt.

API-Nutzungsbedingungen, Modelllizenzen und Softwarelizenzen separat behandeln. Eine kostenlose API ist keine generelle Erlaubnis für beliebige Daten oder Nutzung.
