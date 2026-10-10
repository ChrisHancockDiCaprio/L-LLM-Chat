# Hancock – eigene KAIROS-Figur

Stand vom 10.10.2026. Die Figur ist in das KAIROS-App-Fenster eingebaut und mit Schnellchat, Gesprächsauswahl, Anhängen, Bild-/Sprachstudio und echten Auftragszuständen verbunden. Der freie Desktop-Modus folgt separat. Bedienung, Prüfungen und verbleibende Etappen: [Hancock-Prüfbericht](docs/KAIROS-HANCOCK-PRUEFBERICHT.md).

Bestätigtes Bedienkonzept und Umsetzungsreihenfolge: [KAIROS-Gesamtplan mit Hancock](docs/KAIROS-GESAMTPLAN-HANCOCK.md). Zunächst sitzt Hancock am App-Fensterrand. Ein Klick öffnet eine größere Figur mit Schnellchat und den Aktionen Chatten, Bild erstellen, Vorlesen und Aufgaben. Der freie Desktop-Modus folgt nach der App-Anbindung.

Hancock ist ein kleiner geometrischer Roboter: türkisfarbener sechseckiger Körper, dunkles Gesicht mit zwei hellen Augen, kurze Arme und Füße, goldene rautenförmige Antenne. Seine Form besteht aus einfachen SVG-Pfaden und Rechtecken. Sie benötigt keine Bildgenerierung, Sprite-Dateien oder zusätzliche Bibliothek.

## Dateien

- `assets/hancock.svg`: skalierbare statische Figur mit zugänglicher Beschreibung.
- `ui/hancock.js`: wiederverwendbares Web Component `<kairos-hancock>` mit integriertem SVG und Animationen.
- `ui/hancock-character.css`: lokale Figurenstile und Animationen unter der produktiven CSP.
- `ui/hancock-panel.js`: Karte mit gemeinsamem Entwurf, Gesprächsauswahl und vorhandenen Aktionen.
- `ui/hancock-preview.html`: eigenständige interaktive Vorschau mit fünf Beispielzuständen.

## Anbindung

`hancock.js` als lokales Skript laden und `<kairos-hancock state="idle"></kairos-hancock>` einsetzen. Das Attribut `state` akzeptiert `idle`, `waiting`, `done`, `attention` und `error`. Unbekannte Werte verwenden den Bereitschaftszustand. `paused` pausiert Animationen und Mausreaktion. Reduzierte Bewegung aus den Systemeinstellungen wird berücksichtigt.

Ein Klick oder die Aktivierung über die Tastatur sendet `hancock-open`. KAIROS kann darüber den passenden Bereich öffnen. Die Figur ruft weder eine KI noch eine API auf. Die Augen reagieren nur auf Mausbewegung über der Figur; es gibt kein globales Maus-Polling.

Die App verwendet bestehende Auftragszustände. `waiting` bedeutet „wartet auf eine Antwort“, nicht „Serverberechnung bestätigt“. `attention` wird ausschließlich bei einer tatsächlich ausstehenden SSH-Hostschlüsselentscheidung gesetzt; die Freigabe erfolgt weiterhin im Sicherheitsdialog. Zusätzlich zur Figur zeigt die Karte verständlichen Statustext.

Der Entwurf wurde eigenständig als SVG/CSS/JavaScript erstellt. Es wurden keine Coucou-/Mochi-Quelltexte, Figuren, Icons oder Sounds übernommen. Der Name Hancock wurde vom Nutzer festgelegt. Es wurden keine eigenen Geräusche hinzugefügt.
