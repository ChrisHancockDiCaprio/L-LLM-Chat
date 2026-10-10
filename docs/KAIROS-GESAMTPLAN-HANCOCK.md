# KAIROS mit Hancock – Gesamtplanung

Stand: 10.10.2026. Vom Nutzer gewählte Richtung: eigene KAIROS-Figur **Hancock**, aufklappbarer Schnellzugriff, Chat und Aktionsauswahl, mehrere KI-Anbieter und kostenlose Angebote, später Projekte und begrenzte Agentenfunktionen. Sicherheit und Herkunftsnachweise gelten auch für die private Nutzung.

## 1. Stand und Zielbild

**Umsetzung 10.10.2026:** M0–M2 sind im Entwicklungsstand eingebaut und geprüft. Siehe [Hancock-Prüfbericht](KAIROS-HANCOCK-PRUEFBERICHT.md). M3 ist teilweise umgesetzt: sichere Anbieterpfade, Groq/OpenRouter-Voreinstellungen, eigener Angebotskatalog, Zugangsauskunft und Antwortverbrauch. Siehe [Anbieter-Prüfbericht](KAIROS-ANBIETER-PRUEFBERICHT.md). Streaming, Kostenregeln, TTS-Erweiterung und M4–M7 bleiben offen. Zusätzliche Nutzerentscheidung: Portable 0.5.1 mit manuellen Updates; automatischer Updater und lazy-val entfernt. [Portable-Prüfbericht](KAIROS-LAZY-VAL-NACHWEIS-UND-PORTABLE.md). Keine Veröffentlichung.

Bereits vorhanden: KAIROS 0.5.0 mit Chat, Modellprofilen, verschlüsseltem Tresor, Bildfunktionen, Sprachstudio, SSH-Tunneln und Generierungsaufträgen. Hancock und erste Anbietererweiterungen sind zusätzlich im Entwicklungsstand eingebaut. Desktop-Begleiter und Agentenmodus sind noch nicht implementiert.

Hancock sitzt klein am unteren Rand des KAIROS-Fensters. Ein Klick vergrößert ihn und öffnet eine Karte mit „Was liegt an?“, Eingabe und vier Aktionen: **Chatten, Bild erstellen, Vorlesen, Aufgaben**. Die Karte verwendet dieselben Gespräche und Aufträge wie die große Ansicht. „Groß öffnen“ bringt den Nutzer an die passende Stelle. Später kann Hancock auf Wunsch außerhalb der App auf dem Desktop sitzen.

Die Figur dient als Zugang und Statusanzeige. Atmen, Blinzeln, Blickbewegungen und kurze Reaktionen benötigen keine KI-Aufrufe.

## 2. Verbindliche Produktentscheidungen

| Bereich | Geplantes Verhalten |
|---|---|
| Grundposition | Unten rechts innerhalb von KAIROS; Abstand zu Eingabefeld und Bedienelementen |
| Bewegung | Kurze Begrüßung und Freude; während Lesen oder Eingabe ruhig |
| Anklicken | Figur wird größer, Karte öffnet sich; wiederholter Klick schließt sie |
| Schnellchat | Zeigt Gespräch und Zielanbieter; Nachrichten landen im bestehenden Verlauf |
| Vollansicht | Derselbe Chat, derselbe Auftrag und dieselbe Abbruchsteuerung |
| Aktionen | Nur implementierte Funktionen starten; fehlende Einrichtung wird verständlich erklärt |
| Dateiablage | Bereitet einen geprüften Anhang vor; Senden bleibt ein eigener Schritt |
| Warten | Zeigt „Wartet auf Antwort“; keine Behauptung einer bestätigten Serverberechnung |
| Fertigstellung | Ein kurzer Hinweis pro Ergebnis; Klick öffnet das Ergebnis |
| Fehler | Text mit nächstem sinnvollen Schritt; keine automatische Wiederholung bei unbekanntem Ausgang |
| Entscheidungen | Konkrete Frage mit Ziel und Auswirkung; bloßer Pet-Klick erteilt keine Freigabe |
| Ruhemodus | Bewegung pausieren, Hinweise leise stellen und Figur ausblenden |
| Sprache | Erst später Spracheingabe; Mikrofon nur nach bewusstem Start |
| Desktop-Modus | Optional und zunächst aus; KAIROS bleibt der gemeinsame Daten- und Auftragsinhaber |

