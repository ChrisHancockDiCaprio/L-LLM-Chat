# KAIROS – einfache TTS-Verbindungen und KittenTTS

Planergänzung vom 10.10.2026. Der Nutzer hat bestätigt: Mit „KittyTTS“ ist **KittenTTS von KittenML** gemeint. Diese Datei beschreibt geplante Funktionen; KittenTTS ist noch nicht installiert oder angebunden.

## Ziel und Bedienung

Auch Sprachmodelle sollen sich einfach verbinden lassen. Kein ausgewähltes Chatmodell ist dafür erforderlich. Einstellungen → TTS → „Verbindung hinzufügen“ führt durch:

1. Anbieter wählen: bestehendes Qwen, Azure Speech, Azure Foundry oder künftig KittenTTS.
2. Betriebsart wählen: lokal auf dem Rechner oder eigener Server. Cloud nur als gesonderter Anschluss nach Prüfung der offiziellen API.
3. Serveradresse eintragen; erforderlichen Zugang hinterlegen. Bei lokalem KittenTTS erzeugt die Einrichtung gegebenenfalls ein lokales Zugriffstoken statt eines gekauften Cloud-Schlüssels.
4. „Verbindung prüfen“ fragt Gesundheitszustand und tatsächlich bereitgestellte Modelle/Stimmen ab. Keine automatische Sprachgenerierung oder kostenpflichtige Probe.
5. Stimme wählen und speichern. Ein bewusst gestartetes kurzes Hörbeispiel prüft anschließend Sprache und Klang.

Für Azure bleiben die tatsächlich nötigen Ressourcen-/Deployment-Angaben sichtbar. Einfachere Bedienung darf keine erforderlichen Einstellungen durch Vermutungen ersetzen. Für Dienste ohne Stimmen-/Modellliste verwendet der Adapter überprüfte Vorgaben und erklärt diese Grenze.

Danach genügt im Sprachstudio: Text → Stimme → Vorlesen. Die letzte gültige Verbindung bleibt verschlüsselt gespeichert und kann beim nächsten Öffnen wieder geladen werden. Ein Offline-Dienst wird als offline angezeigt; kein automatischer Wechsel in eine Cloudverbindung.

Hancocks „Vorlesen“ öffnet dieses Sprachstudio. Bei noch fehlender Verbindung führt ein Einrichtungshinweis direkt zu TTS. Chat-Antworten oder ausgewählter Text werden erst nach bewusstem „Zum Vorlesen übernehmen“ in den Sprachentwurf kopiert. Generierung und Wiedergabe starten getrennt und erfordern weiterhin eine Nutzeraktion. Nur der gewählte Text wird verwendet, kein gesamter Chatverlauf.

## KittenTTS: konkrete erste Ausbaustufe

