# SSH-Tunnel und Aufträge · KAIROS 0.3.1

## Einrichtung für Colibri

Einstellungen → Server hinzufügen oder Zugang bearbeiten → SSH-Tunnel aktivieren. Backend: OpenAI-kompatibler Chat. Die gespeicherte API-Adresse kann weiterhin `http://127.0.0.1:18000` sein; bei aktiviertem SSH verwendet KAIROS den tatsächlich gewählten Tunnelport.

- SSH-Host `192.168.0.175`, Port `22`, Benutzer `hancock`.
- Zielhost `127.0.0.1`, Zielport `8000`. Colibri bleibt auf Ubuntu-Loopback.
- Lokaler Wunschport `18000`, oder `0` für automatisch. Bei Belegung weicht KAIROS auf einen freien Port aus. Listener ausschließlich Windows-Loopback.
- Authentifizierung: Windows-OpenSSH-Agent, importierter privater Schlüssel mit optionaler Passphrase oder Passwort. Importierte Schlüssel, Passphrasen und Passwörter werden mit Electron safeStorage/Windows-DPAPI im separaten Zugangstresor gespeichert. Der ursprünglich ausgewählte Schlüssel wird nicht verändert. Kein Klartext-Fallback, keine zusätzlichen Passwortdateien oder geheimen Prozessargumente.
- Erstkontakt: Fingerprint bewusst mit einem unabhängig bekannten Fingerprint vergleichen und bestätigen. Ablehnung verhindert die Anmeldung. Ein später geänderter Schlüssel blockiert die Verbindung; es gibt keinen automatischen Austausch und keine Abschaltung der Prüfung.

SSH-Anmeldung, Tunnelbereitschaft und API-Prüfung sind getrennte Zustände. Ein offener Tunnel beweist weder erreichbare Modelle noch einen laufenden KI-Auftrag. Zugangsdaten für eine HTTP-API sind nur durch einen nachweislich aufgebauten SSH-Tunnel zum Loopback-Ziel erlaubt. Direkte HTTP-Verbindungen behalten ihre ausdrückliche Heimnetz-Ausnahme ohne Zugangsdaten. HTTPS prüft Zertifikate weiterhin regulär; ein Tunnel hebt die Zertifikatsprüfung nicht auf.

KAIROS startet Tunnel bei Bedarf, stellt nach Verlust die Verbindung begrenzt wieder her und sendet keinen Generierungsauftrag erneut. Beim Beenden schließt es ausschließlich eigene Tunnel. Es führt keine entfernten Shellbefehle aus und installiert oder startet keinen Server. Bestehende manuelle Tunnel müssen für diesen Modus nicht benutzt werden.

## Warten, Abbruch und Wiederfinden

240 Sekunden sind nur eine Hinweisschwelle, kein Abbruch. Die ursprüngliche Anfrage bleibt bestehen; auch das implizite Fünf-Minuten-Limit des HTTP-Clients ist für Generierung entfernt. Bei unbekanntem Status steht ausdrücklich, dass KAIROS weiter wartet. Verbindungsausfall bedeutet nicht, dass die Berechnung beendet wurde.

Auftragsmetadaten werden in `jobs.vault` verschlüsselt gespeichert. ComfyUI speichert die zurückgegebene prompt_id unmittelbar nach Annahme, zusammen mit Chat-/Nachrichtenzuordnung, client_id, Ausgabe-Node, Seed und Zeitstempeln. Keine Benutzerprompts oder Zugangsdaten in diesem Auftragstresor. Der Ursprung ist an Profil, Backend und tatsächliches Serverziel gebunden, unabhängig vom dynamischen lokalen SSH-Port.

Nach Neustart erscheinen unvollständige Aufträge als „Status unbekannt“. ComfyUI bietet „Status prüfen / Ergebnis abrufen“ über Queue/History/View. Antworten werden der ursprünglichen Nachricht einmalig zugeordnet. Kein neuer POST /prompt zum Abrufen. Gelöschte Historie wird als nicht auffindbar behandelt; Netzwerkfehler lassen den Ausgang unbekannt. Geänderte oder gelöschte Verbindungen blockieren den Abruf auf einem anderen Server.