Beim ersten Schnellchat wird entweder ein neues Gespräch geöffnet oder das angezeigte aktuelle Gespräch verwendet. Der gewählte Kontext ist sichtbar. Hancock greift nicht unbemerkt auf ein anderes Projekt oder Gespräch zurück.

„Aufgaben“ führt anfangs zu vorhandenen Generierungsaufträgen. Mehrstufige Skills erscheinen erst mit ihrer tatsächlichen Implementierung. Ein Sprachmodell allein liefert keinen Zugriff auf Dateien, Programme oder Server.

## 3. Technischer Aufbau

```text
Hancock-Karte / großer Chat / späteres Desktop-Fenster
                       |
          begrenzte, validierte App-Schnittstelle
                       |
            KAIROS-Hauptprozess
           /          |             \
 Gespräche/Tresor  Auftragsdienst  Aktions-/Rechteprüfung
                       |
              Anbieteradapter
           /          |             \
      Ollama     externe APIs    optional LiteLLM
```

Der Hauptprozess hält die maßgeblichen Zustände. Alle Ansichten erhalten nur benötigte Ausschnitte. Das Desktop-Fenster bekommt keinen eigenen Tresor und keine unabhängige Anfragepipeline.

Geplante Bausteine:

- `ui/hancock.js`: vorhandene Figur; Animation und Klickereignis.
- Eigene Kartenansicht für Eingabe, Aktion, Anhangsvorschau und Status; produktive Skripte/Stile als lokale Dateien unter der bestehenden Content Security Policy.
- Gemeinsamer Chat-/Navigationsablauf mit Gesprächs-ID und Nachrichten-ID.
- Ereignisse mit Auftrags-ID, Revision, Zustand und Ergebnisverweis; verspätete Ereignisse dürfen einen neueren Zustand nicht überschreiben.
- Aktionsverzeichnis mit ID, Anzeigename, Voraussetzungen, benötigten Fähigkeiten und Daten-/Rechteumfang.
- Einstellungen für Figur, Größe, Ruhemodus und Position in der bestehenden verschlüsselten Einstellungsverwaltung.
- Später ein eigener Fenstercontroller für den Desktop-Begleiter mit schmaler Preload-Schnittstelle.

Die erste Ausbaustufe übernimmt KAIROS' Grenze von einer aktiven Generierung. Ein zweiter Auftrag wartet oder wird klar abgelehnt. Parallelität wird erst mit getrennten Abbruchcontrollern, Quoten und eindeutigem Ergebnisrouting ergänzt.

## 4. Umsetzungsreihenfolge

### M0 – Ausgangsstand und Herkunft erfassen

- [x] Vorhandene Test- und Verifikationsbefehle auf ihren aktuellen Stand prüfen.
- [x] Isoliertes Testprofil für UI, Tresormigration und künstliche Anbieter verwenden.
- [x] Wiederherstellung vor Profil-/Tresoränderungen dokumentieren; verschlüsselte Sicherungen nicht mit einer portablen Sicherung gleichsetzen.
- [x] Hancock-Dateien und Inspirationsquellen im Herkunftsregister erfassen.
- [x] Abhängigkeiten und bestehende Lizenzdateien vor Paketänderungen inventarisieren.

Abnahme: Ausgangsfehler und bisher funktionierende Abläufe sind dokumentiert; Original-Benutzerdaten werden nicht als Testmaterial benutzt.

### M1 – Hancock innerhalb von KAIROS