Wir verwenden das [offizielle KittenML-Projekt](https://github.com/KittenML/KittenTTS), keine ungeprüften Forks oder fremden Downloadarchive. Die aktuelle Dokumentation beschreibt KittenTTS 2 mit CPU-Betrieb und unter anderem Deutsch; daneben bestehen kleinere ONNX-Modelle aus Version 0.8. Sprachumfang, Ressourcenbedarf und Schnittstellen werden für die konkret gewählte Version separat geprüft. Die alten kleinen Modelle werden nicht pauschal als deutschsprachig freigegeben.

Die Bibliothek stellt Python-Aufrufe bereit. Für KAIROS planen wir eine eigene schmale Serverbrücke nach dem Muster der vorhandenen Qwen-Brücke. Sie übersetzt zwischen dem KAIROS-TTS-Adapter und dem geprüften offiziellen SDK. Ein laufendes KittenTTS-Python-Modell ist nicht automatisch eine HTTP-API und nicht automatisch OpenAI-kompatibel.

Erster Umfang: Text, gemeldete Stimme, unterstützte Sprache, Geschwindigkeit soweit verfügbar, WAV-Ausgabe, Vorschau, Export und Abbruch des lokalen Wartens. Kein SSML, Klonen, Emotions-Markup oder Streaming allein aufgrund des Modellnamens freischalten. Solche Fähigkeiten kommen erst nach eigener Implementierung und Prüfung. Für Deutsch wird ein kurzer deutscher Referenztext auf dem tatsächlichen Modell geprüft; Klang und Geschwindigkeit werden gemessen, nicht aus Werbeaussagen abgeleitet.

Die eigene Brücke liefert begrenzte Gesundheits-/Fähigkeits-/Stimmeninformationen und eine feste Syntheseaktion. Sie meldet Modell-ID, SDK-Version und ihre eigene Protokollversion. KAIROS prüft den Typ und die Version dieser Antwort, statt fremde Skripte, URL-Vorgaben oder Startbefehle auszuführen. Für einen bereits vorhandenen Server wird dessen konkrete API einmal geprüft und einem festen Adapter zugeordnet.

## Sicherheit, Installation und Daten

- Brücke zunächst nur auf Loopback erreichbar; dediziertes Zugriffstoken, keine offene öffentliche Synthese-API. Andere lokale Programme werden nicht automatisch als vertrauenswürdig betrachtet.
- Auf dem eigenen entfernten Server: HTTPS oder ein tatsächlich geprüfter SSH-Tunnel. Ein fremder TTS-Dienst erhält den übermittelten Text; die Oberfläche zeigt das Ziel vor Generierung.
- Tokens im vorhandenen Tresor, an den geprüften Anschluss gebunden; keine Schlüssel im Renderer, Chatkontext, Beispielcode oder Log. Geänderte Ziele übernehmen vorhandene Schlüssel nicht automatisch.
- Feste Anfragen und begrenzte Text-/Audiogrößen; Audioformat und Inhalt prüfen. Keine Redirects mit Zugangsdaten und keine automatischen Wiederholungen bei unklarem Ausgang.
- Abbrechen stoppt lokales Warten. Ein bestätigter serverseitiger Abbruch wird nur angezeigt, wenn die Brücke ihn tatsächlich unterstützt und bestätigt.
- Modelle und Laufzeit bewusst einrichten, Versionen und Herkunft festhalten, Downloads vor Verwendung prüfen. Kein automatisches Installieren oder Ausführen beim Eintragen einer Adresse. Betrieb in eigener Python-Umgebung; bestehende Qwen-/Azure-Verbindungen erhalten.
- Nach erfolgtem Modell-Download prüfen, welche Bibliotheksaufrufe beim Start weitere Netzverbindungen brauchen. „Offline“ erst anzeigen, wenn die getestete Konfiguration ohne externe Dienste arbeitet.
- Stimme/Klonen später gesondert: Referenzaudio, Berechtigung zur Verwendung und Aufbewahrung sichtbar machen. Keine automatische Stimmaufnahme.

## Lizenzen und Herkunft

Der [offizielle SDK-Code](https://github.com/KittenML/KittenTTS/blob/main/LICENSE) führt Apache-2.0. Vor Übernahme die Original-Lizenz und vorhandene Copyright-/NOTICE-Texte der festgelegten Version aufbewahren; Änderungen dokumentieren. Modellgewichte, Stimmenpakete, Laufzeitbibliotheken und eventuell genutzte Serverwrapper werden separat inventarisiert. Die SDK-Lizenz allein bestätigt nicht alle Rechte dieser Komponenten. Cloudbedingungen sind nochmals separat zu prüfen.

KittenTTS ist bisher ausschließlich eine geprüfte Planungsquelle. Es wurden weder fremder Code noch Modellgewichte übernommen, nichts installiert und kein Cloudkonto eingerichtet.

## Umsetzung und Abnahme

- [ ] Gemeinsame einfache TTS-Verbindungseinrichtung entwerfen; vorhandene Qwen-/Azure-Anschlüsse behalten.
- [ ] KittenTTS-Version und Modell wählen; SDK-, Modell-, Stimmen- und Laufzeitnachweise erfassen.
- [ ] Eigene lokale Brücke und festen KittenTTS-Adapter mit Fähigkeiten-/Versionsprüfung bauen.
- [ ] Verbindung, Stimmen und Sprache laden; geprüfte Konfiguration verschlüsselt speichern und wiederherstellen.
- [ ] Bewusstes Hörbeispiel, WAV-Prüfung, Vorschau, Export und eindeutige Abbruchanzeige ergänzen.
- [ ] Hancock-Einstieg und gezielte Übernahme von Chattext verbinden.
- [ ] Fehlerfälle prüfen: offline, falscher Dienst, ungültiger Zugang, abweichende Version, ungültiges Audio, Größenlimits, Neustart und paralleler Chat.
- [ ] Deutsch und Laufzeit auf der vorgesehenen Maschine tatsächlich testen; CPU-Betrieb und Offline-Eigenschaft protokollieren.

Abnahme: Nach einmaliger Einrichtung funktioniert Vorlesen mit dem gespeicherten Ziel. Der Verbindungscheck erzeugt keine Synthese. Ein fehlender lokaler Dienst oder Abbruch bewirkt weder Wiederholung noch Cloudwechsel. Die bestehenden TTS- und Chatfunktionen bleiben nutzbar.

Einordnung: neue Etappe **M3-TTS**, parallel zur Anbieteranbindung und vor M7. M7 betrifft weiterhin Spracheingabe/Mikrofon und optionale weitere Oberflächen; einfache Sprachausgabe muss darauf nicht warten.