| Backend | Wiederabruf | Manueller Abbruch |
|---|---|---|
| ComfyUI | Server-ID, Queue und History, solange Historie und Dateien vorhanden sind | Eigene wartende ID gezielt aus Queue entfernen und Status überprüfen. Laufend: nur „Nicht mehr warten“; kein globales /interrupt. Ein execution_interrupted-Eintrag wird als bestätigter Serverabbruch erkannt. |
| Ollama 0.40.0 | Keine dokumentierte dauerhafte Auftrags-/Ergebnis-API gefunden | Verbindung lokal schließen. Quellcode reicht Request-Abbruch an die Engine weiter; keine serverseitige Bestätigung im Client. Daher nur „Nicht mehr warten“. |
| Colibri | Installierte Version noch nicht prüfbar; keine Wiederabrufbarkeit behauptet | Nur „Nicht mehr warten“. Aktueller Upstream besitzt Disconnect/CANCEL-Logik, aber der installierte Stand und dessen Verhalten sind nicht bestätigt. |
| Sonstige OpenAI-/Bild-APIs | Keine allgemeine Wiederabruf- oder Abbruchfähigkeit aus API-Kompatibilität abgeleitet | Nur „Nicht mehr warten“. |

Für Colibri wäre eine getrennte Servererweiterung nötig: POST /jobs nimmt asynchron an und liefert eindeutige ID; GET /jobs/{id} zeigt Status; GET /jobs/{id}/result liefert das Ergebnis; ein eigener Cancel-Endpunkt bestätigt den tatsächlichen Engineabbruch. Zugriff serverseitig auf den Auftragseigentümer begrenzen und Ergebnisse mit Größenlimit/TTL speichern. Diese Erweiterung wird nicht installiert oder deployt.

Chats teilen beim Modellwechsel denselben Verlauf innerhalb des Kontextbudgets. Aktuell unterstützt KAIROS eine aktive Anfrage gleichzeitig; zwei parallele Chats mit unterschiedlichen Agents sind noch nicht implementiert. Während einer Anfrage sperrt KAIROS alle Einstellungen. Offline-Modelle können nicht aktiviert werden; vor Aktivierung und Generierung wird die API tatsächlich geprüft.

## Prüfung und Grenzen

Automatisierte Tests: virtuelle Antwort nach über 240/300 Sekunden ohne zweiten Request, lokale Abbrüche, Netzwerkverlust, unbekannter Status, Queue-/History-Wiederabruf, fehlende Historie/Datei, Schutz fremder und laufender ComfyUI-Aufträge. Echte lokale SSH-Testserver prüfen Passwort und Schlüssel, Erstbestätigung, Hostschlüsselwechsel vor Anmeldung, falsches Passwort, Portkonflikt, Tunnelverlust, Neustart und unveränderten API-Server nach Tunnelende. Electron-Prüfung nutzt ausschließlich einen isolierten Test-Tresor; sie prüft gesperrte Einstellungen, lokalen Abbruch, wiederholten Abruf und Serverwechsel.

Nicht live nachgewiesen: installierter Colibri-Servercode mangels SSH-Zugang, echter laufender Engineabbruch auf Ubuntu, Windows-SSH-Agent mit deinem Schlüssel und echter ComfyUI-Bildworkflow. ComfyUI auf 8188 war bei der Prüfung nicht erreichbar. Laufende fremde Jobs werden deshalb grundsätzlich nicht unterbrochen.

Primärquellen: [ssh2](https://github.com/mscdex/ssh2), [ComfyUI server.py](https://github.com/Comfy-Org/ComfyUI/blob/master/server.py), [Ollama v0.40.0 routes.go](https://github.com/ollama/ollama/blob/v0.40.0/server/routes.go), [Colibri Upstream](https://github.com/JustVugg/colibri/blob/main/c/openai_server.py). Upstream-Code ist kein Nachweis für den tatsächlich installierten Colibri-Stand.