- [x] Figur am Fensterrand einbauen; zunächst ohne Desktop-Fenster.
- [x] Öffnen, Schließen, Vergrößern und Tastaturbedienung umsetzen.
- [x] Aktionskarte mit vier Einstiegspunkten bauen; Status der Einrichtung anzeigen.
- [x] Bereitschaft, Warten, Fertigstellung und Fehler an echte App-Ereignisse binden.
- [x] Einstellungen für Sichtbarkeit und reduzierte Bewegung ergänzen.
- [x] Karte bei kleiner Fenstergröße so positionieren, dass sie bedienbar bleibt.

Abnahme: Hancock verdeckt keine wesentlichen Steuerelemente, stiehlt während des Tippens keinen Fokus und zeigt keine erfundenen Statusmeldungen. „Entscheidung erforderlich“ wird nur bei einer vorhandenen Frage aktiviert.

### M2 – Schnellchat, Bilder und Vorlesen

- [x] Schnellchat mit Gesprächsauswahl, Modell-/Anbieteranzeige und bestehendem Verlauf verbinden.
- [x] Senden und Abbrechen über denselben Ablauf wie in der großen Ansicht führen.
- [x] „Groß öffnen“ navigiert zum richtigen Gespräch oder Studio-Auftrag.
- [x] „Bild erstellen“ verwendet bestehende Bildprofile und deren Parameter.
- [x] „Vorlesen“ verwendet vorhandene TTS-Verbindungen; bei fehlender Einrichtung zum Sprachstudio führen.
- [x] Datei-Drop durch vorhandene Anhangsprüfung führen; unterstützte Typen und Grenzen beibehalten.
- [x] Fertigmeldungen einmal pro Auftrag anzeigen; keine Chattexte auf dem Desktop nötig.

Abnahme: Kleine und große Ansicht zeigen dasselbe Ergebnis. Doppelklick oder Fensterwechsel erzeugen keinen Doppelauftrag. Kein Text wird allein durch Öffnen der Karte, Hover oder Dateiablage übertragen.

### M3 – KI-Anbieter, Streaming und kostenlose Angebote

- [x] API-Ursprung und Basispfad sauber trennen; bestehende Profile sicher migrieren.
- [x] Groq und OpenRouter als erste externe Anschlüsse umsetzen; lokales Modell als Vergleich erhalten. Isolierte Tests bestanden, Live-Pilot mit eigenen Zugangsdaten noch offen.
- [ ] Antwortformat, Streaming, Abbruch, Verbrauch und Abschlussgrund vereinheitlichen.
- [ ] Fähigkeiten pro Modell anzeigen; nicht unterstützte Parameter vermeiden.
- [x] Kleinen Anbieterkatalog mit Prüfdatum und offiziellen Registrierungslinks ergänzen. Automatische Aktualisierung und Modellpreise bleiben offen.
- [x] Eigenen Schlüssel prüfen und Restkontingente auswerten, soweit dokumentiert verfügbar.
- [ ] Regeln „Nur lokal“, „Nur kostenlos“, „Mit Budget“ und manuelle Auswahl implementieren.
- [ ] Ersatzmodelle nur entsprechend einer gespeicherten Regel; Datenfreigabe und Kostenklasse dabei erneut prüfen.
- [ ] Weitere Anbieter und optional LiteLLM anschließend einzeln freigeben.

Abnahme: Geheimnisse bleiben an ihr Ziel gebunden. Veraltete Katalogdaten ändern keine Zugangsdaten oder aktive Auswahl. Unbekannter Preis ist im Kostenlosmodus ausgeschlossen. Abrechenbare Zusatzfunktionen werden berücksichtigt; ein lokaler Kostenzähler wird als Schätzung gekennzeichnet.

Die Details aus Etappen 1–4 des [bisherigen Plans](KAIROS-UMSETZUNGSPLAN.md) gelten weiter. Nach M1 kann M3 unabhängig von den restlichen Schnellaktionen bearbeitet werden; für die normale Umsetzung wird ein Meilenstein nach dem anderen abgeschlossen.

### M3-TTS – Einfach verbinden und KittenTTS

Nutzerergänzung vom 10.10.2026: TTS-Anschlüsse sollen sich einfach einrichten lassen. „KittyTTS“ wurde als **KittenTTS von KittenML** bestätigt. Details, Architektur und Abnahme: [Einfache TTS-Verbindung](KAIROS-TTS-EINFACHE-VERBINDUNG.md).

- [ ] Anbieter wählen → Adresse/Zugang → Verbindung prüfen → Stimmen laden → speichern als gemeinsamen einfachen Einrichtungsablauf anbieten.
- [ ] KittenTTS zuerst lokal oder auf einem eigenen Server anbinden; eigene begrenzte Brücke zum geprüften SDK statt angenommener HTTP-/OpenAI-Kompatibilität.
- [ ] Modell, Version, Sprachen und tatsächlich unterstützte Parameter prüfen; deutsche Ausgabe auf dem konkreten Modell testen.
- [ ] Hörbeispiel bewusst starten; der Verbindungscheck erzeugt keine Synthese. Gespeicherte Verbindung bei Neustart wieder laden.
- [ ] Hancock mit Einrichtung und gezielter Übernahme eines Chattexts zum Vorlesen verbinden; keine automatische Übertragung oder Wiedergabe.
- [ ] SDK, Modellgewichte, Stimmen und Laufzeit separat lizenzieren/inventarisieren; bestehende TTS-Verbindungen erhalten.

Abnahme: Einmal eingerichtet funktioniert Text → Stimme → Vorlesen. Kein automatischer Cloudwechsel, kein ungeprüfter Download/Startbefehl und keine neue Freigabe für das Mikrofon. Diese Etappe kommt vor M7; Sprachausgabe wartet nicht auf Spracheingabe.

### M4 – Freier Desktop-Begleiter

- [ ] Separates kleines Electron-Fenster mit optionaler Statuskarte ergänzen.
- [ ] Aktivieren, Verschieben, Position speichern und zum App-Fenster zurückkehren umsetzen.
- [ ] DPI-Skalierung, mehrere Monitore und entfernte Displays behandeln.
- [ ] Klickbereiche so begrenzen, dass unsichtbare Fensterteile keine Eingaben blockieren.
- [ ] Vollbild-/Ruhemodus berücksichtigen; kein Fokuswechsel durch automatische Hinweise.
- [ ] Bei Windows-Sperre Karte und sensible Inhalte verbergen; lokale Zustände danach synchronisieren.
- [ ] Tray, Fenster schließen und App beenden eindeutig gestalten. Hintergrundbetrieb bewusst aktivieren.

Abnahme: Keine unsichtbare Eingabeblockade, kein verwaistes Fenster, keine doppelte Netzwerkpipeline und keine Benachrichtigung mit vertraulichem Gesprächsinhalt als Standard.

### M5 – Projekte, Gedächtnis und Aktionen

- [ ] Projekte mit Gesprächen, freigegebenen Dateien und erlaubten Anbietern verbinden.
- [ ] Erinnerungen mit Quelle, Zeitpunkt, Bestätigung und Bearbeiten/Löschen umsetzen.
- [ ] „Hier weitermachen“ und vorhandene Ergebnisse anbieten.
- [ ] Aktionsauswahl erweitern: beispielsweise „Text zusammenfassen“ oder „Datei erklären“ innerhalb tatsächlich unterstützter Dateitypen.
- [ ] Mehrstufige Aufträge mit Ziel, Schritten, Modell, Ergebnis und Freigaben abbilden.
- [ ] Lösch- und Aufbewahrungsregeln für Verlauf, Anhänge, Erinnerungen und verschlüsselte Update-Sicherungen erklären.

Abnahme: Kein Kontextwechsel ohne sichtbares Projekt/Gespräch. Erinnerungen sind überprüfbar und löschbar. Quellenmaterial wird als Inhalt behandelt und erteilt keine neuen Rechte.

### M6 – Begrenzter Agentenmodus und Automationen

- [ ] Zunächst freigegebene Diagnosedaten lesen und Bericht erstellen.
- [ ] Werkzeugrollen und Tool Calling ergänzen; feste Werkzeuge mit validiertem Schema.
- [ ] Rechte pro Ziel und Aktion prüfen; lokales Lesen und externe Übermittlung getrennt freigeben.
- [ ] Ändernde Schritte mit verständlicher Vorschau, Auswirkungen und Wiederherstellung versehen.
- [ ] Nutzerentscheidung an konkrete Auftrags-/Aktions-ID und unveränderte Parameter binden.
- [ ] Ausstehende Freigaben nach Ablauf/Neustart verwerfen oder neu anfordern.
- [ ] Später Zeitpläne mit festen Grenzen für Laufzeit, Daten, Kosten und Parallelität ergänzen.
- [ ] Externe Agentenadapter erst danach; vorhandene Agentenkonfigurationen nur gezielt und mit Wiederherstellung ändern.

Abnahme: Ein Modell kann nur implementierte, erlaubte Werkzeuge nutzen. Keine pauschale Shell-/Administratorfreigabe. Scheitert die Rechteprüfung, wird die Aktion nicht ausgeführt. Automationen können pausiert werden und erzeugen bei Neustart keine unbeabsichtigte Wiederholung.

### M7 – Sprache und optionale weitere Oberflächen

- [ ] Spracheingabe mit sichtbarem Mikrofonzustand und bewusstem Start ergänzen.
- [ ] Lokal-/Cloud-Spracherkennung als Datenentscheidung anzeigen.
- [ ] Erkannte Eingabe vor dem Senden korrigierbar machen; keine Sprachfreigabe für kritische Aktionen im ersten Schritt.
- [ ] Eigene Sounds bei Bedarf mit Herkunftsnachweis erstellen oder lizenzieren.
- [ ] Mobile Oberfläche oder entfernte Freigaben separat entwerfen: Anmeldung, Gerätebindung, verschlüsselter Transport, Ablauf und Wiederholungsschutz.

Abnahme: Das Mikrofon ist ohne gestartete Aufnahme aus. Mobile Freigaben werden erst nach eigenem Sicherheitsentwurf umgesetzt. Der iPhone-/CloudKit-Weg von Coucou wird nicht als fertige KAIROS-Windows-Lösung vorausgesetzt.

## 5. Sicherheit als Abnahmekriterium

### Oberfläche und Fenster

Alle produktiven Ansichten laden lokale App-Dateien. Node-Zugriff bleibt deaktiviert, Kontextisolation aktiv; neue Fenster erhalten die passenden Sandbox- und CSP-Einstellungen. Eine schmale Preload-Schnittstelle erlaubt konkrete Aktionen statt beliebiger Dateipfade oder Befehle. Der Hauptprozess prüft Absender, Argumente, IDs und Berechtigungen jedes IPC-Aufrufs. Neue Webfenster und Navigation werden kontrolliert; externe Links werden nur nach Prüfung zulässiger Protokolle geöffnet.

Modellantworten und Dateiinhalte werden sicher gerendert. Die Hancock-Vorschau ist kein Produktionsfenster: ihre Beispielzustände und Inline-Demoskripte werden nicht unverändert in die App übernommen. Grundlage: [Electron-Sicherheitsdokumentation](https://www.electronjs.org/docs/latest/tutorial/security).

### Daten und Netzwerk

- Vorhandenen DPAPI-Tresor verwenden; Geheimnisse nicht in Hancock-Fenster oder Modellkontext geben.
- Keine Abschaltung der TLS-Prüfung, keine Schlüsselweitergabe über Weiterleitungen.
- Bestehende begrenzte HTTP-/SSH-Ausnahmen getrennt vom neuen Cloud-Anschluss erhalten; die verbindliche Ausnahme ist der tatsächlich geprüfte Tunnel, nicht ein bloß aktiviertes Kästchen.
- Katalogdaten nach Schema und Größe prüfen. Anbieter-/Pfadänderungen benötigen erneute Zielprüfung; sie übernehmen keine alten Schlüssel automatisch.
- Anhänge nach Größe und tatsächlichem Inhalt prüfen; keine Dateien ausführen. Neue PDF-/Office-Funktionen nur mit eigenem Parser-/Sicherheitsentwurf.
- Keine automatische Bildschirmaufnahme, Zwischenablageüberwachung, Mikrofonaufnahme oder Volltextsuche über das gesamte Gerät.
- Logs auf technische Zustände und Entscheidungen begrenzen; keine Geheimnisse oder unnötigen Benutzerinhalte.

DPAPI schützt gespeicherte Daten im Rahmen des Windows-Kontos. Es schützt nicht vor Schadsoftware unter demselben Konto und ersetzt keine eigene Sitzungssperre. Hancock macht aus diesem bestehenden Schutz keine neue Sicherheitsgarantie.

### Werkzeuge und Kosten

Dateien, Suchergebnisse und Modellantworten gelten als untrusted Inhalt. Sie dürfen keine Ziele, Rechte, Kostenregeln oder Freigaben verändern. Dateiwerkzeuge prüfen aufgelöste Pfade und Verknüpfungen gegen erlaubte Bereiche. Serverwerkzeuge besitzen begrenzte Konten und feste Aufgaben.

Eine freigegebene Aktion wird exakt ausgeführt oder bei veränderten Parametern neu bewertet. Bei Timeout und unbekanntem Ergebnis erfolgt keine blinde Wiederholung. Harte Ausgabenlimits nach Möglichkeit auch beim Anbieter/Gateway setzen; clientseitige Schätzungen allein verhindern nicht jede Abrechnung.

## 6. Copyright und Herkunft

Für jede verwendete Datei, Bibliothek, Schrift, Grafik und jeden Sound erfassen wir Quelle, Version/Commit, Lizenz, vorhandenen Copyright-Text, Änderungen und Verwendung. Lizenztexte und Hinweise werden bereits während der privaten Entwicklung aufbewahrt und bei Paketierung mitgeliefert. Dafür gibt es ein [Herkunftsregister](KAIROS-HERKUNFT-UND-LIZENZEN.md).

Hancock verwendet eigene Formen und Animationen. Coucous Figur, Namen, Icons und Sounds werden nicht in KAIROS übernommen. Coucous Asset-Lizenz erlaubt den privaten Betrieb des Originalprojekts, enthält aber eigene Beschränkungen für Weitergabe und kommerzielle Verwendung. Unsere eigene Figur vermeidet diese Asset-Abhängigkeit. Quelle: [Coucou Asset-Lizenz](https://github.com/Louis-CFM/coucou/blob/main/LICENSE-ASSETS.md).

Bei späteren MIT-Codeübernahmen bleiben Copyright und vollständige MIT-Lizenz erhalten; Unterkomponenten werden separat geprüft. Die API-Sammlung ist CC0; auf Nutzerwunsch führen wir trotzdem Quelle und Lizenztext mit. Quellen: [Herald MIT](https://github.com/iamlukethedev/Herald-OS/blob/main/LICENSE), [API-Sammlung CC0](https://github.com/mnfst/awesome-free-llm-apis/blob/main/license).

Eine Erwähnung als Inspiration ist keine Behauptung, dass fremder Code eingebaut wurde. Der Dateiname oder eine Root-Lizenz beweist nicht die Lizenz sämtlicher Assets. Eigene Projektlizenz und eventuelle spätere Veröffentlichung werden gesondert festgelegt; hier wird keine Lizenz oder fremde Urheberschaft erfunden.

**Historische Lücke: lazy-val 1.0.5.** Die Bibliothek kam über `electron-updater`; beide sind aus der aktuellen Laufzeit entfernt. Die originalen Paketmetadaten nennen MIT und Vladimir Krivosheev, aber es fehlt der vollständige Original-Lizenztext. Metadaten und README sind aufbewahrt. Kein festgestellter Sicherheitsfehler; die konkrete Nachweislücke wird durch Entfernung aus dem Paket geschlossen. Siehe [Originalmetadaten](https://github.com/develar/lazy-val/blob/master/package.json).

- [x] Originalpakete und alle acht Repository-Stände geprüft; kein vollständiger Originaltext gefunden. Keine Kontaktaufnahme erfolgt.
- [x] Nutzeralternative umgesetzt: electron-updater entfernen, portable Ausgabe und eigene reine Release-Prüfung einbauen.
- [x] Laufzeitkette neu inventarisiert; vollständige aktuelle Originaltexte vorhanden. Historische Nachweise im Entwicklungsarchiv erhalten. Updates werden auf Nutzerwunsch manuell heruntergeladen.
- [x] Betroffene Abhängigkeit aus dem aktuellen Laufzeitpaket entfernen; tatsächlichen Paketinhalt separat prüfen. Kein Lizenztext erfunden.

API-Verträge sind von Quellcodelizenzen getrennt. Kosten, regionale Bedingungen, Datenverarbeitung und Einschränkungen werden vor Freigabe eines Anschlusses beim Anbieter geprüft, auch bei privater Nutzung.

## 7. Prüfung und Auslieferung

Jeder Meilenstein erhält die für seine Änderungen relevanten Tests und einen kurzen Prüfbericht. Für UI-Details genügt eine gezielte Sicht-/Bedienprüfung; Netzwerk, Migration und Rechte bekommen automatisierte Fehlerfallprüfungen.

| Bereich | Wesentliche Prüfung |
|---|---|
| Hancock-Karte | Tastatur, Fokus, kleine Fenster, reduzierte Bewegung, Schließen ohne Datenverlust |
| Gemeinsamer Chat | Gleiche IDs und Ergebnisse, kein Doppelsenden, Abbruch und Fensterwechsel |
| Tresor/Migration | Neustart, beschädigte Daten, unterbrochenes Schreiben, erhaltene Altprofile |
| Anbieter | Richtige Pfade, ungültige Schlüssel, 429, Streamingabbruch, Größenlimits |
| Desktop | Mehrere Displays/DPI, Vollbild, Sperre, Tray und Beenden |
| Rechte | Unzulässige IPC-Absender, ungültige Argumente, fremde IDs, verbotene Pfade |
| Aktionen | Vorschau, passende Freigabe, veränderte Parameter, Timeout, Wiederholungsschutz |
| Lizenznachweise | Tatsächliche Übernahmen, vollständige Texte, Paketinhalt und About-Ansicht |

Live-Tests mit echten Anbietern werden als solche dokumentiert und verwenden nur eingerichtete eigene Zugänge. Fehlende Zugänge blockieren keinen lokalen Prototyp; der Anschluss bleibt bis zum tatsächlichen Test als nicht live geprüft gekennzeichnet.

Updates benötigen nachvollziehbare Herkunft. Ab 0.5.1 gilt auf Nutzerwunsch eine reine Release-Prüfung ohne Programmdownload oder Installerstart. Die portable ZIP wird selbst heruntergeladen und manuell gewechselt; die Quelle und Lizenznachweise sind sichtbar. Rollback muss zur Datenversion passen; ein altes Programm darf einen migrierten Tresor nicht beschädigen.

## 8. Erster Lieferumfang und nächster Schritt

**Erster Lieferumfang: M0 bis M2.** Hancock sitzt im App-Fenster, öffnet die Karte, nutzt vorhandene Chats/Bilder/TTS und zeigt echte Statusmeldungen. Damit ist der neue Bedienablauf ohne neue Anbieter oder Werkzeuge bereits nützlich.

Danach folgen M3 für Anbieter und kostenlose Angebote, M3-TTS für einfache Sprachverbindungen einschließlich KittenTTS sowie M4 für den Desktop-Modus. Projekte und selbstständige Aktionen kommen mit M5/M6. Spracheingabe und Mobilfunktionen folgen separat.

Nächster Lieferumfang: M3 um Streaming und sichere Kostenregeln ergänzen; Anbieterpfade, Zielbindung und erste kostenlose Angebote sind eingebaut. Die verbleibenden Meilensteine sind noch nicht umgesetzt.
